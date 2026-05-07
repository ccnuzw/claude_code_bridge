from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from storage.paths import PathLayout


def test_path_layout_uses_project_scoped_locations(tmp_path: Path) -> None:
    layout = PathLayout(tmp_path / 'repo')
    assert layout.ccb_dir == (tmp_path / 'repo' / '.ccb').resolve()
    assert layout.project_anchor_dir == layout.ccb_dir
    assert layout.runtime_state_root == layout.ccb_dir
    assert layout.runtime_state_placement.root_kind == 'project'
    assert layout.runtime_marker_status == 'not_required'
    assert layout.config_path == layout.ccb_dir / 'ccb.config'
    assert layout.ccbd_lifecycle_path == layout.ccb_dir / 'ccbd' / 'lifecycle.json'
    assert layout.ccbd_lease_path == layout.ccb_dir / 'ccbd' / 'lease.json'
    assert layout.ccbd_socket_path.name in {'ccbd.sock', f'ccbd-{layout.project_socket_key}.sock'}
    assert len(os.fsencode(str(layout.ccbd_socket_path))) <= 100
    assert layout.ccbd_state_path == layout.ccb_dir / 'ccbd' / 'state.json'
    assert layout.ccbd_start_policy_path == layout.ccb_dir / 'ccbd' / 'start-policy.json'
    assert layout.ccbd_startup_report_path == layout.ccb_dir / 'ccbd' / 'startup-report.json'
    assert layout.ccbd_shutdown_report_path == layout.ccb_dir / 'ccbd' / 'shutdown-report.json'
    assert layout.ccbd_tmux_socket_path.name in {'tmux.sock', f'tmux-{layout.project_socket_key}.sock'}
    assert len(os.fsencode(str(layout.ccbd_tmux_socket_path))) <= 100
    assert layout.ccbd_tmux_session_name == f'ccb-{layout.project_slug}'
    assert layout.ccbd_lifecycle_log_path == layout.ccb_dir / 'ccbd' / 'lifecycle.jsonl'
    assert layout.ccbd_support_dir == layout.ccb_dir / 'ccbd' / 'support'
    assert layout.ccbd_keeper_path == layout.ccb_dir / 'ccbd' / 'keeper.json'
    assert layout.ccbd_shutdown_intent_path == layout.ccb_dir / 'ccbd' / 'shutdown-intent.json'
    assert layout.agent_mailbox_path('Agent1') == layout.ccb_dir / 'ccbd' / 'mailboxes' / 'agent1' / 'mailbox.json'
    assert layout.agent_inbox_path('Agent1') == layout.ccb_dir / 'ccbd' / 'mailboxes' / 'agent1' / 'inbox.jsonl'
    assert layout.ccbd_messages_path == layout.ccb_dir / 'ccbd' / 'messages' / 'messages.jsonl'
    assert layout.ccbd_attempts_path == layout.ccb_dir / 'ccbd' / 'attempts' / 'attempts.jsonl'
    assert layout.ccbd_replies_path == layout.ccb_dir / 'ccbd' / 'replies' / 'replies.jsonl'
    assert layout.mailbox_lease_path('Agent1') == layout.ccb_dir / 'ccbd' / 'leases' / 'agent1.json'
    assert layout.provider_health_path('job-1') == layout.ccb_dir / 'ccbd' / 'provider-health' / 'job-1.jsonl'
    assert layout.agent_runtime_path('Agent1') == layout.ccb_dir / 'agents' / 'agent1' / 'runtime.json'
    assert layout.agent_provider_state_dir('Agent1', 'CoDeX') == layout.ccb_dir / 'agents' / 'agent1' / 'provider-state' / 'codex'
    assert layout.snapshot_path('job-1') == layout.ccb_dir / 'ccbd' / 'snapshots' / 'job-1.json'
    assert layout.cursor_path('job-1') == layout.ccb_dir / 'ccbd' / 'cursors' / 'job-1.json'
    assert layout.support_bundle_path('bundle-1') == layout.ccb_dir / 'ccbd' / 'support' / 'bundle-1.tar.gz'
    assert layout.workspace_path('Agent1') == layout.ccb_dir / 'workspaces' / 'agent1'
    assert layout.provider_profiles_dir == layout.ccb_dir / 'provider-profiles'


