from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from provider_backends.native_cli_support import (
    NativeCliExecutionConfig,
    NativeCliExecutionRequest,
    NativeCliObservation,
    NativeCliSubprocessAdapter,
)
from provider_core.runtime_shared import provider_start_parts


def build_execution_adapter() -> NativeCliSubprocessAdapter:
    return NativeCliSubprocessAdapter(
        NativeCliExecutionConfig(
            provider="grok",
            session_filename=".grok-session",
            command_builder=_build_command,
            env_builder=None,
            observer=observe_grok_output,
            output_kind="stdout",
            mode="grok_run",
            start_failed_reason="grok_run_start_failed",
            failed_reason="grok_run_failed",
            empty_reason="grok_empty_reply",
            run_error_reason="grok_run_error",
            complete_reason="grok_run_stop",
            process_exit_complete_reason="grok_run_exit",
            timeout_reason="grok_run_timeout",
        )
    )


def _build_command(request: NativeCliExecutionRequest) -> list[str]:
    # grok headless single-turn: prints one aggregated JSON object to stdout and exits.
    #   { "text": ..., "stopReason": ..., "sessionId": ..., "requestId": ..., "thought": ... }
    cmd = [
        *provider_start_parts("grok"),
        "-p",
        request.prompt,
        "--cwd",
        str(request.work_dir),
        "--output-format",
        "json",
    ]
    # Fast-review knob: let the ask/headless path run a lighter model/effort than
    # the interactive pane's default (grok-4.5 xhigh). E.g. grok-composer-2.5-fast.
    # session_data wins over env so a future launcher change can make it per-agent;
    # env (CCB_GROK_MODEL / CCB_GROK_EFFORT) works today. Unset → grok's own default.
    model = _setting(request, "grok_model", "CCB_GROK_MODEL")
    if model:
        cmd += ["-m", model]
    effort = _setting(request, "grok_effort", "CCB_GROK_EFFORT")
    if effort:
        cmd += ["--reasoning-effort", effort]
    return cmd


def _setting(request: NativeCliExecutionRequest, session_key: str, env_key: str) -> str | None:
    val = str(request.session_data.get(session_key) or "").strip()
    if val:
        return val
    return str(os.environ.get(env_key) or "").strip() or None


def observe_grok_output(path: Path) -> NativeCliObservation:
    if not path or not path.is_file():
        return NativeCliObservation()
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return NativeCliObservation(error=f"read_stdout_failed:{exc}")

    stripped = raw.strip()
    if not stripped:
        # Process has not flushed the final JSON object yet; keep waiting.
        return NativeCliObservation()

    try:
        obj = json.loads(stripped)
    except json.JSONDecodeError:
        # Partial write mid-run, or non-JSON diagnostic noise on stdout.
        # Return empty so polling keeps waiting for the terminal flush; the
        # process-exit path decides completion once the file is whole.
        return NativeCliObservation()

    if not isinstance(obj, dict):
        return NativeCliObservation()

    text = _coerce_text(obj.get("text")).strip()
    turn_ref = _first_str(obj, ("requestId", "sessionId"))
    stop_reason = _coerce_text(obj.get("stopReason")).strip()

    error = ""
    err_field = obj.get("error")
    if err_field:
        error = _coerce_text(err_field).strip() or "grok_error"
    elif not text and stop_reason and stop_reason.lower() not in {"endturn", "end_turn", "stop", "done"}:
        # Terminated without a reply for a non-normal reason (e.g. refusal, cap).
        error = f"grok_stop_{stop_reason.lower()}"

    return NativeCliObservation(
        text=text,
        turn_ref=turn_ref,
        completed_at=None,
        error=error,
    )


def _coerce_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "".join(_coerce_text(item) for item in value)
    if isinstance(value, dict):
        for key in ("text", "content", "value", "message", "reply", "answer", "output", "response"):
            nested = value.get(key)
            text = _coerce_text(nested)
            if text:
                return text
        return ""
    if value is None:
        return ""
    return str(value)


def _first_str(obj: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        raw = obj.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


__all__ = ["build_execution_adapter", "observe_grok_output"]
