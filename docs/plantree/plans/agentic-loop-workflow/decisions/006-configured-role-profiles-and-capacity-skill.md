# Decision 006: Configured Role Profiles And Capacity Skill

Date: 2026-06-24

## Status

Accepted for planning.

## Context

The workflow needs dynamic execution nodes, but letting `orchestrator` directly
edit `.ccb/ccb.config`, run raw `ccb reload`, or kill panes would merge semantic
task routing with runtime authority. Current CCB already has guarded reload
support for append-only add-agent/add-window and idle remove-agent, but that
surface is config-oriented rather than loop-oriented.

The user wants each dynamic role's provider, model, and thinking strength to be
declared in config, then loaded or released through parameterized scripts that
can be wrapped as a skill.

## Decision

Use configured role profiles plus a narrow capacity command surface.

- `.ccb/ccb.config` declares allowed `loop.role_profiles`.
- `orchestrator` decides profile counts from task complexity.
- `orchestrator` uses an `orchestrator-capacity` skill to call
  `ccb loop capacity ensure/status/release`.
- CCB scripts and ccbd own validation, locking, runtime writes, reload
  transactions, busy checks, and release cleanup.

`orchestrator` has dynamic load/unload ability through the capacity API, but it
does not own raw runtime mutation.

## Consequences

Positive:

- Users keep policy control over provider, model, thinking, workspace, max
  instances, and reuse behavior.
- `orchestrator` can remain a short-context semantic dispatcher.
- Runtime mutation stays centralized and testable.
- Existing reload internals can be reused without exposing raw reload to roles.
- Capacity blockers become structured loop evidence instead of silent fallback.

Tradeoffs:

- CCB must implement a new `ccb loop capacity` command layer.
- `thinking` needs provider-specific adapter mapping.
- The design must decide whether V1 uses a daemon-side transient overlay or a
  generated config block over existing reload.
- Sidebar and cleanup semantics for generated agents need explicit UX rules.

## Boundary

This decision does not authorize:

- raw `ccb reload` from orchestrator;
- raw `ccb kill` from orchestrator;
- direct config edits by orchestrator;
- unbounded generated agents;
- provider/model/thinking values outside declared profiles;
- busy unload without a later explicit policy.
