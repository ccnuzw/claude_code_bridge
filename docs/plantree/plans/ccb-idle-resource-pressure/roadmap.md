# Roadmap

Date: 2026-06-23

## Done

- Identified the idle pressure classes from live local diagnosis:
  daemon heartbeat writes, agent runtime/helper rewrite amplification, provider
  bridge/CLI residency, provider SQLite/session writes, and shared-cache disk
  footprint.
- Separated "space at rest" problems from "continuous write" problems so the
  first implementation slice can target SSD wear and idle churn.
- Hardened the current Codex `logs_2.sqlite` mitigation path in working tree:
  the diagnostic-log trigger policy is reversible, idempotent, and does not
  override explicit `RUST_LOG` settings.

## In Progress

- Shape the implementation plan for an idle-aware CCB runtime policy.

## Next

1. Add measurement hooks for idle write bytes, runtime-store save count, helper
   manifest save count, provider process RSS, and provider idle age.
2. Add content-equality and debounce guards around JSON runtime writes:
   `runtime.json`, `helper.json`, lifecycle records, and lease heartbeat.
3. Introduce idle-mode heartbeat pacing:
   active interval, idle interval, deep-idle interval, and immediate wake on
   incoming socket requests.
4. Move rebuildable runtime residue toward tmpfs:
   provider-runtime, FIFOs, bridge scratch state, activity snapshots, and
   transient pid/socket markers.
5. Add provider idle suspend/resume for mounted-but-unused agents, starting with
   an opt-in Codex policy.
6. Add cleanup/compaction for provider-state:
   WAL checkpoint, session JSONL size policy, old cache pruning, and shared
   cache retention limits.

## Deferred

- Default provider suspend for every provider type before Codex behavior is
  proven.
- Rewriting provider session storage.
- Removing persistent sessions or auth material.
- Moving durable auth/session authority to tmpfs.

## Acceptance Criteria

- With 10 mounted idle Codex agents, idle daemon+provider write rate drops by at
  least 90% compared with the baseline sample.
- Idle provider RSS drops materially when suspend is enabled, without losing
  the ability to route a later ask.
- First ask after idle either starts immediately or reports a clear "waking"
  state, then proceeds without manual intervention.
- `ccb kill`, `ccb -n`, project restart, and callback continuation retain their
  current semantics.
- Runtime files still provide enough evidence for diagnostics after a crash.
