from __future__ import annotations

import json
from pathlib import Path

from provider_core.inherited_skills import inherits_skills, packaged_inherited_skills_dir
from provider_core.projected_assets import route_projected_tree


GROK_CCB_SKILL_NAMES = ('ask', 'ccb-clear')
_GROK_SKILL_LABEL_PREFIX = 'grok-ccb-skill:'


def materialize_grok_skills(target_home: Path, *, profile=None) -> tuple[str, ...]:
    source_root = packaged_inherited_skills_dir('grok')
    target_root = Path(target_home).expanduser() / '.grok' / 'skills'
    enabled = inherits_skills(profile)
    active: list[str] = []
    for skill_name in GROK_CCB_SKILL_NAMES:
        if route_projected_tree(
            source_root / skill_name,
            target_root / skill_name,
            enabled=enabled,
            label=_skill_label(skill_name),
            allow_unmarked_replace=False,
        ):
            active.append(skill_name)
    return tuple(active)


def grok_ccb_skills_ready(target_home: Path) -> bool:
    source_root = packaged_inherited_skills_dir('grok')
    target_root = Path(target_home).expanduser() / '.grok' / 'skills'
    return all(
        _owned_skill_ready(
            target_root / skill_name,
            source=source_root / skill_name,
            label=_skill_label(skill_name),
        )
        for skill_name in GROK_CCB_SKILL_NAMES
    )


def grok_skill_permission_args() -> tuple[str, ...]:
    return (
        '--allow',
        'Bash(command ask *)',
        '--allow',
        'Bash(command ccb clear*)',
    )


def _owned_skill_ready(target: Path, *, source: Path, label: str) -> bool:
    if not (target / 'SKILL.md').is_file():
        return False
    marker = Path(f'{target}.ccb-projection.json')
    try:
        payload = json.loads(marker.read_text(encoding='utf-8'))
    except Exception:
        return False
    if not isinstance(payload, dict) or payload.get('record_type') != 'ccb_projected_asset':
        return False
    if str(payload.get('label') or '') != label:
        return False
    try:
        return Path(str(payload.get('source') or '')).expanduser().resolve() == source.expanduser().resolve()
    except Exception:
        return str(payload.get('source') or '') == str(source)


def _skill_label(skill_name: str) -> str:
    return f'{_GROK_SKILL_LABEL_PREFIX}{skill_name}'


__all__ = [
    'GROK_CCB_SKILL_NAMES',
    'grok_ccb_skills_ready',
    'grok_skill_permission_args',
    'materialize_grok_skills',
]
