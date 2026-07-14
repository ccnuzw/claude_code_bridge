from __future__ import annotations

from pathlib import Path

from ccbd.api_models import DeliveryScope, JobRecord, JobStatus, MessageEnvelope
from provider_backends.native_cli_support import NativeCliExecutionRequest
from provider_backends.omp.launcher import _omp_visible_args
from provider_backends.omp.execution import _build_command


def _request(tmp_path: Path) -> NativeCliExecutionRequest:
    job = JobRecord(
        job_id="job_omp_contract",
        submission_id="sub_omp",
        agent_name="omp1",
        provider="omp",
        request=MessageEnvelope(
            project_id="project",
            to_agent="omp1",
            from_actor="main",
            body="Reply with exactly: READY",
            task_id=None,
            reply_to=None,
            message_type="ask",
            delivery_scope=DeliveryScope.SINGLE,
        ),
        status=JobStatus.RUNNING,
        terminal_decision=None,
        cancel_requested_at=None,
        created_at="2026-07-14T00:00:00Z",
        updated_at="2026-07-14T00:00:00Z",
        workspace_path=str(tmp_path),
    )
    return NativeCliExecutionRequest(
        provider="omp",
        job=job,
        work_dir=tmp_path,
        prompt="Reply with exactly: READY",
        session_data={"omp_state_dir": str(tmp_path / ".ccb" / "omp")},
        request_anchor="req_omp_contract",
    )


def test_omp_command_uses_supported_structured_cli_contract(tmp_path: Path) -> None:
    command = _build_command(_request(tmp_path))

    assert command[1:] == [
        "--mode",
        "json",
        "--session-dir",
        str(tmp_path / ".ccb" / "omp" / "sessions"),
        "--approval-mode",
        "yolo",
        "--print",
        "Reply with exactly: READY",
    ]
    assert "--name" not in command
    assert "--no-approve" not in command


def test_omp_visible_launch_uses_provider_state_session_dir(tmp_path: Path) -> None:
    assert _omp_visible_args({"omp_state_dir": str(tmp_path / "provider-state")}) == (
        "--session-dir",
        str(tmp_path / "provider-state" / "sessions"),
    )