def test_path_layout_supports_external_workspace_root(tmp_path: Path) -> None:
    layout = PathLayout(tmp_path / 'repo')
    external = tmp_path / 'external-workspaces'
    workspace = layout.workspace_path('agent1', workspace_root=str(external))
    assert workspace == external / layout.project_slug / 'agent1'
    assert layout.workspace_binding_path('agent1', workspace_root=str(external)).name == '.ccb-workspace.json'


def test_path_layout_shortens_socket_paths_when_project_path_is_too_long(tmp_path: Path) -> None:
    project_root = tmp_path / ('very-long-project-name-' * 4) / ('nested-segment-' * 4) / 'repo'
    layout = PathLayout(project_root)

    assert layout.ccbd_socket_path.name == f'ccbd-{layout.project_socket_key}.sock'
    assert layout.ccbd_tmux_socket_path.name == f'tmux-{layout.project_socket_key}.sock'
    assert '.ccb/ccbd' not in str(layout.ccbd_socket_path)
    assert '.ccb/ccbd' not in str(layout.ccbd_tmux_socket_path)
    assert len(os.fsencode(str(layout.ccbd_socket_path))) <= 100
    assert len(os.fsencode(str(layout.ccbd_tmux_socket_path))) <= 100


def test_path_layout_falls_back_for_wsl_mounted_drive_paths(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv('WSL_INTEROP', '1')
    monkeypatch.setenv('XDG_RUNTIME_DIR', '/mnt/e/runtime')
    monkeypatch.setenv('XDG_STATE_HOME', str(tmp_path / 'state'))

    layout = PathLayout(Path('/mnt/c/Users/demo/repo'))

    assert layout.runtime_state_placement.root_kind == 'relocated'
    assert layout.runtime_state_placement.relocation_reason == 'wsl_drvfs'
    assert layout.runtime_state_root == (tmp_path / 'state' / 'ccb' / 'projects' / layout.project_id)
    assert layout.ccbd_dir == layout.runtime_state_root / 'ccbd'
    assert layout.agents_dir == layout.runtime_state_root / 'agents'
    assert layout.config_path == Path('/mnt/c/Users/demo/repo/.ccb/ccb.config')
    assert layout.workspaces_dir == Path('/mnt/c/Users/demo/repo/.ccb/workspaces')
    assert layout.ccbd_socket_placement.root_kind == 'runtime'
    assert layout.ccbd_socket_placement.fallback_reason == 'unsupported_filesystem'
    assert layout.ccbd_socket_placement.filesystem_hint == 'wsl_drvfs'
    assert str(layout.ccbd_socket_path).startswith('/tmp/ccb-runtime/')
    assert layout.ccbd_tmux_socket_placement.root_kind == 'runtime'
    assert layout.ccbd_tmux_socket_placement.fallback_reason == 'unsupported_filesystem'
    assert layout.ccbd_tmux_socket_placement.filesystem_hint == 'wsl_drvfs'
    assert str(layout.ccbd_tmux_socket_path).startswith('/tmp/ccb-runtime/')


def test_path_layout_uses_anchor_ref_for_relocated_runtime(tmp_path: Path) -> None:
    project_root = tmp_path / 'repo-ref'
    layout = PathLayout(project_root)
    relocated_root = tmp_path / 'state-root'
    layout.ccb_dir.mkdir(parents=True, exist_ok=True)
    layout.runtime_root_ref_path.write_text(
        '{"schema_version":1,"record_type":"ccb_runtime_root_ref","project_id":"'
        + layout.project_id
        + '","runtime_state_root":"'
        + str(relocated_root)
        + '","created_at":"2026-05-07T00:00:00Z"}',
        encoding='utf-8',
    )

    relocated = PathLayout(project_root)

    assert relocated.runtime_state_placement.root_kind == 'relocated'
    assert relocated.runtime_state_placement.relocation_reason == 'runtime_root_ref'
    assert relocated.runtime_state_root == relocated_root
    assert relocated.ccbd_dir == relocated_root / 'ccbd'
    assert relocated.agents_dir == relocated_root / 'agents'
    assert relocated.runtime_marker_status == 'missing'


def test_storage_paths_and_project_runtime_paths_import_without_cycle() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    completed = subprocess.run(
        [
            sys.executable,
            '-c',
            (
                'from storage.paths import PathLayout; '
                'from project.runtime_paths import project_ccbd_dir; '
                'print(PathLayout); print(project_ccbd_dir)'
            ),
        ],
        cwd=repo_root,
        env={**os.environ, 'PYTHONPATH': str(repo_root / 'lib')},
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=10,
    )

    assert completed.returncode == 0, completed.stderr
