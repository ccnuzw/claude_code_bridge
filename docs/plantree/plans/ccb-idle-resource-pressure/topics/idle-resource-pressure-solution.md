# Idle Resource Pressure Solution

Date: 2026-06-23

## Design Principles

- Treat idle pressure as a lifecycle problem, not a single log-file problem.
- Prefer no-op suppression before adding new state machines.
- Keep durable authority on disk; move only rebuildable runtime residue to
  tmpfs.
- Do not hide state from operators: replace noisy writes with metrics and
  explicit idle/suspended states.
- Make all aggressive behavior opt-in before changing defaults.

## Pressure Classes

### 1. Control-Plane Heartbeat Writes

Files:

- `.ccb/ccbd/lease.json`
- `.ccb/ccbd/keeper.json`
- `.ccb/ccbd/lifecycle.json`

Current issue:

- The daemon heartbeat runs on a short interval and persists heartbeat-like
  records even when no request, job, pane change, or health transition occurred.

Recommended change:

- Add heartbeat write debounce.
- Keep latest heartbeat timestamp in memory.
- Persist to disk only when:
  - lease holder or daemon generation changes
  - mount state changes
  - health/failure reason changes
  - a configurable max silence interval expires
  - shutdown/startup needs final evidence

Candidate knobs:

```text
CCB_IDLE_HEARTBEAT_INTERVAL_S=15
CCB_DEEP_IDLE_HEARTBEAT_INTERVAL_S=120
CCB_HEARTBEAT_PERSIST_MAX_S=60
```

Compatibility notes:

- Existing clients that inspect `lease.json` need a freshness model that allows
  debounced writes. Add a field such as `heartbeat_persisted_at` only if needed;
  otherwise keep current schema and adjust freshness logic around daemon socket
  liveness.

### 2. Runtime And Helper JSON Rewrite Amplification

Files:

- `.ccb/agents/<agent>/runtime.json`
- `.ccb/agents/<agent>/helper.json`

Current issue:

- Heartbeat steps can update runtime records with only `last_seen_at` or helper
  manifest rewrites. Atomic write means even tiny updates become file creation,
  replace, metadata churn, and SSD writes.

Recommended change:

- Add a content-stable JSON store path:
  - serialize payload
  - if target exists and bytes are identical, skip write
  - expose `skipped_noop_write_count`
- Do not rewrite helper manifests unless material fields changed.
- Treat `last_seen_at` as an in-memory heartbeat while idle; persist it only on
  state transitions or after a max interval.

Likely code areas:

- `storage/json_store.py`
- `storage/atomic.py`
- `agents/store.py`
- `provider_runtime/helper_manifest.py`
- `ccbd/services/registry.py`
- `ccbd/services/health_monitor_runtime/*`
- `ccbd/services/dispatcher_runtime/runtime_state.py`

Acceptance check:

- A no-op heartbeat across N agents should not change mtimes for
  `runtime.json` or `helper.json`.

### 3. Idle-Aware Maintenance Loop

Current issue:

- Each tick can run health monitor, runtime supervision, dispatcher runtime
  view reconciliation, dispatcher tick, completion polling, and job heartbeat.
  That is appropriate while jobs are active, but too expensive when the project
  is quiet.

Recommended change:

- Track project activity:
  - last socket request
  - pending ask queue depth
  - active jobs
  - provider output movement
  - recent health transition
- Derive mode:
  - `active`: active job/request/recovery
  - `warm-idle`: no active work, recent user interaction
  - `deep-idle`: no active work after threshold
- Use different intervals and step sets:

```text
active:     1s, full maintenance
warm-idle: 15s, health + lightweight dispatcher checks
deep-idle: 120s, lease liveness + minimal health sampling
```

Wake rules:

- Any socket request queues immediate maintenance.
- Any ask submission exits idle mode.
- Any provider output/event exits deep idle.
- Any failure/recovery condition returns to active cadence.

Likely code areas:

- `ccbd/app_runtime/lifecycle.py`
- `ccbd/socket_server_runtime/loop.py`
- `ccbd/services/dispatcher.py`
- `ccbd/services/health.py`
- `ccbd/supervision/loop.py`

### 4. Provider Runtime Tmpfs Split

Current issue:

- Provider runtime residue is mixed with project `.ccb` state. Many files are
  rebuildable and do not need SSD durability.

Move candidates:

- `provider-runtime/<provider>/`
- FIFOs
- bridge logs that are not user-facing evidence
- pid files
- activity scratch snapshots
- temporary sockets/acks

Keep on disk:

- auth
- provider session identity
- user/project config projections
- stable session transcript if required for resume
- explicit diagnostics exports

Implementation approach:

- Use existing runtime-root concepts where possible instead of inventing a
  parallel path authority.
- Add a runtime root resolver:

```text
CCB_RUNTIME_STATE_HOME=/run/user/$UID/ccb
fallback: /dev/shm/ccb-$USER
fallback: project .ccb when runtime root unavailable
```

The project `.ccb` can keep a small ref file pointing to the runtime root.

### 5. Provider Idle Suspend/Resume

Current issue:

