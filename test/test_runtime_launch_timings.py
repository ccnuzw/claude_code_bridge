from __future__ import annotations

from dataclasses import dataclass
import math
from pathlib import Path
from types import SimpleNamespace

import pytest

from agents.models import RuntimeMode
from cli.services.runtime_launch import RuntimeLaunchResult
import cli.services.runtime_launch_runtime.ensure as ensure_runtime
import cli.services.runtime_launch_runtime.tmux_runtime as tmux_runtime


class _Clock:
    def __init__(self) -> None:
        self.now_ns = 0

    def monotonic_ns(self) -> int:
        return self.now_ns

    def advance_ms(self, value: int) -> None:
        self.now_ns += value * 1_000_000


def _launch_with_clock(
    tmp_path: Path,
    monkeypatch,
    *,
    fail_post_launch: bool = False,
) -> dict[str, float]:
    clock = _Clock()
    monkeypatch.setattr(tmux_runtime, 'monotonic_ns', clock.monotonic_ns)

    class Backend:
        _socket_name = 'ccb-test'
        _socket_path = '/tmp/ccb-test.sock'

        def respawn_pane(self, pane_id, *, cmd, cwd, remain_on_exit):
            del pane_id, cmd, cwd, remain_on_exit
            clock.advance_ms(11)

    def prepare_runtime(runtime_dir):
        del runtime_dir
        clock.advance_ms(2)
        return {'prepared': True}

    def resolve_run_cwd(command, spec, plan, runtime_dir, launch_session_id):
        del command, spec, runtime_dir, launch_session_id
        clock.advance_ms(3)
        return plan.workspace_path

    def prepare_launch_context(context, spec, plan, runtime_dir, prepared_state):
        del context, spec, plan, runtime_dir
        clock.advance_ms(5)
        return prepared_state

    def build_start_cmd(command, spec, runtime_dir, launch_session_id, *, prepared_state):
        del command, spec, runtime_dir, launch_session_id, prepared_state
        clock.advance_ms(7)
        return 'provider start'

    def build_session_payload(**kwargs):
        del kwargs
        clock.advance_ms(17)
        return {'provider': 'codex'}

    def post_launch(*args):
        del args
        clock.advance_ms(23)
        if fail_post_launch:
            raise RuntimeError('post launch failed')

    launcher = SimpleNamespace(
        prepare_runtime=prepare_runtime,
        resolve_run_cwd=resolve_run_cwd,
        prepare_launch_context=prepare_launch_context,
        build_start_cmd=build_start_cmd,
        build_session_payload=build_session_payload,
        post_launch=post_launch,
    )
    context = SimpleNamespace(
        paths=SimpleNamespace(agent_dir=lambda name: tmp_path / '.ccb' / 'agents' / name),
        project=SimpleNamespace(project_id='project-test'),
    )
    spec = SimpleNamespace(name='demo', provider='codex')
    plan = SimpleNamespace(workspace_path=tmp_path / 'workspace')

    def apply_identity(*args, **kwargs):
        del args, kwargs
        clock.advance_ms(13)

    def write_session_file(**kwargs):
        del kwargs
        clock.advance_ms(19)

    monkeypatch.setattr(tmux_runtime, 'apply_ccb_pane_identity', apply_identity)
    call = lambda: tmux_runtime.launch_tmux_runtime(
        context,
        object(),
        spec,
        plan,
        launcher,
        backend_factory=lambda **kwargs: Backend(),
        pane_title_marker_fn=lambda context, spec: 'CCB-demo',
        launch_session_id_fn=lambda agent_name: 'ccb-demo-session',
        create_detached_tmux_pane_fn=lambda *args, **kwargs: pytest.fail('unexpected detached pane'),
        pane_meets_minimum_size_fn=lambda *args, **kwargs: True,
        best_effort_kill_tmux_pane_fn=lambda *args, **kwargs: None,
        write_session_file_fn=write_session_file,
        assigned_pane_id='%7',
        tmux_socket_path='/tmp/ccb-test.sock',
        allow_detached_fallback=False,
    )
    if fail_post_launch:
        with pytest.raises(RuntimeError, match='post launch failed') as captured:
            call()
        return getattr(captured.value, 'ccb_startup_timings_ms')
    return call()


