from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import threading

from storage.atomic import atomic_write_json

SCHEMA_VERSION = 1
NOTIFICATION_KIND_TASK_COMPLETED = 'task_completed'
INVALIDATION_KIND_PROJECT_SUMMARY = 'project_summary_changed'
INVALIDATION_KIND_AGENT_ACTIVITY = 'agent_activity_changed'
INVALIDATION_KIND_CONVERSATION = 'conversation_changed'

_STATE_RECORD_TYPE = 'ccb_mobile_notification_state'
_BUSY_STATES = frozenset({'active'})
_COMPLETED_STATES = frozenset({'idle', 'failed'})
_DEFAULT_RECENT_LIMIT = 100


@dataclass(frozen=True)
class MobileNotificationSnapshot:
    project_id: str
    project_short_name: str
    namespace_epoch: int | None
    agent: str
    activity_state: str
    observed_at: str


@dataclass(frozen=True)
class MobileInvalidationSnapshot:
    """A redacted, change-detection-only view of a mobile agent.

    The SSE stream deliberately carries no conversation body, terminal output,
    route detail, or credential.  Clients use these records only as a signal to
    fetch the normal REST snapshot that remains authoritative.
    """

    project_id: str
    project_short_name: str
    namespace_epoch: int | None
    agent: str
    activity_state: str
    conversation_fingerprint: str
    observed_at: str


@dataclass(frozen=True)
class MobileNotificationEvent:
    id: str
    kind: str
    project_id: str
    project_short_name: str
    agent: str
    completed_at: str
    dedupe_key: str
    namespace_epoch: int | None = None
    scope: str | None = None

    def to_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {
            'id': self.id,
            'kind': self.kind,
            'project_id': self.project_id,
            'project_short_name': self.project_short_name,
            'agent': self.agent,
            'completed_at': self.completed_at,
            'dedupe_key': self.dedupe_key,
        }
        if self.namespace_epoch is not None:
            payload['namespace_epoch'] = self.namespace_epoch
        if self.scope:
            payload['scope'] = self.scope
        return payload


