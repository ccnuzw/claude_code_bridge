from __future__ import annotations

import base64
import json
from pathlib import Path

from cli.services.role_output_import import frontdesk_intake_missing_fields
from storage.atomic import atomic_write_json

from .frontdesk_handler import build_frontdesk_forward_planner_handler


def observe_frontdesk_session(app) -> dict[str, object] | None:
    runtime = _frontdesk_runtime(app)
    if runtime is None:
        return None
    if str(getattr(runtime, 'provider', '') or '').strip().lower() != 'codex':
        return None
    session_path = _codex_session_path(runtime)
    if session_path is None:
        return _record_state(
            app,
            {
                'status': 'blocked',
                'reason': 'frontdesk_codex_session_path_missing',
                'agent_name': 'frontdesk',
            },
        )
    latest = _latest_task_complete(session_path)
    if latest is None:
        return None
    turn_id = str(latest.get('turn_id') or '').strip()
    if not turn_id:
        return None
    state = _load_state(app)
    if str(state.get('last_observed_turn_id') or state.get('last_turn_id') or state.get('turn_id') or '') == turn_id:
        return None
    reply = str(latest.get('last_agent_message') or '')
    missing = frontdesk_intake_missing_fields(reply)
    if missing:
        if _has_successful_handoff(state):
            return _record_state(
                app,
                {
                    'status': state.get('status'),
                    'reason': state.get('reason', ''),
                    'agent_name': 'frontdesk',
                    'last_turn_id': state.get('last_turn_id') or state.get('turn_id'),
                    'turn_id': state.get('turn_id') or state.get('last_turn_id'),
                    'last_observed_turn_id': turn_id,
                    'session_path': state.get('session_path'),
                    'frontdesk_intake': state.get('frontdesk_intake'),
                    'last_ignored': {
                        'turn_id': turn_id,
                        'reason': 'frontdesk_reply_not_intake_evidence',
                        'missing_fields': missing,
                    },
                },
            )
        return _record_state(
            app,
            {
                'status': 'ignored',
                'reason': 'frontdesk_reply_not_intake_evidence',
                'agent_name': 'frontdesk',
                'last_turn_id': turn_id,
                'turn_id': turn_id,
                'last_observed_turn_id': turn_id,
                'missing_fields': missing,
            },
        )
    handler = build_frontdesk_forward_planner_handler(
        app.dispatcher,
        start_auto_runner=getattr(app, 'frontdesk_observer_start_auto_runner', None),
    )
    payload = handler(
        {
            'intake_base64': base64.b64encode(reply.encode('utf-8')).decode('ascii'),
            'json_output': True,
        }
    )
    status = 'ok' if str(payload.get('frontdesk_intake_status') or '') == 'ok' else 'blocked'
    return _record_state(
        app,
        {
            'status': status,
            'reason': str(payload.get('reason') or ''),
            'agent_name': 'frontdesk',
            'last_turn_id': turn_id,
            'turn_id': turn_id,
            'last_observed_turn_id': turn_id,
            'session_path': str(session_path),
            'frontdesk_intake': _compact_intake_payload(payload),
        },
    )


def _frontdesk_runtime(app):
    registry = getattr(app, 'registry', None)
    get = getattr(registry, 'get', None)
    if not callable(get):
        return None
    try:
        return get('frontdesk')
    except Exception:
        return None


def _codex_session_path(runtime) -> Path | None:
    session_file = _optional_path(getattr(runtime, 'session_file', None))
    if session_file is None:
        return None
    try:
        payload = json.loads(session_file.read_text(encoding='utf-8'))
    except Exception:
        return None
    session_path = _optional_path(payload.get('codex_session_path'))
    if session_path is not None and session_path.is_file():
        return session_path
    return None


def _latest_task_complete(session_path: Path) -> dict[str, object] | None:
    latest: dict[str, object] | None = None
    try:
        lines = session_path.read_text(encoding='utf-8').splitlines()
    except Exception:
        return None
    for line in lines:
        try:
            record = json.loads(line)
        except Exception:
            continue
        if str(record.get('type') or '') != 'event_msg':
            continue
        payload = record.get('payload')
        if not isinstance(payload, dict):
            continue
        if str(payload.get('type') or '') != 'task_complete':
            continue
        latest = payload
    return latest


def _state_path(app) -> Path:
    return Path(app.paths.project_root) / '.ccb' / 'runtime' / 'frontdesk-session-observer' / 'state.json'


def _load_state(app) -> dict[str, object]:
    try:
        payload = json.loads(_state_path(app).read_text(encoding='utf-8'))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def _has_successful_handoff(state: dict[str, object]) -> bool:
    intake = state.get('frontdesk_intake')
    if not isinstance(intake, dict):
        return False
    return str(state.get('status') or '') == 'ok' and str(intake.get('frontdesk_intake_status') or '') == 'ok'


def _record_state(app, payload: dict[str, object]) -> dict[str, object]:
    record = {
        'schema_version': 1,
        'record_type': 'ccb_frontdesk_session_observer',
        'recorded_at': app.clock() if callable(getattr(app, 'clock', None)) else None,
        **payload,
    }
    atomic_write_json(_state_path(app), record)
    return record


def _compact_intake_payload(payload: dict[str, object]) -> dict[str, object]:
    return {
        'frontdesk_intake_status': payload.get('frontdesk_intake_status'),
        'action': payload.get('action'),
        'reason': payload.get('reason'),
        'plan_slug': payload.get('plan_slug'),
        'request_id': payload.get('request_id'),
        'activation_id': payload.get('activation_id'),
        'activation_path': payload.get('activation_path'),
        'planner_job_id': payload.get('planner_job_id'),
        'silence': payload.get('silence'),
    }


def _optional_path(value) -> Path | None:
    text = str(value or '').strip()
    if not text:
        return None
    try:
        return Path(text).expanduser()
    except Exception:
        return None


__all__ = ['observe_frontdesk_session']
