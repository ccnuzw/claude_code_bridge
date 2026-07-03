from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from provider_pane_status.claude_session import (
    claude_activity_status,
    compose_claude_runtime_status,
    read_claude_session_status,
)


def _append_jsonl(path: Path, *entries: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        for entry in entries:
            fh.write(json.dumps(entry) + "\n")


def _assistant_entry(*, text: str = "done", stop_reason: str | None = None) -> dict[str, object]:
    message: dict[str, object] = {
        "role": "assistant",
        "content": [{"type": "text", "text": text}],
    }
    if stop_reason:
        message["stop_reason"] = stop_reason
    return {
        "type": "assistant",
        "subtype": "completion",
        "uuid": "assistant-1",
        "message": message,
    }


def test_claude_session_status_reports_assistant_end_turn_as_free(tmp_path: Path) -> None:
    session = tmp_path / "session.jsonl"
    _append_jsonl(
        session,
        {"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": "hi"}]}},
        _assistant_entry(stop_reason="end_turn"),
    )

    status = read_claude_session_status(session)

    assert status.state == "free"
    assert status.reason == "claude_session_assistant_end_turn"
    assert status.matched_patterns == ("assistant_end_turn",)


def test_claude_session_status_reports_latest_user_as_working(tmp_path: Path) -> None:
    session = tmp_path / "session.jsonl"
    _append_jsonl(session, {"type": "user", "message": {"role": "user", "content": "Summarize"}})

    status = read_claude_session_status(session)

    assert status.state == "working"
    assert status.reason == "claude_session_user_turn"


def test_claude_session_status_reports_tool_use_as_tool_running(tmp_path: Path) -> None:
    session = tmp_path / "session.jsonl"
    _append_jsonl(
        session,
        {
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [{"type": "tool_use", "name": "Bash", "input": {"command": "pwd"}}],
            },
        },
    )

    status = read_claude_session_status(session)

    assert status.state == "tool_running"
    assert status.reason == "claude_session_tool_use"


def test_claude_session_status_reports_exhausted_api_error(tmp_path: Path) -> None:
    session = tmp_path / "session.jsonl"
    _append_jsonl(
        session,
        {
            "type": "system",
            "subtype": "api_error",
            "timestamp": "2026-07-01T00:00:00Z",
            "retryAttempt": 3,
            "maxRetries": 3,
            "cause": {"code": "model_not_found", "path": "/v1/messages"},
        },
    )

    status = read_claude_session_status(session)

    assert status.state == "api_error"
    assert status.reason == "claude_session_api_error"
    assert "error_code=model_not_found" in status.notes


def test_claude_activity_status_maps_hook_events_without_pane_text() -> None:
    tool = claude_activity_status(
        SimpleNamespace(
            state="active",
            reason="provider_PreToolUse",
            event_name="PreToolUse",
            diagnostics={"tool_name": "Bash"},
        )
    )
    waiting = claude_activity_status(
        SimpleNamespace(
            state="pending",
            reason="provider_Notification",
            event_name="Notification",
            diagnostics={},
        )
    )

    assert tool is not None
    assert tool.state == "tool_running"
    assert waiting is not None
    assert waiting.state == "waiting_for_user"


def test_claude_runtime_status_exposes_start_for_running_job_without_signal() -> None:
    session = read_claude_session_status(None)

    status = compose_claude_runtime_status(None, session, job_running=True)

    assert status.state == "start"
    assert status.reason == "prompt_submitted_waiting_for_first_signal"
    assert status.source == "stabilizer"
    assert "raw_session_reason=missing_session_path" in status.notes


def test_claude_runtime_status_treats_no_session_no_job_as_free() -> None:
    session = read_claude_session_status(None)

    status = compose_claude_runtime_status(None, session, job_running=False)

    assert status.state == "free"
    assert status.reason == "no_claude_session_no_active_turn"
    assert status.source == "runtime"


def test_claude_runtime_status_keeps_missing_bound_session_unknown(tmp_path: Path) -> None:
    session = read_claude_session_status(tmp_path / "missing.jsonl")

    status = compose_claude_runtime_status(None, session, job_running=False)

    assert status.state == "unknown"
    assert status.reason == "session_path_missing"
    assert status.source == "session"
