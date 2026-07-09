from __future__ import annotations

from pathlib import Path

from provider_backends.native_cli_support import NativeCliLaunchConfig, build_native_cli_runtime_launcher
from provider_core.contracts import ProviderRuntimeLauncher


def build_runtime_launcher() -> ProviderRuntimeLauncher:
    # NOTE: home_env is intentionally None. grok reads its auth/config from the
    # real ~/.grok (auth.json); redirecting HOME into a CCB-managed state dir
    # would leave the interactive pane unauthenticated.
    return build_native_cli_runtime_launcher(
        NativeCliLaunchConfig(
            provider="grok",
            home_env=None,
            visible_args_builder=_grok_visible_args,
        )
    )


def _grok_visible_args(prepared_state: dict[str, object]) -> tuple[str, ...]:
    workspace = _path_from_prepared(prepared_state, "workspace_path")
    return ("--cwd", str(workspace))


def _path_from_prepared(prepared_state: dict[str, object], key: str) -> Path:
    raw = str(prepared_state.get(key) or "").strip()
    if not raw:
        raise RuntimeError(f"grok launch requires {key} in prepared_state")
    return Path(raw).expanduser()


__all__ = ["build_runtime_launcher"]
