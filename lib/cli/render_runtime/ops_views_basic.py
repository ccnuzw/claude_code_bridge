from __future__ import annotations

from collections.abc import Mapping

from .common import render_tmux_cleanup_summaries
from .ops_views_common import binding_line


def render_config_validate(summary) -> tuple[str, ...]:
    return (
        'config_status: valid',
        f'project: {summary.project_root}',
        f'project_id: {summary.project_id}',
        f'config_source_kind: {summary.source_kind}',
        f'config_source: {summary.source or "<builtin>"}',
        f'used_builtin_default: {str(summary.used_builtin_default).lower()}',
        f'default_agents: {", ".join(summary.default_agents)}',
        f'agents: {", ".join(summary.agent_names)}',
        f'cmd_enabled: {str(summary.cmd_enabled).lower()}',
        f'layout: {summary.layout_spec}',
    )


def render_start(summary) -> tuple[str, ...]:
    lines = [
        'start_status: ok',
        f'project: {summary.project_root}',
        f'project_id: {summary.project_id}',
        f'ccbd_started: {str(summary.daemon_started).lower()}',
        f'socket_path: {summary.socket_path}',
        f'agents: {", ".join(summary.started)}',
    ]
    lines.extend(render_tmux_cleanup_summaries(getattr(summary, 'cleanup_summaries', ()) or ()))
    return tuple(lines)


def render_logs(summary) -> tuple[str, ...]:
    lines = [
        'logs_status: ok',
        f'project_id: {summary.project_id}',
        f'agent_name: {summary.agent_name}',
        f'provider: {summary.provider}',
        f'runtime_ref: {summary.runtime_ref}',
        f'session_ref: {summary.session_ref}',
        f'log_count: {len(summary.entries)}',
    ]
    if not summary.entries:
        lines.append('log: <none>')
        return tuple(lines)
    for entry in summary.entries:
        lines.append(f'log: {entry.source} {entry.path}')
        for line in entry.lines:
            lines.append(f'log_line: {line}')
    return tuple(lines)


def render_doctor_bundle(summary) -> tuple[str, ...]:
    return (
        'doctor_bundle_status: ok',
        f'project: {summary.project_root}',
        f'project_id: {summary.project_id}',
        f'bundle_id: {summary.bundle_id}',
        f'bundle_path: {summary.bundle_path}',
        f'file_count: {summary.file_count}',
        f'included_count: {summary.included_count}',
        f'missing_count: {summary.missing_count}',
        f'truncated_count: {summary.truncated_count}',
        f'doctor_error: {summary.doctor_error}',
    )


def render_cleanup(summary) -> tuple[str, ...]:
    lines = [
        f'cleanup_status: {summary.status}',
        f'project_root: {summary.project_root}',
        f'project_id: {summary.project_id}',
        f'cleanup_deleted_bytes: {summary.deleted_bytes}',
        f'cleanup_deleted_count: {summary.deleted_count}',
        f'cleanup_skipped_count: {summary.skipped_count}',
    ]
    for action in getattr(summary, 'actions', ()) or ():
        lines.append(
            'cleanup_action: '
            f'provider={action.provider} '
            f'kind={action.kind} '
            f'bytes={action.bytes_removed} '
            f'reason={action.reason} '
            f'path={action.path}'
        )
    for skipped in getattr(summary, 'skipped', ()) or ():
        lines.append(
            'cleanup_skipped: '
            f'provider={skipped.provider} '
            f'reason={skipped.reason} '
            f'path={skipped.path}'
        )
    return tuple(lines)


def render_clear(summary) -> tuple[str, ...]:
    results = tuple(summary.get('results', ()) or ()) if isinstance(summary, Mapping) else ()
    cleared_count = sum(1 for item in results if item.get('status') == 'cleared')
    skipped_count = sum(1 for item in results if item.get('status') == 'skipped')
    failed_count = sum(1 for item in results if item.get('status') == 'failed')
    lines = [
        f'clear_status: {summary.get("status", "unknown") if isinstance(summary, Mapping) else "unknown"}',
        f'cleared_count: {cleared_count}',
        f'skipped_count: {skipped_count}',
        f'failed_count: {failed_count}',
    ]
    for item in results:
        agent = str(item.get('agent') or '')
        status = str(item.get('status') or '')
        pane_id = str(item.get('pane_id') or '')
        reason = str(item.get('reason') or '')
        detail = f'agent={agent} status={status}'
        if pane_id:
            detail += f' pane_id={pane_id}'
        if reason:
            detail += f' reason={reason}'
        lines.append(f'clear_agent: {detail}')
    return tuple(lines)


def render_kill(summary) -> tuple[str, ...]:
    lines = [
        'kill_status: ok',
        f'project_id: {summary.project_id}',
        f'state: {summary.state}',
        f'socket_path: {summary.socket_path}',
        f'forced: {str(summary.forced).lower()}',
    ]
    lines.extend(render_tmux_cleanup_summaries(getattr(summary, 'cleanup_summaries', ()) or ()))
    return tuple(lines)


def render_ps(payload: Mapping[str, object]) -> tuple[str, ...]:
    lines = [
        f'project_id: {payload["project_id"]}',
        f'ccbd_state: {payload["ccbd_state"]}',
    ]
    for agent in payload['agents']:
        lines.append(
            f'agent: name={agent["agent_name"]} state={agent["state"]} provider={agent["provider"]} queue={agent["queue_depth"]}'
        )
        lines.append(binding_line(agent))
    return tuple(lines)


__all__ = [
    'render_clear',
    'render_cleanup',
    'render_config_validate',
    'render_doctor_bundle',
    'render_kill',
    'render_logs',
    'render_ps',
    'render_start',
]
