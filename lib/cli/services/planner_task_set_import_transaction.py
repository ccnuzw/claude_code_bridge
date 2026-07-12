from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

from storage.atomic import atomic_write_json
from storage.locks import file_lock


SCHEMA = 'ccb.plan.planner_task_set_import_transaction.v1'
JOURNAL_NAME = 'planner-task-set-import.transaction.json'
LOCK_NAME = 'planner-task-set-import.transaction.lock'
TRACE_KEY = 'planner_task_set_import_transaction'
_DIGEST_RE = re.compile(r'^[0-9a-f]{64}$')


class PlannerTaskSetImportConflict(ValueError):
    pass


def canonical_journal_ref(job_id: str) -> str:
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', str(job_id or '')):
        raise ValueError('planner task-set import job_id is invalid')
    return f'.ccb/runtime/role-output-imports/{job_id}/{JOURNAL_NAME}'


def transaction_digest(identity: dict[str, object]) -> str:
    encoded = json.dumps(identity, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def prepare(context, *, identity: dict[str, object]) -> dict[str, object]:
    job_id = str(identity.get('planner_job_id') or '')
    path = _journal_path(context, job_id)
    digest = transaction_digest(identity)
    with file_lock(path.with_name(LOCK_NAME)):
        existing = _read(path)
        if existing is not None:
            _validate(existing, expected_ref=canonical_journal_ref(job_id))
            if existing.get('transaction_digest') != digest or existing.get('identity') != identity:
                conflict = {
                    'reason': 'planner_task_set_import_identity_conflict',
                    'observed_transaction_digest': digest,
                    'observed_identity': identity,
                    'recorded_at': _now(),
                }
                existing['status'] = 'failed'
                existing.setdefault('conflicts', []).append(conflict)
                existing['updated_at'] = _now()
                atomic_write_json(path, existing)
                raise PlannerTaskSetImportConflict(conflict['reason'])
            if existing.get('status') == 'failed':
                raise PlannerTaskSetImportConflict('planner task-set import transaction is failed')
            return existing
        now = _now()
        record = {
            'schema': SCHEMA,
            'schema_version': 1,
            'status': 'prepared',
            'journal_ref': canonical_journal_ref(job_id),
            'transaction_digest': digest,
            'identity': identity,
            'created_at': now,
            'updated_at': now,
            'conflicts': [],
        }
        atomic_write_json(path, record)
        return record


def authority_trace(record: dict[str, object], *, source_job: dict[str, object]) -> dict[str, object]:
    return {
        'source': 'loop_runner_role_output_import',
        'source_job': source_job,
        TRACE_KEY: {
            'journal_ref': record['journal_ref'],
            'transaction_digest': record['transaction_digest'],
        },
    }


def commit(context, record: dict[str, object], *, authority: dict[str, object]) -> dict[str, object]:
    job_id = str(record['identity']['planner_job_id'])
    path = _journal_path(context, job_id)
    with file_lock(path.with_name(LOCK_NAME)):
        current = _read(path)
        if current is None:
            raise PlannerTaskSetImportConflict('planner task-set import journal disappeared before commit')
        _validate(current, expected_ref=canonical_journal_ref(job_id))
        if current.get('transaction_digest') != record.get('transaction_digest'):
            raise PlannerTaskSetImportConflict('planner task-set import journal changed before commit')
        if current.get('status') == 'failed':
            raise PlannerTaskSetImportConflict('planner task-set import transaction is failed')
        if current.get('status') == 'committed':
            if current.get('authority') != authority:
                raise PlannerTaskSetImportConflict('committed planner task-set authority conflicts with replay')
            return current
        current['authority'] = authority
        current['status'] = 'committed'
        current['committed_at'] = _now()
        current['updated_at'] = current['committed_at']
        atomic_write_json(path, current)
        return current


def fail(context, record: dict[str, object], *, reason: str, evidence: object) -> None:
    job_id = str(record['identity']['planner_job_id'])
    path = _journal_path(context, job_id)
    with file_lock(path.with_name(LOCK_NAME)):
        current = _read(path) or record
        if current.get('status') == 'committed':
            return
        current['status'] = 'failed'
        current.setdefault('conflicts', []).append({
            'reason': reason,
            'evidence': evidence,
            'recorded_at': _now(),
        })
        current['updated_at'] = _now()
        atomic_write_json(path, current)


def runner_transaction_committed(project_root: Path, task: dict[str, object]) -> bool:
    trace = task.get('authority_trace') if isinstance(task.get('authority_trace'), dict) else {}
    tx = trace.get(TRACE_KEY) if isinstance(trace.get(TRACE_KEY), dict) else None
    if tx is None:
        return True
    journal_ref = str(tx.get('journal_ref') or '')
    digest = str(tx.get('transaction_digest') or '')
    source_job = trace.get('source_job') if isinstance(trace.get('source_job'), dict) else {}
    job_id = str(source_job.get('job_id') or '')
    try:
        canonical_ref = canonical_journal_ref(job_id)
    except ValueError:
        return False
    if journal_ref != canonical_ref or not _DIGEST_RE.fullmatch(digest):
        return False
    root = Path(project_root).resolve()
    path = root / canonical_ref
    try:
        if path.resolve(strict=False) != path or root not in path.parents:
            return False
        record = _read(path)
        if record is None:
            return False
        _validate(record, expected_ref=canonical_ref)
    except (OSError, ValueError, json.JSONDecodeError):
        return False
    return record.get('status') == 'committed' and record.get('transaction_digest') == digest


def _journal_path(context, job_id: str) -> Path:
    return Path(context.project.project_root) / canonical_journal_ref(job_id)


def _read(path: Path) -> dict[str, object] | None:
    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        return None
    if not isinstance(payload, dict):
        raise ValueError('planner task-set import journal must be an object')
    return payload


def _validate(record: dict[str, object], *, expected_ref: str) -> None:
    if record.get('schema') != SCHEMA or record.get('schema_version') != 1:
        raise ValueError('planner task-set import journal schema mismatch')
    if record.get('journal_ref') != expected_ref:
        raise ValueError('planner task-set import journal ref mismatch')
    identity = record.get('identity')
    digest = str(record.get('transaction_digest') or '')
    if not isinstance(identity, dict) or not _DIGEST_RE.fullmatch(digest) or transaction_digest(identity) != digest:
        raise ValueError('planner task-set import journal digest mismatch')
    if record.get('status') not in {'prepared', 'committed', 'failed'}:
        raise ValueError('planner task-set import journal status invalid')


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
