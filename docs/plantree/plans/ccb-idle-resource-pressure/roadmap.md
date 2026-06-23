# Roadmap

Date: 2026-06-23

## Done

- Identified the idle pressure classes from live local diagnosis:
  daemon heartbeat writes, agent runtime/helper rewrite amplification, provider
  bridge/CLI residency, provider SQLite/session writes, and shared-cache disk
  footprint.
- Separated "space at rest" problems from "continuous write" problems so the
  first implementation slice can target SSD wear and idle churn.
- Identified that the `v7.6.14` Codex `logs_2.sqlite` mitigation was partial:
  the trigger-only policy did not move writes off durable storage and preserved
  some diagnostic rows, so it could still leave measurable write pressure.
- Implemented the corrected Codex diagnostic SQLite policy in the working tree:
  managed `logs_2.sqlite` redirects to temp storage, existing DB/sidecars are
  backed up, all diagnostic inserts are blocked by default, diagnostics mode can
  restore the original DB, and symlink failure falls back to an in-place trigger.
- Verified the corrected policy with `PYTHONPATH=lib pytest -q
  test/test_codex_diagnostic_log_filter.py
  test/test_codex_launcher_diagnostics_env.py test/test_v2_runtime_launch.py`
  plus `python -m compileall -q
  lib/provider_backends/codex/launcher_runtime/command_runtime/diagnostics.py
  lib/provider_backends/codex/launcher_runtime/command_runtime/home.py` and
  `git diff --check`.
- Confirmed `state_5.sqlite*` was not a release-blocking idle pressure path in
  local sampling; keep it under measurement rather than adding a speculative
  mitigation now.

## In Progress

- Shape the implementation plan for an idle-aware CCB runtime policy.

## Next

1. Add an ask-stability gate for every idle optimization:
   plain ask submit, queued ask, callback continuation, reply delivery, cancel,
   resubmit, and first ask after idle or suspend.
2. Add measurement hooks for idle write bytes, runtime-store save count, helper
   manifest save count, provider process RSS, and provider idle age.
3. Add content-equality and debounce guards around JSON runtime writes:
   `runtime.json`, `helper.json`, lifecycle records, and lease heartbeat.
4. Introduce idle-mode heartbeat pacing:
   active interval, idle interval, deep-idle interval, and immediate wake on
   incoming socket requests.
5. Move rebuildable runtime residue toward tmpfs:
   provider-runtime, FIFOs, bridge scratch state, activity snapshots, and
   transient pid/socket markers.
6. Add provider idle suspend/resume for mounted-but-unused agents, starting with
   an opt-in Codex policy.
7. Add cleanup/compaction for provider-state:
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
- `ask` remains stable across idle policies:
  plain ask accepts quickly, queued ask remains ordered, callback continuation is
  delivered once, `--silence` does not require a reply, and reply delivery does
  not loop or disappear.
- Runtime files still provide enough evidence for diagnostics after a crash.