class MobileNotificationStore:
    def __init__(self, mobile_dir: Path, *, recent_limit: int = _DEFAULT_RECENT_LIMIT) -> None:
        self._mobile_dir = Path(mobile_dir)
        self._recent_limit = max(1, int(recent_limit))
        self._lock = threading.RLock()

    @property
    def events_path(self) -> Path:
        return self._mobile_dir / 'notifications.jsonl'

    @property
    def state_path(self) -> Path:
        return self._mobile_dir / 'notification-state.json'

    def sync_snapshots(self, snapshots: list[MobileNotificationSnapshot]) -> list[MobileNotificationEvent]:
        with self._lock:
            state = self._load_state()
            agent_states = _state_agents(state)
            event_records = _read_jsonl(self.events_path)
            state['next_event_sequence'] = max(
                _int(state.get('next_event_sequence'), 1),
                _next_sequence_after(event_records),
            )
            existing_dedupe_keys = {
                str(record.get('dedupe_key') or '')
                for record in event_records
                if str(record.get('dedupe_key') or '').strip()
            }
            emitted: list[MobileNotificationEvent] = []
            for snapshot in snapshots:
                key = _snapshot_key(snapshot)
                prior = agent_states.get(key)
                completion_sequence = _int(_map(prior).get('completion_sequence'), 0)
                if _is_task_completion_transition(prior, snapshot):
                    completion_sequence += 1
                    dedupe_key = _dedupe_key(snapshot, completion_sequence=completion_sequence)
                    if dedupe_key not in existing_dedupe_keys:
                        event = self._next_event(
                            state,
                            snapshot=snapshot,
                            dedupe_key=dedupe_key,
                        )
                        self._append_event(event)
                        existing_dedupe_keys.add(dedupe_key)
                        emitted.append(event)
                agent_states[key] = _snapshot_state(snapshot, completion_sequence=completion_sequence)
            state['agents'] = agent_states
            self._write_state(state)
            return emitted

    def sync_invalidations(
        self,
        snapshots: list[MobileInvalidationSnapshot],
    ) -> list[MobileNotificationEvent]:
        """Append only meaningful invalidations and retain a bounded journal.

        The first observation is a baseline.  A new subscriber already makes
        an authoritative REST load, so replaying a full server inventory would
        only cause unnecessary requests and retained completion noise.
        """
        with self._lock:
            state = self._load_state()
            agents = _state_invalidation_agents(state)
            event_records = _read_jsonl(self.events_path)
            state['next_event_sequence'] = max(
                _int(state.get('next_event_sequence'), 1),
                _next_sequence_after(event_records),
            )
            existing_dedupe_keys = {
                str(record.get('dedupe_key') or '')
                for record in event_records
                if str(record.get('dedupe_key') or '').strip()
            }
            emitted: list[MobileNotificationEvent] = []
            summary_changed_projects: set[str] = set()
            for snapshot in snapshots:
                key = _snapshot_key_for_invalidation(snapshot)
                prior = agents.get(key)
                if prior:
                    activity_changed = (
                        str(prior.get('activity_state') or '')
                        != snapshot.activity_state
                        or prior.get('namespace_epoch') != snapshot.namespace_epoch
                    )
                    conversation_changed = (
                        str(prior.get('conversation_fingerprint') or '')
                        != snapshot.conversation_fingerprint
                    )
                    if activity_changed:
                        event = self._next_invalidation_event(
                            state,
                            snapshot=snapshot,
                            kind=INVALIDATION_KIND_AGENT_ACTIVITY,
                            scope='agent',
                            dedupe_key=_invalidation_dedupe_key(
                                snapshot,
                                kind=INVALIDATION_KIND_AGENT_ACTIVITY,
                            ),
                        )
                        if event.dedupe_key not in existing_dedupe_keys:
                            self._append_event(event)
                            existing_dedupe_keys.add(event.dedupe_key)
                            emitted.append(event)
                        summary_changed_projects.add(snapshot.project_id)
                    if conversation_changed:
                        event = self._next_invalidation_event(
                            state,
                            snapshot=snapshot,
                            kind=INVALIDATION_KIND_CONVERSATION,
                            scope='conversation',
                            dedupe_key=_invalidation_dedupe_key(
                                snapshot,
                                kind=INVALIDATION_KIND_CONVERSATION,
                            ),
                        )
                        if event.dedupe_key not in existing_dedupe_keys:
                            self._append_event(event)
                            existing_dedupe_keys.add(event.dedupe_key)
                            emitted.append(event)
                agents[key] = _invalidation_snapshot_state(snapshot)
            for project_id in sorted(summary_changed_projects):
                matching = next(
                    (item for item in snapshots if item.project_id == project_id),
                    None,
                )
                if matching is None:
                    continue
                event = self._next_invalidation_event(
                    state,
                    snapshot=matching,
                    kind=INVALIDATION_KIND_PROJECT_SUMMARY,
                    scope='project',
                    agent='',
                    dedupe_key=_project_summary_dedupe_key(matching),
                )
                if event.dedupe_key not in existing_dedupe_keys:
                    self._append_event(event)
                    existing_dedupe_keys.add(event.dedupe_key)
                    emitted.append(event)
            state['invalidations'] = agents
            self._write_state(state)
            return emitted

    def events_since(self, last_event_id: str | None = None) -> list[MobileNotificationEvent]:
        records = _read_jsonl(self.events_path)
        start_index = 0
        cursor = str(last_event_id or '').strip()
        if cursor:
            for index, record in enumerate(records):
                if str(record.get('id') or '') == cursor:
                    start_index = index + 1
                    break
            else:
                start_index = len(records)
        else:
            start_index = max(0, len(records) - self._recent_limit)
        return [
            event
            for record in records[start_index:]
            if (event := _event_from_record(record)) is not None
        ]

    def _next_event(
        self,
        state: dict[str, object],
        *,
        snapshot: MobileNotificationSnapshot,
        dedupe_key: str,
    ) -> MobileNotificationEvent:
        sequence = max(1, _int(state.get('next_event_sequence'), 1))
        state['next_event_sequence'] = sequence + 1
        return MobileNotificationEvent(
            id=f'mnotif_{sequence:012d}',
            kind=NOTIFICATION_KIND_TASK_COMPLETED,
            project_id=snapshot.project_id,
            project_short_name=snapshot.project_short_name,
            agent=snapshot.agent,
            completed_at=snapshot.observed_at,
            dedupe_key=dedupe_key,
        )

    def _next_invalidation_event(
        self,
        state: dict[str, object],
        *,
        snapshot: MobileInvalidationSnapshot,
        kind: str,
        scope: str,
        dedupe_key: str,
        agent: str | None = None,
    ) -> MobileNotificationEvent:
        sequence = max(1, _int(state.get('next_event_sequence'), 1))
        state['next_event_sequence'] = sequence + 1
        return MobileNotificationEvent(
            id=f'mnotif_{sequence:012d}',
            kind=kind,
            project_id=snapshot.project_id,
            project_short_name=snapshot.project_short_name,
            agent=snapshot.agent if agent is None else agent,
            completed_at=snapshot.observed_at,
            dedupe_key=dedupe_key,
            namespace_epoch=snapshot.namespace_epoch,
            scope=scope,
        )

    def _append_event(self, event: MobileNotificationEvent) -> None:
        _append_jsonl(self.events_path, event.to_payload())
        _trim_jsonl(self.events_path, limit=self._recent_limit)

    def _load_state(self) -> dict[str, object]:
        try:
            payload = json.loads(self.state_path.read_text(encoding='utf-8'))
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        if str(payload.get('record_type') or '') != _STATE_RECORD_TYPE:
            payload = {}
        payload.setdefault('schema_version', SCHEMA_VERSION)
        payload.setdefault('record_type', _STATE_RECORD_TYPE)
        payload.setdefault('next_event_sequence', 1)
        payload.setdefault('agents', {})
        payload.setdefault('invalidations', {})
        return payload

    def _write_state(self, state: dict[str, object]) -> None:
        self._mobile_dir.mkdir(parents=True, exist_ok=True)
        atomic_write_json(self.state_path, state)


