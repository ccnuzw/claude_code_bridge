# Decision 005: Orchestrator Is An Ask-Activated Semantic Dispatcher

Date: 2026-06-24

Status: Accepted

## Context

The workflow needs an orchestrator that can slice execution-ready plans into
bounded work items, select a small execution-node topology, dispatch work, and
aggregate results. The tempting design is to make this role a powerful manager
that can start, stop, and reshape agents directly.

That would violate the current state model. Runtime authority belongs to CCB
scripts, `loop_runner`, and ccbd/reload surfaces. CCB already has explicit
reload support for safe additive load and idle unload, but this is guarded
runtime behavior, not a semantic agent permission.

## Decision

Make `orchestrator` an ask-activated semantic dispatcher.

It is activated by `loop_runner` for one loop round or orchestration batch. It
may analyze task complexity, choose 1-4 execution nodes, produce work items and
dependency graphs, generate constrained `ask` payloads for `coder` and
`checker`, request dynamic runtime capacity, freeze failed branches, drain
unaffected work, and aggregate node results.

It must not directly modify `.ccb/ccb.config`, invoke `ccb reload`, kill panes,
write `.ccb/runtime/loops` authority files, lower acceptance criteria, or mark
partial work as done.

Dynamic agent load/unload is represented as a structured request from
orchestrator to loop runner. Loop runner and CCB-owned scripts decide whether
fixed configured agents are enough, whether `ccb reload --dry-run` / `ccb reload`
can safely apply a change, or whether the request must be rejected.

## Consequences

- Orchestrator stays short-lived and context-bounded.
- Runtime mutation remains deterministic and auditable.
- Current CCB hot-reload capability can be reused later without making it a
  semantic-agent permission.
- V1 can start with fixed configured `coder` and `checker` agents.
- The Role Pack should focus on work slicing, dependency graphs, constrained
  asks, runtime request artifacts, and aggregation templates.

## Non-Goals

- This does not implement dynamic temporary agents in v1.
- This does not make orchestrator a daemon.
- This does not give orchestrator direct reload/kill authority.
- This does not remove future support for loop-runner-mediated dynamic load and
  idle unload.