def test_launch_tmux_runtime_records_additive_real_boundaries(tmp_path: Path, monkeypatch) -> None:
    timings = _launch_with_clock(tmp_path, monkeypatch)

    assert timings == {
        'prepare_launch_context': 10.0,
        'build_start_cmd': 7.0,
        'tmux_respawn': 11.0,
        'pane_identity': 13.0,
        'session_write': 36.0,
        'provider_post_launch': 23.0,
        'unattributed': 0.0,
    }
    assert sum(timings.values()) == 100.0


def test_launch_tmux_runtime_retains_completed_timings_on_failure(tmp_path: Path, monkeypatch) -> None:
    timings = _launch_with_clock(tmp_path, monkeypatch, fail_post_launch=True)

    assert timings['provider_post_launch'] == 23.0
    assert timings['unattributed'] == 0.0
    assert sum(timings.values()) == 100.0


def test_ensure_runtime_adds_binding_resolve_and_supports_legacy_result(monkeypatch) -> None:
    clock = _Clock()
    monkeypatch.setattr(ensure_runtime, 'monotonic_ns', clock.monotonic_ns)
    monkeypatch.setattr(ensure_runtime, '_pane_backed_launcher', lambda spec: object())
    monkeypatch.setattr(ensure_runtime.shutil, 'which', lambda name: f'/usr/bin/{name}')

    def launch(*args, **kwargs):
        del args, kwargs
        clock.advance_ms(10)
        return {'build_start_cmd': 4.0, 'unattributed': 6.0}

    binding = object()

    def resolve(**kwargs):
        del kwargs
        clock.advance_ms(7)
        return binding

    kwargs = dict(
        runtime_launch_result_cls=RuntimeLaunchResult,
        binding_runtime_alive_fn=lambda binding: False,
        provider_executable_fn=lambda provider: provider,
        cleanup_stale_tmux_binding_fn=lambda binding: None,
        launch_tmux_runtime_fn=launch,
        resolve_agent_binding_fn=resolve,
    )
    context = SimpleNamespace(project=SimpleNamespace(project_root='/tmp/project'))
    result = ensure_runtime.ensure_agent_runtime(
        context,
        object(),
        SimpleNamespace(name='demo', provider='codex', runtime_mode=RuntimeMode.PANE_BACKED),
        SimpleNamespace(workspace_path='/tmp/workspace'),
        None,
        **kwargs,
    )

    assert result.timings_ms == {
        'build_start_cmd': 4.0,
        'unattributed': 6.0,
        'binding_resolve': 7.0,
    }
    assert all(math.isfinite(value) and value >= 0 for value in result.timings_ms.values())

    @dataclass(frozen=True)
    class LegacyResult:
        launched: bool
        binding: object | None

    kwargs['runtime_launch_result_cls'] = LegacyResult
    legacy = ensure_runtime.ensure_agent_runtime(
        context,
        object(),
        SimpleNamespace(name='demo', provider='codex', runtime_mode=RuntimeMode.PANE_BACKED),
        SimpleNamespace(workspace_path='/tmp/workspace'),
        None,
        **kwargs,
    )
    assert legacy == LegacyResult(launched=True, binding=binding)


def test_runtime_launch_result_drops_non_finite_or_negative_timings() -> None:
    result = RuntimeLaunchResult(
        launched=True,
        binding=None,
        timings_ms={
            'good': 1,
            'nan': float('nan'),
            'infinite': float('inf'),
            'negative': -1,
            'invalid': 'not-a-number',
        },
    )

    assert result.timings_ms == {'good': 1.0}
