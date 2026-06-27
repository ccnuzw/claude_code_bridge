from __future__ import annotations

import json
from pathlib import Path

from agents.models import (
    AgentSpec,
    LayoutLeaf,
    LayoutNode,
    PermissionMode,
    ProjectConfig,
    QueuePolicy,
    RestoreMode,
    RuntimeMode,
    WorkspaceMode,
    WindowSpec,
    normalize_agent_name,
    parse_layout_spec,
)
from storage.paths import PathLayout

from .common import ConfigValidationError


def apply_loop_capacity_overlays(config: ProjectConfig, project_root: Path) -> ProjectConfig:
    states = _active_loop_capacity_states(project_root)
    if not states:
        return config
    generated_specs: dict[str, AgentSpec] = {}
    generated_order: list[str] = []
    for state_path, state in states:
        for agent in _active_agents_from_state(state_path, state):
            spec = _agent_spec_from_record(agent)
            if spec.name in config.agents:
                raise ConfigValidationError(
                    f'{state_path}: loop generated agent {spec.name!r} conflicts with configured agent'
                )
            if spec.name in generated_specs:
                raise ConfigValidationError(
                    f'{state_path}: duplicate loop generated agent {spec.name!r} across active loop capacity states'
                )
            generated_specs[spec.name] = spec
            generated_order.append(spec.name)
    if not generated_specs:
        return config
    agents = dict(config.agents)
    agents.update(generated_specs)
    if getattr(config, 'windows_explicit', False):
        windows = _append_agents_to_entry_window(config, generated_order, agents=agents)
        return _copy_config(config, agents=agents, default_agents=config.default_agents, windows=windows)
    default_agents = (*tuple(config.default_agents), *tuple(generated_order))
    layout_spec = _append_agents_to_layout(config.layout_spec, generated_order, agents)
    return _copy_config(config, agents=agents, default_agents=default_agents, layout_spec=layout_spec)


def _active_loop_capacity_states(project_root: Path) -> tuple[tuple[Path, dict[str, object]], ...]:
    loops_dir = PathLayout(project_root).runtime_state_root / 'runtime' / 'loops'
    if not loops_dir.is_dir():
        return ()
    states: list[tuple[Path, dict[str, object]]] = []
    for state_path in sorted(loops_dir.glob('*/capacity.json')):
        try:
            payload = json.loads(state_path.read_text(encoding='utf-8'))
        except Exception as exc:
            raise ConfigValidationError(f'{state_path}: invalid loop capacity state: {exc}') from exc
        if not isinstance(payload, dict):
            raise ConfigValidationError(f'{state_path}: loop capacity state must be a JSON object')
        if str(payload.get('loop_capacity_status') or '') != 'ensured':
            continue
        states.append((state_path, dict(payload)))
    return tuple(states)


def _active_agents_from_state(state_path: Path, state: dict[str, object]) -> tuple[dict[str, object], ...]:
    agents = state.get('agents')
    if not isinstance(agents, list):
        raise ConfigValidationError(f'{state_path}: loop capacity state agents must be a list')
    active: list[dict[str, object]] = []
    for raw_agent in agents:
        if not isinstance(raw_agent, dict):
            raise ConfigValidationError(f'{state_path}: loop capacity state agent entries must be objects')
        agent = dict(raw_agent)
        if str(agent.get('state') or '') == 'released':
            continue
        active.append(agent)
    return tuple(active)


def _agent_spec_from_record(agent: dict[str, object]) -> AgentSpec:
    return AgentSpec(
        name=normalize_agent_name(str(agent.get('name') or '')),
        provider=str(agent.get('provider') or ''),
        target='.',
        workspace_mode=WorkspaceMode(str(agent.get('workspace_mode') or WorkspaceMode.INPLACE.value)),
        workspace_root=None,
        workspace_path=None,
        workspace_group=_optional_string(agent.get('workspace_group')),
        runtime_mode=RuntimeMode.PANE_BACKED,
        restore_default=RestoreMode.AUTO,
        permission_default=PermissionMode.MANUAL,
        queue_policy=QueuePolicy.SERIAL_PER_AGENT,
        model=_optional_string(agent.get('model')),
        startup_args=tuple(str(item) for item in tuple(agent.get('startup_args') or ())),
        provider_profile=dict(agent.get('provider_profile') or {}),
        role=_optional_string(agent.get('role')),
        labels=('ccb-loop', f'loop-profile:{agent.get("profile") or ""}'),
        description='CCB loop capacity generated agent',
    )


def _optional_string(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _append_agents_to_layout(layout_spec: str | None, agent_names: list[str], agents: dict[str, AgentSpec]) -> str:
    if not agent_names:
        return str(layout_spec or '')
    node = parse_layout_spec(str(layout_spec or ''))
    for agent_name in agent_names:
        spec = agents[agent_name]
        node = _append_layout_leaf(node, agent_name, provider=spec.provider, workspace_mode=spec.workspace_mode.value)
    return node.render()


def _append_layout_leaf(node, agent_name: str, *, provider: str, workspace_mode: str):
    leaf = _layout_leaf(agent_name, provider=provider, workspace_mode=workspace_mode)
    if node.kind == 'leaf':
        return LayoutNode(kind='horizontal', left=node, right=leaf)
    assert node.left is not None
    assert node.right is not None
    return LayoutNode(
        kind=node.kind,
        left=node.left,
        right=_append_layout_leaf(node.right, agent_name, provider=provider, workspace_mode=workspace_mode),
    )


def _layout_leaf(agent_name: str, *, provider: str, workspace_mode: str):
    return LayoutNode(
        kind='leaf',
        leaf=LayoutLeaf(
            name=agent_name,
            provider=provider,
            workspace_mode='worktree' if workspace_mode == WorkspaceMode.GIT_WORKTREE.value else None,
        ),
    )


def _append_agents_to_entry_window(
    config: ProjectConfig,
    agent_names: list[str],
    *,
    agents: dict[str, AgentSpec],
) -> tuple[WindowSpec, ...]:
    entry = str(config.entry_window or '')
    windows: list[WindowSpec] = []
    matched = False
    for window in tuple(config.windows or ()):
        if window.name != entry:
            windows.append(window)
            continue
        matched = True
        layout_spec = _append_agents_to_layout(window.layout_spec, agent_names, agents)
        windows.append(
            WindowSpec(
                name=window.name,
                order=window.order,
                layout_spec=layout_spec,
                agent_names=(*window.agent_names, *tuple(agent_names)),
                tool_names=window.tool_names,
            )
        )
    if not matched:
        raise ConfigValidationError('loop capacity overlay could not find entry window for generated agents')
    return tuple(windows)


def _copy_config(
    config: ProjectConfig,
    *,
    agents: dict[str, AgentSpec],
    default_agents: tuple[str, ...],
    layout_spec: str | None = None,
    windows: tuple[WindowSpec, ...] | None = None,
) -> ProjectConfig:
    return ProjectConfig(
        version=config.version,
        default_agents=default_agents,
        agents=agents,
        cmd_enabled=config.cmd_enabled,
        layout_spec=layout_spec if layout_spec is not None else config.layout_spec,
        windows=windows if windows is not None else (config.windows if getattr(config, 'windows_explicit', False) else None),
        tool_windows=config.tool_windows,
        entry_window=config.entry_window,
        sidebar=config.sidebar,
        sidebar_view=config.sidebar_view,
        source_path=config.source_path,
        windows_explicit=config.windows_explicit,
        maintenance_heartbeat=config.maintenance_heartbeat,
        loop_capacity=config.loop_capacity,
    )


__all__ = ['apply_loop_capacity_overlays']