def encode_sse_event(event: MobileNotificationEvent | dict[str, object]) -> bytes:
    payload = event.to_payload() if isinstance(event, MobileNotificationEvent) else dict(event)
    event_id = str(payload.get('id') or '').strip()
    event_kind = str(payload.get('kind') or 'message').strip() or 'message'
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return f'id: {event_id}\nevent: {event_kind}\ndata: {body}\n\n'.encode('utf-8')


def _is_task_completion_transition(prior: object, snapshot: MobileNotificationSnapshot) -> bool:
    prior_record = _map(prior)
    if not prior_record:
        return False
    if str(prior_record.get('activity_state') or '').strip().lower() not in _BUSY_STATES:
        return False
    if snapshot.activity_state not in _COMPLETED_STATES:
        return False
    prior_epoch = prior_record.get('namespace_epoch')
    return prior_epoch is not None and prior_epoch == snapshot.namespace_epoch


def _snapshot_key(snapshot: MobileNotificationSnapshot) -> str:
    return '\0'.join((snapshot.project_id, snapshot.agent))


def _snapshot_key_for_invalidation(snapshot: MobileInvalidationSnapshot) -> str:
    return '\0'.join((snapshot.project_id, snapshot.agent))


def _snapshot_state(snapshot: MobileNotificationSnapshot, *, completion_sequence: int) -> dict[str, object]:
    return {
        'project_id': snapshot.project_id,
        'namespace_epoch': snapshot.namespace_epoch,
        'agent': snapshot.agent,
        'activity_state': snapshot.activity_state,
        'observed_at': snapshot.observed_at,
        'completion_sequence': int(completion_sequence),
    }


def _dedupe_key(snapshot: MobileNotificationSnapshot, *, completion_sequence: int) -> str:
    return ':'.join(
        (
            snapshot.project_id,
            str(snapshot.namespace_epoch),
            snapshot.agent,
            str(int(completion_sequence)),
        )
    )


def _state_agents(state: dict[str, object]) -> dict[str, dict[str, object]]:
    agents = state.get('agents')
    if not isinstance(agents, dict):
        return {}
    return {
        str(key): dict(value)
        for key, value in agents.items()
        if isinstance(value, dict)
    }


def _state_invalidation_agents(state: dict[str, object]) -> dict[str, dict[str, object]]:
    records = state.get('invalidations')
    if not isinstance(records, dict):
        return {}
    return {
        str(key): dict(value)
        for key, value in records.items()
        if isinstance(value, dict)
    }


