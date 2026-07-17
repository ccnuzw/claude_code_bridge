from __future__ import annotations

from agents.models import AgentState, RuntimeBindingSource, normalize_runtime_binding_source

PROVIDER_AUTH_REVOKED_RUNTIME_HEALTH = 'provider-auth-revoked'
PROVIDER_RECOVERY_BLOCKED_RUNTIME_HEALTH = 'provider-recovery-blocked'
PROVIDER_RECOVERY_BLOCKED_RUNTIME_HEALTHS = frozenset(
    {
        PROVIDER_AUTH_REVOKED_RUNTIME_HEALTH,
        PROVIDER_RECOVERY_BLOCKED_RUNTIME_HEALTH,
    }
)
HARD_BLOCKED_RUNTIME_HEALTHS = frozenset({'session-missing'}) | PROVIDER_RECOVERY_BLOCKED_RUNTIME_HEALTHS
RECOVERABLE_RUNTIME_HEALTHS = frozenset({'pane-dead', 'pane-missing'})


def normalized_runtime_health(runtime) -> str:
    return str(getattr(runtime, 'health', '') or '').strip().lower()


def should_attempt_background_recovery(runtime) -> bool:
    if runtime is None or getattr(runtime, 'state', None) is not AgentState.DEGRADED:
        return False
    binding_source = normalize_runtime_binding_source(
        getattr(runtime, 'binding_source', RuntimeBindingSource.PROVIDER_SESSION)
    )
    if binding_source is RuntimeBindingSource.EXTERNAL_ATTACH:
        return False
    return normalized_runtime_health(runtime) in RECOVERABLE_RUNTIME_HEALTHS


__all__ = [
    'HARD_BLOCKED_RUNTIME_HEALTHS',
    'PROVIDER_AUTH_REVOKED_RUNTIME_HEALTH',
    'PROVIDER_RECOVERY_BLOCKED_RUNTIME_HEALTH',
    'PROVIDER_RECOVERY_BLOCKED_RUNTIME_HEALTHS',
    'RECOVERABLE_RUNTIME_HEALTHS',
    'normalized_runtime_health',
    'should_attempt_background_recovery',
]
