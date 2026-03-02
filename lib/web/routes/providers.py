"""
Provider status API routes.
"""

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from web.auth import require_auth

router = APIRouter()


class ProviderStatus(BaseModel):
    """Provider status response."""
    name: str
    available: bool
    session_active: bool = False
    error: Optional[str] = None


class PingResult(BaseModel):
    """Ping result response."""
    provider: str
    success: bool
    latency_ms: Optional[float] = None
    error: Optional[str] = None


KNOWN_PROVIDERS = ["claude", "codex", "gemini", "opencode", "droid"]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _resolve_work_dir(request: Request) -> Path:
    state_dir = getattr(request.app.state, "default_work_dir", None)
    if isinstance(state_dir, str) and state_dir.strip():
        candidate = Path(state_dir).expanduser()
        if candidate.exists() and candidate.is_dir():
            return candidate
    return _repo_root()


def _ping_via_cli(provider: str, work_dir: Path) -> PingResult:
    script = _repo_root() / "bin" / "ccb-ping"
    if not script.exists():
        return PingResult(provider=provider, success=False, error="ccb-ping script not found")

    env = dict(os.environ)
    env.setdefault("CCB_CALLER", "desktop")
    env.setdefault("CCB_WORK_DIR", str(work_dir))

    start = time.time()
    try:
        proc = subprocess.run(
            [sys.executable, str(script), provider, "--autostart"],
            cwd=str(work_dir),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=20,
        )
    except subprocess.TimeoutExpired:
        latency = (time.time() - start) * 1000
        return PingResult(provider=provider, success=False, latency_ms=latency, error="Ping timed out")
    except Exception as exc:
        latency = (time.time() - start) * 1000
        return PingResult(provider=provider, success=False, latency_ms=latency, error=str(exc))

    latency = (time.time() - start) * 1000
    if proc.returncode == 0:
        return PingResult(provider=provider, success=True, latency_ms=latency)

    detail = (proc.stderr or proc.stdout or "").strip() or f"Exit code: {proc.returncode}"
    return PingResult(provider=provider, success=False, latency_ms=latency, error=detail)


def check_provider_available(provider: str) -> ProviderStatus:
    """Check if a provider is available."""
    try:
        # Check if provider adapter exists
        from askd.registry import ProviderRegistry
        registry = ProviderRegistry()

        # Try to get adapter
        adapter = registry.get(provider)
        if adapter:
            return ProviderStatus(name=provider, available=True)
    except Exception as e:
        return ProviderStatus(name=provider, available=False, error=str(e))

    return ProviderStatus(name=provider, available=False)


@router.get("")
async def list_providers(user: dict = Depends(require_auth)) -> List[ProviderStatus]:
    """List all provider statuses."""
    statuses = []
    for provider in KNOWN_PROVIDERS:
        statuses.append(check_provider_available(provider))
    return statuses


@router.get("/{name}")
async def get_provider(name: str, user: dict = Depends(require_auth)) -> ProviderStatus:
    """Get specific provider status."""
    if name not in KNOWN_PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {name}")
    return check_provider_available(name)


@router.post("/{name}/ping")
async def ping_provider(
    name: str,
    request: Request,
    user: dict = Depends(require_auth),
) -> PingResult:
    """Ping a provider to check connectivity."""
    if name not in KNOWN_PROVIDERS:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {name}")

    work_dir = _resolve_work_dir(request)
    return _ping_via_cli(name, work_dir)
