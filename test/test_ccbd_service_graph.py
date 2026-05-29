from __future__ import annotations

from pathlib import Path

from agents.config_loader import load_project_config
from agents.store import AgentRestoreStore
from ccbd.app import CcbdApp
from ccbd.app_runtime.service_graph import CcbdServiceGraphDependencies, build_ccbd_service_graph
from ccbd.lifecycle_report_store import CcbdShutdownReportStore, CcbdStartupReportStore
from ccbd.metrics import ControlPlaneMetrics
from ccbd.project_view import ProjectViewStateStore
from ccbd.services import CcbdLifecycleStore, MountManager, OwnershipGuard, SnapshotWriter
from ccbd.services.project_namespace import ProjectNamespaceController
from ccbd.services.project_namespace_state import ProjectNamespaceStateStore
from ccbd.services.start_policy import CcbdStartPolicyStore
from fault_injection import FaultInjectionService
from project.ids import compute_project_id
from provider_core.catalog import build_default_provider_catalog
from provider_execution.registry import build_default_execution_registry
from provider_execution.service import ExecutionService
from provider_execution.state_store import ExecutionStateStore
from storage.paths import PathLayout

NOW = '2026-05-29T00:00:00Z'


def test_service_graph_can_be_built_twice_without_writing_runtime_authority(tmp_path: Path) -> None:
    project_root = _project(tmp_path / 'repo-build-twice')
    paths = PathLayout(project_root)
    paths.ensure_runtime_state_root(created_at=NOW)
    config = load_project_config(project_root).config
    project_id = compute_project_id(project_root)
    provider_catalog = build_default_provider_catalog()
    mount_manager = MountManager(paths, clock=lambda: NOW)
    lifecycle_store = CcbdLifecycleStore(paths)
    restore_store = AgentRestoreStore(paths)
    startup_report_store = CcbdStartupReportStore(paths)
    shutdown_report_store = CcbdShutdownReportStore(paths)
    namespace_state_store = ProjectNamespaceStateStore(paths)
    project_view_state_store = ProjectViewStateStore(paths, project_id=project_id)
    start_policy_store = CcbdStartPolicyStore(paths)
    ownership_guard = OwnershipGuard(paths, mount_manager, clock=lambda: NOW)
    project_namespace = ProjectNamespaceController(paths, project_id, clock=lambda: NOW)
    execution_service = ExecutionService(
        build_default_execution_registry(),
        clock=lambda: NOW,
        state_store=ExecutionStateStore(paths),
        fault_injection=FaultInjectionService(paths, clock=lambda: NOW),
    )
    snapshot_writer = SnapshotWriter(paths, clock=lambda: NOW)
    metrics = ControlPlaneMetrics()

    def _deps(version: int) -> CcbdServiceGraphDependencies:
        return CcbdServiceGraphDependencies(
            project_root=project_root,
            project_id=project_id,
            paths=paths,
            config=config,
            provider_catalog=provider_catalog,
            mount_manager=mount_manager,
            lifecycle_store=lifecycle_store,
            restore_store=restore_store,
            namespace_state_store=namespace_state_store,
            project_view_state_store=project_view_state_store,
            project_namespace=project_namespace,
            ownership_guard=ownership_guard,
            startup_report_store=startup_report_store,
            shutdown_report_store=shutdown_report_store,
            start_policy_store=start_policy_store,
            execution_service=execution_service,
            snapshot_writer=snapshot_writer,
            control_plane_metrics=metrics,
            clock=lambda: NOW,
            request_timeout_s=0.0,
            daemon_generation_getter=lambda: None,
            mount_missing_runtime_fn=lambda _agent_name: False,
            supervision_suspended_fn=lambda: False,
            version=version,
        )

    graph1 = build_ccbd_service_graph(_deps(1))
    graph2 = build_ccbd_service_graph(_deps(2))

    assert graph1 is not graph2
    assert graph1.version == 1
    assert graph2.version == 2
    assert graph1.created_at == NOW
    assert graph2.created_at == NOW
    assert graph1.config_identity == graph2.config_identity
    assert graph1.registry is not graph2.registry
    assert graph1.runtime_service is not graph2.runtime_service
    assert graph1.runtime_supervisor._mount_manager is mount_manager
    assert graph1.runtime_supervisor._ownership_guard is ownership_guard
    assert graph1.runtime_supervisor._startup_report_store is startup_report_store
    assert graph1.dispatcher._execution_service is execution_service
    assert graph1.dispatcher._snapshot_writer is snapshot_writer
    assert graph1.project_view_service._deps.mount_manager is mount_manager
    assert graph1.project_view_service._deps.namespace_controller is project_namespace
    assert graph1.project_focus_service._deps.project_view_service is graph1.project_view_service
    assert graph1.health_monitor._ownership_guard is ownership_guard
    assert graph1.ping_payload_services.config is graph1.config
    assert graph1.ping_payload_services.registry is graph1.registry
    assert graph1.ping_payload_services.health_monitor is graph1.health_monitor
    assert not paths.agent_runtime_path('alpha').exists()
    assert not paths.agent_runtime_path('beta').exists()


def test_ccbd_app_bootstrap_publishes_startup_graph_fields(tmp_path: Path) -> None:
    project_root = _project(tmp_path / 'repo-app-bootstrap')

    app = CcbdApp(project_root, clock=lambda: NOW, pid=4242)

    assert app.service_graph.version == 1
    assert app.service_graph.created_at == NOW
    assert app.config is app.service_graph.config
    assert app.config_identity is app.service_graph.config_identity
    assert app.registry is app.service_graph.registry
    assert app.runtime_service is app.service_graph.runtime_service
    assert app.runtime_supervisor is app.service_graph.runtime_supervisor
    assert app.runtime_supervision is app.service_graph.runtime_supervision
    assert app.completion_tracker is app.service_graph.completion_tracker
    assert app.dispatcher is app.service_graph.dispatcher
    assert app.project_view_service is app.service_graph.project_view_service
    assert app.project_focus_service is app.service_graph.project_focus_service
    assert app.health_monitor is app.service_graph.health_monitor
    assert app.runtime_supervisor._mount_manager is app.mount_manager
    assert app.runtime_supervisor._ownership_guard is app.ownership_guard
    assert app.control_plane_metrics.service_graph_version == 1
    assert app.control_plane_metrics.service_graph_created_at == NOW
    assert app.control_plane_metrics.service_graph_retained_count == 1
    assert {'submit', 'project_view', 'project_focus_agent', 'ping'} <= set(app.socket_server._handlers)


def _project(project_root: Path) -> Path:
    config_dir = project_root / '.ccb'
    config_dir.mkdir(parents=True, exist_ok=True)
    (config_dir / 'ccb.config').write_text('alpha:codex, beta:claude\n', encoding='utf-8')
    return project_root
