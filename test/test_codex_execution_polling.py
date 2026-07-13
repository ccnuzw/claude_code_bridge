from __future__ import annotations

from types import SimpleNamespace

from completion.models import CompletionItemKind, CompletionSourceKind
from provider_backends.codex.execution_runtime.polling import poll_submission
from provider_backends.codex.execution_runtime.polling_runtime import process_entry
from provider_backends.codex.execution_runtime.state_machine_runtime import (
    CodexPollState,
    handle_assistant_entry,
    handle_terminal_entry,
)
from provider_execution.base import ProviderSubmission


def _submission() -> ProviderSubmission:
    return ProviderSubmission(
        job_id="job_1",
        agent_name="agent1",
        provider="codex",
        accepted_at="2026-04-06T00:00:00Z",
        ready_at="2026-04-06T00:00:00Z",
        source_kind=CompletionSourceKind.SESSION_EVENT_LOG,
        reply="",
        runtime_state={"state": {}, "anchor_seen": True, "bound_turn_id": "turn-1"},
    )


def test_poll_submission_processes_entries_until_terminal(monkeypatch) -> None:
    submission = _submission()
    poll = SimpleNamespace(anchor_seen=True, reached_terminal=False)
    calls: list[tuple[str, object]] = []

    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.prepare_active_poll",
        lambda submission, now: SimpleNamespace(reader=object()),
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.build_poll_state",
        lambda submission: poll,
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.read_entries",
        lambda reader, state: (
            [
                {"role": "user", "text": "hello"},
                {"role": "assistant", "text": "answer"},
                {"role": "system", "payload_type": "task_complete"},
            ],
            {"cursor": 1},
        ),
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.apply_session_rotation",
        lambda submission, poll, new_session_path, now: calls.append(("rotate", new_session_path)),
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.state_session_path",
        lambda state: "session-1",
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.update_binding_refs",
        lambda poll, entry: calls.append(("bind", entry["role"])),
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.handle_user_entry",
        lambda submission, poll, text, now: calls.append(("user", text)),
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.handle_assistant_entry",
        lambda submission, poll, entry, now: calls.append(("assistant", entry["text"])),
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.handle_terminal_entry",
        lambda submission, poll, entry, now: calls.append(("terminal", entry["payload_type"]))
        or setattr(poll, "reached_terminal", True),
    )
    monkeypatch.setattr(
        "provider_backends.codex.execution_runtime.polling_runtime.finalize_poll_result",
        lambda submission, poll, state, now=None: {"state": state, "calls": list(calls), "now": now},
    )

    result = poll_submission(submission, now="2026-04-06T00:01:00Z")

    assert result["state"] == {"cursor": 1}
    assert result["calls"] == [
        ("rotate", "session-1"),
        ("bind", "user"),
        ("user", "hello"),
        ("bind", "assistant"),
        ("assistant", "answer"),
        ("bind", "system"),
        ("terminal", "task_complete"),
    ]


def test_handle_assistant_entry_records_final_answer() -> None:
    poll = CodexPollState(
        request_anchor="job_1",
        next_seq=1,
        anchor_seen=True,
        bound_turn_id="turn-1",
        bound_task_id="task-1",
        reply_buffer="",
        last_agent_message="",
        last_final_answer="",
        last_assistant_message="",
        last_assistant_signature="",
        session_path="/tmp/session.jsonl",
    )

    handle_assistant_entry(
        _submission(),
        poll,
        {"text": "final answer", "phase": "final_answer", "id": "evt-1"},
        now="2026-04-06T00:01:00Z",
    )

    assert poll.last_final_answer == "final answer"
    assert poll.items[0].kind is CompletionItemKind.ASSISTANT_CHUNK
    assert poll.items[0].payload["phase"] == "final_answer"
    assert poll.items[0].payload["turn_id"] == "turn-1"
    assert poll.items[0].payload["task_id"] == "task-1"


def test_handle_terminal_entry_emits_turn_aborted_payload() -> None:
    poll = CodexPollState(
        request_anchor="job_1",
        next_seq=2,
        anchor_seen=True,
        bound_turn_id="turn-1",
        bound_task_id="task-1",
        reply_buffer="partial",
        last_agent_message="",
        last_final_answer="",
        last_assistant_message="partial",
        last_assistant_signature="",
        session_path="/tmp/session.jsonl",
    )

    handle_terminal_entry(
        _submission(),
        poll,
        {"payload_type": "turn_aborted", "reason": "cancelled", "text": "user cancelled"},
        now="2026-04-06T00:01:00Z",
    )

    assert poll.reached_terminal is True
    assert poll.items[0].kind is CompletionItemKind.TURN_ABORTED
    assert poll.items[0].payload["reason"] == "cancelled"
    assert poll.items[0].payload["status"] == "cancelled"
    assert poll.items[0].payload["error_message"] == "user cancelled"


def test_codex_completion_ignores_subagent_content_and_foreign_terminal() -> None:
    poll = CodexPollState(
        request_anchor="job_1",
        next_seq=1,
        anchor_seen=False,
        bound_turn_id="",
        bound_task_id="",
        reply_buffer="",
        last_agent_message="",
        last_final_answer="",
        last_assistant_message="",
        last_assistant_signature="",
        session_path="/tmp/parent.jsonl",
    )
    submission = _submission()
    entries = [
        {"role": "system", "payload_type": "task_started", "turn_id": "historical-turn"},
        {"role": "system", "payload_type": "task_started", "turn_id": "parent-turn"},
        {"role": "user", "text": "CCB_REQ_ID: job_1\nrequest"},
        {
            "role": "assistant",
            "text": "child final must stay internal",
            "phase": "final_answer",
            "turn_id": "child-turn",
            "timestamp": "2026-04-06T00:00:01Z",
        },
        {
            "role": "system",
            "payload_type": "task_complete",
            "turn_id": "child-turn",
            "last_agent_message": "child final must stay internal",
        },
        {
            "role": "assistant",
            "text": "parent synthesized answer",
            "phase": "final_answer",
            "turn_id": "parent-turn",
            "timestamp": "2026-04-06T00:00:02Z",
        },
        {
            "role": "system",
            "payload_type": "task_complete",
            "turn_id": "parent-turn",
            "last_agent_message": "parent synthesized answer",
        },
    ]
    for entry in entries:
        process_entry(submission, poll, entry, now="2026-04-06T00:01:00Z")

    assert poll.bound_turn_id == "parent-turn"
    assert poll.reached_terminal is True
    assert poll.reply_buffer == "parent synthesized answer"
    assert all("child final" not in str(item.payload) for item in poll.items)
    assert poll.items[-1].kind is CompletionItemKind.TURN_BOUNDARY
    assert poll.items[-1].payload["last_agent_message"] == "parent synthesized answer"