- Mounted providers keep bridges, terminal panes, and provider CLIs alive even
  when unused. This is the biggest memory and CPU opportunity.

Recommended states:

```text
mounted -> idle -> suspended -> waking -> idle/busy
```

Suspend policy:

- Eligible only when:
  - no active job
  - queue depth is zero
  - no callback continuation waiting on that provider
  - provider runtime health is stable
  - idle age exceeds configured threshold
- Persist enough resume authority:
  - agent name
  - provider
  - workspace path
  - session id/path if resumable
  - runtime generation
  - desired state

Resume policy:

- On ask or focus request, transition `suspended -> waking`.
- Start provider runtime using existing start/restore path.
- If restore fails, surface a clear error and keep the job pending or fail
  according to current dispatcher semantics.

Candidate knobs:

```text
CCB_CODEX_RUNTIME_IDLE_TIMEOUT_S=600
CCB_PROVIDER_SUSPEND_ENABLED=0
CCB_PROVIDER_SUSPEND_AFTER_S=900
CCB_PROVIDER_WAKE_TIMEOUT_S=60
```

Start with Codex opt-in because its provider-state footprint is currently the
largest observed local pressure.

### 6. Provider-State Retention And Compaction

Current issue:

- Some pressure is not continuous writes but accumulated provider-state size:
  `sessions/*.jsonl`, SQLite state, WALs, caches, and plugin bundles.

Recommended changes:

- Add maintenance command/report:

```text
ccb doctor storage
ccb cleanup --dry-run
ccb cleanup --provider-state --older-than 30d
```

- Policies:
  - checkpoint/truncate SQLite WALs for stopped or suspended providers
  - compress old session JSONL above a size threshold
  - prune rebuildable caches by age and size
  - never delete auth or active session authority by default

Codex diagnostic SQLite guardrails:

- The `logs_2.sqlite` diagnostic-log filter is a pressure mitigation, not a
  session authority change. By default it suppresses high-frequency
  `TRACE`/`DEBUG` rows while preserving higher-value diagnostic rows.
- The filter must be reversible: when `CCB_CODEX_DIAGNOSTIC_LOGS` is enabled,
  CCB removes its trigger from existing managed Codex homes instead of leaving
  old suppression state behind.
- Trigger installation must be idempotent. If the expected trigger already
  exists, the installer must not drop/recreate it and must not bump SQLite
  schema state on every startup.
- `RUST_LOG=off` is only a managed default. Explicit profile or agent env must
  be able to override it for diagnostics.

Acceptance check:

- Dry-run reports storage classes before deleting or compressing anything.

## Implementation Slices

### Slice A: Measurement And Guardrails

- Add counters:
  - runtime store writes
  - helper manifest writes
  - no-op JSON write skips
  - heartbeat persist writes
  - provider RSS by provider type
  - provider idle age
- Add a diagnostic command or project view field that shows idle mode.

Risk: low.

### Slice B: No-Op Write Suppression

- Implement content-equality skip in JSON writes.
- Add helper manifest equality skip.
- Avoid saving runtime when only volatile timestamps changed under the debounce
  threshold.

Risk: low to medium. Main risk is stale diagnostic timestamps.

### Slice C: Idle Heartbeat Pacing

- Add project activity tracker.
- Run full maintenance only while active.
- Use warm/deep idle intervals when safe.

Risk: medium. Main risk is slower detection of dead panes while idle.

### Slice D: Runtime Tmpfs

- Move rebuildable runtime dirs to runtime-state home.
- Keep project `.ccb` refs for discoverability.
- Add fallback when tmpfs is unavailable.

Risk: medium. Main risk is crash recovery and stale runtime-root refs.

### Slice E: Provider Suspend/Resume

- Implement opt-in Codex suspend first.
- Add wake path on ask.
- Add explicit sidebar/project-view status.

Risk: medium to high. Main risk is resume latency and provider-specific
restore differences.

## Verification Plan

Baseline before each slice:

```bash
ps -eo pid,cmd | rg 'ccbd|provider_backends|/codex '
cat /proc/<pid>/io
find <project>/.ccb -type f -mmin -2 -printf '%T@ %s %p\n'
du -h -d 5 <project>/.ccb | sort -h | tail
```

Automated tests:

- Unit tests for no-op JSON write skip.
- Unit tests for runtime/helper debounce.
- Unit tests for idle-mode transitions from active to warm-idle to deep-idle.
- Integration test for ask waking a suspended provider.
- Regression test for `ccb kill`, `ccb -n`, callback continuation, and
  project restart.

Manual acceptance:

- Run a project with 10 mounted Codex agents and no active jobs for 10 minutes.
- Confirm file mtimes for runtime/helper records are mostly stable.
- Confirm `/proc/<pid>/io` write deltas are near zero outside max-persist
  windows.
- Submit an ask and confirm the provider wakes and completes.

## Open Questions

- What is the minimum persisted heartbeat freshness external tools require?
- Should provider suspend be per-agent, per-provider, or project-wide?
- Which provider session files are mandatory for resume and which are only
  diagnostics?
- Should compressed old sessions remain transparent to existing session readers?
- Should idle defaults be enabled globally or only for high-agent-count
  projects at first?
