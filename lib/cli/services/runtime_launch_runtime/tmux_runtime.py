from __future__ import annotations

from pathlib import Path
from time import monotonic_ns

from terminal_runtime.tmux_identity import apply_ccb_pane_identity

from .tmux_backend import prepared_state, run_cwd, tmux_backend
from .tmux_panes import (
    best_effort_kill_tmux_pane,
    create_detached_tmux_pane,
    launch_pane,
    pane_meets_minimum_size,
    prepare_detached_tmux_server,
)


def launch_tmux_runtime(
    context,
    command,
    spec,
    plan,
    launcher,
    *,
    backend_factory,
    pane_title_marker_fn,
    launch_session_id_fn,
    create_detached_tmux_pane_fn,
    pane_meets_minimum_size_fn,
    best_effort_kill_tmux_pane_fn,
    write_session_file_fn,
    assigned_pane_id: str | None = None,
    style_index: int = 0,
    tmux_socket_path: str | None = None,
    allow_detached_fallback: bool = True,
) -> dict[str, float]:
    launch_started_ns = monotonic_ns()
    timings_ms: dict[str, float] = {}
    try:
        stage_started_ns = monotonic_ns()
        try:
            runtime_dir = context.paths.agent_dir(spec.name) / 'provider-runtime' / spec.provider
            runtime_dir.mkdir(parents=True, exist_ok=True)
            launch_session_id = launch_session_id_fn(spec.name)
            prepared = prepared_state(launcher, runtime_dir)
            runtime_cwd = run_cwd(
                launcher,
                command=command,
                spec=spec,
                plan=plan,
                runtime_dir=runtime_dir,
                launch_session_id=launch_session_id,
            )
            prepared['run_cwd'] = str(runtime_cwd)
            if launcher.prepare_launch_context is not None:
                prepared = dict(
                    launcher.prepare_launch_context(context, spec, plan, runtime_dir, prepared)
                    or prepared
                )
        finally:
            _record_elapsed_ms(timings_ms, 'prepare_launch_context', stage_started_ns)
        backend = tmux_backend(backend_factory, tmux_socket_path)
        pane_title_marker = pane_title_marker_fn(context, spec)

        stage_started_ns = monotonic_ns()
        try:
            start_cmd = launcher.build_start_cmd(
                command,
                spec,
                runtime_dir,
                launch_session_id,
                prepared_state=prepared,
            )
        finally:
            _record_elapsed_ms(timings_ms, 'build_start_cmd', stage_started_ns)

        stage_started_ns = monotonic_ns()
        try:
            pane_id = launch_pane(
                backend,
                spec_name=spec.name,
                assigned_pane_id=assigned_pane_id,
                start_cmd=start_cmd,
                run_cwd=runtime_cwd,
                create_detached_tmux_pane_fn=create_detached_tmux_pane_fn,
                pane_meets_minimum_size_fn=pane_meets_minimum_size_fn,
                best_effort_kill_tmux_pane_fn=best_effort_kill_tmux_pane_fn,
                allow_detached_fallback=allow_detached_fallback,
            )
        finally:
            _record_elapsed_ms(timings_ms, 'tmux_respawn', stage_started_ns)

        stage_started_ns = monotonic_ns()
        try:
            apply_ccb_pane_identity(
                backend,
                pane_id,
                title=spec.name,
                agent_label=spec.name,
                project_id=context.project.project_id,
                order_index=style_index,
                slot_key=spec.name,
                session_id=launch_session_id,
            )
        finally:
            _record_elapsed_ms(timings_ms, 'pane_identity', stage_started_ns)

        stage_started_ns = monotonic_ns()
        try:
            provider_payload = launcher.build_session_payload(
                context=context,
                spec=spec,
                plan=plan,
                runtime_dir=runtime_dir,
                run_cwd=runtime_cwd,
                pane_id=pane_id,
                pane_title_marker=pane_title_marker,
                start_cmd=start_cmd,
                launch_session_id=launch_session_id,
                prepared_state=prepared,
            )
            write_session_file_fn(
                context=context,
                spec=spec,
                plan=plan,
                runtime_dir=runtime_dir,
                run_cwd=runtime_cwd,
                pane_id=pane_id,
                tmux_socket_name=str(getattr(backend, '_socket_name', '') or '').strip() or None,
                tmux_socket_path=str(getattr(backend, '_socket_path', '') or '').strip() or None,
                pane_title_marker=pane_title_marker,
                start_cmd=start_cmd,
                launch_session_id=launch_session_id,
                provider_payload=provider_payload,
            )
        finally:
            _record_elapsed_ms(timings_ms, 'session_write', stage_started_ns)
        if launcher.post_launch is not None:
            stage_started_ns = monotonic_ns()
            try:
                launcher.post_launch(
                    backend,
                    pane_id,
                    runtime_dir,
                    launch_session_id,
                    prepared,
                )
            finally:
                _record_elapsed_ms(timings_ms, 'provider_post_launch', stage_started_ns)
    except Exception as exc:
        _finish_launch_timings(timings_ms, launch_started_ns)
        _attach_startup_timings(exc, timings_ms)
        raise
    _finish_launch_timings(timings_ms, launch_started_ns)
    return timings_ms


def _record_elapsed_ms(timings_ms: dict[str, float], field_name: str, started_ns: int) -> None:
    elapsed_ms = max(0.0, (monotonic_ns() - started_ns) / 1_000_000)
    timings_ms[field_name] = timings_ms.get(field_name, 0.0) + elapsed_ms


def _finish_launch_timings(timings_ms: dict[str, float], launch_started_ns: int) -> None:
    total_ms = max(0.0, (monotonic_ns() - launch_started_ns) / 1_000_000)
    measured_ms = sum(timings_ms.values())
    timings_ms['unattributed'] = timings_ms.get('unattributed', 0.0) + max(
        0.0,
        total_ms - measured_ms,
    )


def _attach_startup_timings(exc: Exception, timings_ms: dict[str, float]) -> None:
    try:
        setattr(exc, 'ccb_startup_timings_ms', dict(timings_ms))
    except Exception:
        return


__all__ = [
    'best_effort_kill_tmux_pane',
    'create_detached_tmux_pane',
    'launch_tmux_runtime',
    'pane_meets_minimum_size',
    'prepare_detached_tmux_server',
]