def _invalidation_snapshot_state(snapshot: MobileInvalidationSnapshot) -> dict[str, object]:
    return {
        'project_id': snapshot.project_id,
        'namespace_epoch': snapshot.namespace_epoch,
        'agent': snapshot.agent,
        'activity_state': snapshot.activity_state,
        'conversation_fingerprint': snapshot.conversation_fingerprint,
        'observed_at': snapshot.observed_at,
    }


def _invalidation_dedupe_key(
    snapshot: MobileInvalidationSnapshot,
    *,
    kind: str,
) -> str:
    value = (
        snapshot.activity_state
        if kind == INVALIDATION_KIND_AGENT_ACTIVITY
        else snapshot.conversation_fingerprint
    )
    # Keep the journal useful for de-duplication without turning a private
    # change detector (notably the conversation fingerprint) into public SSE
    # payload.  The REST snapshot remains the sole content authority.
    digest = hashlib.sha256(value.encode('utf-8')).hexdigest()[:16]
    return ':'.join(
        ('invalidation', kind, snapshot.project_id, str(snapshot.namespace_epoch), snapshot.agent, digest)
    )


def _project_summary_dedupe_key(snapshot: MobileInvalidationSnapshot) -> str:
    return ':'.join(
        ('invalidation', INVALIDATION_KIND_PROJECT_SUMMARY, snapshot.project_id, str(snapshot.namespace_epoch), snapshot.activity_state)
    )


def _event_from_record(record: dict[str, object]) -> MobileNotificationEvent | None:
    required = {
        'id',
        'kind',
        'project_id',
        'project_short_name',
        'agent',
        'completed_at',
        'dedupe_key',
    }
    if not required.issubset(record):
        return None
    return MobileNotificationEvent(
        id=str(record.get('id') or ''),
        kind=str(record.get('kind') or ''),
        project_id=str(record.get('project_id') or ''),
        project_short_name=str(record.get('project_short_name') or ''),
        agent=str(record.get('agent') or ''),
        completed_at=str(record.get('completed_at') or ''),
        dedupe_key=str(record.get('dedupe_key') or ''),
        namespace_epoch=_optional_int(record.get('namespace_epoch')),
        scope=_optional_text(record.get('scope')),
    )


def _next_sequence_after(records: list[dict[str, object]]) -> int:
    max_sequence = 0
    prefix = 'mnotif_'
    for record in records:
        event_id = str(record.get('id') or '')
        if not event_id.startswith(prefix):
            continue
        try:
            max_sequence = max(max_sequence, int(event_id[len(prefix):]))
        except ValueError:
            continue
    return max_sequence + 1


def _read_jsonl(path: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except OSError:
        return records
    for line in lines:
        text = line.strip()
        if not text:
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            records.append(dict(payload))
    return records


def _append_jsonl(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as handle:
        handle.write(json.dumps(payload, ensure_ascii=False, sort_keys=True))
        handle.write('\n')


def _trim_jsonl(path: Path, *, limit: int) -> None:
    records = _read_jsonl(path)
    if len(records) <= limit:
        return
    retained = records[-max(1, limit):]
    temp = path.with_suffix(path.suffix + '.tmp')
    with temp.open('w', encoding='utf-8') as handle:
        for record in retained:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True))
            handle.write('\n')
    temp.replace(path)


def _map(value: object) -> dict[str, object]:
    return dict(value) if isinstance(value, dict) else {}


def _int(value: object, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _optional_int(value: object) -> int | None:
    try:
        return int(value) if value is not None and str(value).strip() else None
    except (TypeError, ValueError):
        return None


def _optional_text(value: object) -> str | None:
    text = str(value or '').strip()
    return text or None


__all__ = [
    'MobileNotificationEvent',
    'MobileInvalidationSnapshot',
    'MobileNotificationSnapshot',
    'MobileNotificationStore',
    'NOTIFICATION_KIND_TASK_COMPLETED',
    'INVALIDATION_KIND_AGENT_ACTIVITY',
    'INVALIDATION_KIND_CONVERSATION',
    'INVALIDATION_KIND_PROJECT_SUMMARY',
    'SCHEMA_VERSION',
    'encode_sse_event',
]
