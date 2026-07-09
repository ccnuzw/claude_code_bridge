from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace
import uuid

from provider_backends.grok.execution import _build_command, observe_grok_output
from provider_backends.native_cli_support import NativeCliExecutionRequest


def _req(prompt: str = 'review this', work_dir: str = '/tmp/wd', session_data: dict | None = None) -> NativeCliExecutionRequest:
    return NativeCliExecutionRequest(
        provider='grok',
        job=SimpleNamespace(job_id='job_grok_1'),
        work_dir=Path(work_dir),
        session_data=session_data or {},
        prompt=prompt,
        request_anchor='job_grok_1',
    )


def test_grok_command_builds_headless_streaming_invocation(monkeypatch) -> None:
    monkeypatch.delenv('CCB_GROK_MODEL', raising=False)
    monkeypatch.delenv('CCB_GROK_EFFORT', raising=False)

    cmd = _build_command(_req(prompt='hello', work_dir='/tmp/repo'))

    assert '-p' in cmd and cmd[cmd.index('-p') + 1] == 'hello'
    assert cmd[cmd.index('--cwd') + 1] == '/tmp/repo'
    assert cmd[cmd.index('--output-format') + 1] == 'streaming-json'
    session_id = cmd[cmd.index('--session-id') + 1]
    assert str(uuid.UUID(session_id)) == session_id
    assert '-m' not in cmd
    assert '--reasoning-effort' not in cmd


def test_grok_command_injects_model_and_effort_from_env(monkeypatch) -> None:
    monkeypatch.setenv('CCB_GROK_MODEL', 'grok-composer-2.5-fast')
    monkeypatch.setenv('CCB_GROK_EFFORT', 'low')

    cmd = _build_command(_req())

    assert cmd[cmd.index('-m') + 1] == 'grok-composer-2.5-fast'
    assert cmd[cmd.index('--reasoning-effort') + 1] == 'low'


def test_grok_command_session_data_overrides_env(monkeypatch) -> None:
    monkeypatch.setenv('CCB_GROK_MODEL', 'grok-composer-2.5-fast')
    monkeypatch.setenv('CCB_GROK_EFFORT', 'low')

    cmd = _build_command(_req(session_data={'grok_model': 'grok-4.5', 'grok_effort': 'xhigh'}))

    assert cmd[cmd.index('-m') + 1] == 'grok-4.5'
    assert cmd[cmd.index('--reasoning-effort') + 1] == 'xhigh'


def test_grok_observer_extracts_text_from_aggregated_json(tmp_path: Path) -> None:
    out = tmp_path / 'grok.out'
    out.write_text(
        json.dumps(
            {
                'text': 'alpha beta gamma',
                'stopReason': 'EndTurn',
                'sessionId': 'ses-1',
                'requestId': 'req-1',
                'thought': 'internal reasoning that must not leak into the reply',
            }
        ),
        encoding='utf-8',
    )

    obs = observe_grok_output(out)

    assert obs.error == ''
    assert obs.text == 'alpha beta gamma'
    assert obs.finished is True
    assert obs.finish_reason == 'end_turn'
    assert obs.turn_ref == 'req-1'


def test_grok_observer_preserves_multiline_text(tmp_path: Path) -> None:
    out = tmp_path / 'grok.out'
    out.write_text(
        json.dumps({'text': 'Apple\nBanana\nOrange', 'stopReason': 'EndTurn', 'requestId': 'r'}),
        encoding='utf-8',
    )

    obs = observe_grok_output(out)

    assert obs.text == 'Apple\nBanana\nOrange'


def test_grok_observer_empty_text_is_not_error(tmp_path: Path) -> None:
    out = tmp_path / 'grok.out'
    out.write_text(json.dumps({'text': '', 'stopReason': 'EndTurn', 'requestId': 'r'}), encoding='utf-8')

    obs = observe_grok_output(out)

    assert obs.text == ''
    assert obs.error == ''


def test_grok_observer_partial_json_waits_without_error(tmp_path: Path) -> None:
    out = tmp_path / 'grok.out'
    out.write_text('{"text": "half', encoding='utf-8')

    obs = observe_grok_output(out)

    assert obs.text == ''
    assert obs.error == ''


def test_grok_observer_extracts_native_streaming_json(tmp_path: Path) -> None:
    out = tmp_path / 'grok.jsonl'
    out.write_text(
        '\n'.join(
            [
                json.dumps({'type': 'thought', 'data': 'hidden'}, ensure_ascii=True),
                json.dumps({'type': 'text', 'data': 'alpha '}, ensure_ascii=True),
                json.dumps({'type': 'text', 'data': 'beta'}, ensure_ascii=True),
                json.dumps(
                    {
                        'type': 'end',
                        'stopReason': 'EndTurn',
                        'sessionId': 'ses-stream',
                        'requestId': 'req-stream',
                    },
                    ensure_ascii=True,
                ),
            ]
        )
        + '\n',
        encoding='utf-8',
    )

    obs = observe_grok_output(out)

    assert obs.error == ''
    assert obs.text == 'alpha beta'
    assert obs.finished is True
    assert obs.finish_reason == 'end_turn'
    assert obs.turn_ref == 'req-stream'


def test_grok_observer_missing_file_is_empty(tmp_path: Path) -> None:
    obs = observe_grok_output(tmp_path / 'does-not-exist.out')

    assert obs.text == ''
    assert obs.error == ''
