from __future__ import annotations

from pathlib import Path

from web.app import create_app
from web.routes import providers


def test_create_app_sets_desktop_mode_state(tmp_path: Path) -> None:
    app = create_app(
        local_only=True,
        auth_token=None,
        desktop_mode=True,
        default_work_dir=str(tmp_path),
    )

    assert app.state.desktop_mode is True
    assert app.state.default_work_dir == str(tmp_path)


def test_resolve_work_dir_prefers_state_dir(tmp_path: Path) -> None:
    app = create_app(local_only=True, default_work_dir=str(tmp_path))

    class _Req:
        pass

    req = _Req()
    req.app = app

    resolved = providers._resolve_work_dir(req)  # noqa: SLF001
    assert resolved == tmp_path


def test_resolve_work_dir_falls_back_to_repo_root(monkeypatch) -> None:
    app = create_app(local_only=True, default_work_dir="")

    class _Req:
        pass

    req = _Req()
    req.app = app

    fake_root = Path("/tmp/ccb-fake-repo")
    monkeypatch.setattr(providers, "_repo_root", lambda: fake_root)

    resolved = providers._resolve_work_dir(req)  # noqa: SLF001
    assert resolved == fake_root
