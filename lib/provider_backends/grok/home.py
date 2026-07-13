from __future__ import annotations

from pathlib import Path
import shutil

from provider_core.source_home import current_provider_source_home

from .skills import materialize_grok_skills


_GROK_AUTH_FILES = (
    Path('.grok') / 'auth.json',
)
_GROK_CONFIG_FILES = (
    Path('.grok') / 'config.toml',
)


def materialize_grok_home(
    target_home: Path,
    *,
    profile=None,
    source_home: Path | None = None,
) -> Path:
    target = Path(target_home).expanduser()
    source = Path(source_home).expanduser() if source_home is not None else current_provider_source_home()
    target.mkdir(parents=True, exist_ok=True)
    (target / '.grok').mkdir(parents=True, exist_ok=True)

    if _inherits_auth(profile):
        for relative in _GROK_AUTH_FILES:
            _sync_file(source / relative, target / relative)
    if _inherits_config(profile):
        for relative in _GROK_CONFIG_FILES:
            _sync_file(source / relative, target / relative)
    materialize_grok_skills(target, profile=profile)
    return target


def _inherits_auth(profile) -> bool:
    return bool(getattr(profile, 'inherit_auth', True))


def _inherits_config(profile) -> bool:
    return bool(getattr(profile, 'inherit_config', True))


def _sync_file(source: Path, target: Path) -> None:
    if not source.is_file():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        if target.is_symlink() or target.exists():
            target.unlink()
    except FileNotFoundError:
        pass
    shutil.copy2(source, target)


__all__ = ['materialize_grok_home']
