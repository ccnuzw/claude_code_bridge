# CCBD Agent Hot Reload Roadmap

Date: 2026-05-29

## Done

- Confirmed current daemon initialization loads `.ccb/ccb.config` once and
  injects the resulting object into registry, supervisor, supervision,
  completion tracking, dispatcher, project view, and project focus services.
- Confirmed current keeper behavior treats config signature drift as a daemon
  restart trigger.
- Confirmed current namespace topology check escalates missing windows,
  changed agent pane membership, and missing sidebar panes into namespace
  recreation.
- Confirmed `[ui.sidebar.view]` is already a view-only hot-load precedent
  through `project_view`, but it does not cover agent/runtime topology.
- Recorded additive-first hot reload as the first supported target.
- Discussed the full dynamic load/unload/replace direction and recorded the
  main safety risks: handler lock contention, stale handler service captures,
  unbounded draining, unbounded pending replacement, and namespace patch drift.
- Established Phase 0 baseline diagnostics for control-plane handler latency,
  heartbeat steps, project-view work, process metrics, and reload placeholders.
- Introduced the Phase 1 config-bound service graph boundary used by startup,
  with graph version and created-at diagnostics.

## In Progress

- Architecture review for the Phase 1 service graph boundary before commit.

## Next

1. Change handlers to resolve current graph services at request time instead of
   capturing old dispatcher/config/project-view objects.
2. Add `ccb reload --dry-run` and `project_reload_config` dry-run mode:
   load/validate config, compute diff, report the execution plan, mutate
   nothing.
3. Add bounded draining and retiring state machinery for unload, including
   queue limits, timeouts, and explicit failure responses.
4. Add namespace additive/remove patch operations behind dry-run-proven plans.
5. Expose additive mutating reload: view-only, add agent, and add window.
6. Expose dynamic unload for idle and bounded-draining agents.
7. Expose replacement only after unload semantics are safe; busy replacement
   remains pending with explicit bounds.
8. Run the automatic and manual matrix in
    [topics/test-matrix.md](topics/test-matrix.md).

## Deferred

- Pane-preserving arbitrary layout reshuffle.
- Background file watching of `.ccb/ccb.config`.
- General `ccbd` control-plane performance optimization.
- Automatic replace of indefinitely busy agents without user policy.
- Cross-window movement of busy panes.
