# Implementation Status

Date: 2026-06-16

## Current Phase

Main-agent review and regression pass for the first low-risk slices. The first
real lifecycle profile is recorded; broad optimization still waits on narrower
attribution, but three reviewable artifacts now exist for candidate landing.

Worker1 profiling harness returned and main review found/fixed two blockers:
default `ccb_test` invocation now uses project cwd instead of invalid
`--project ... start`, and process classification is project-scoped so other
running CCB daemons do not pollute the target project's CCB core buckets.

Worker2 startup slice returned with an artifact/worktree mismatch: the reported
tmux prepare cache and tests were not present. Main implemented the low-risk
cache directly: detached tmux server preparation is skipped only for the same
socket identity and same environment fingerprint, and failed prepare attempts
are not cached.

Worker3 interactive slice returned with an artifact/worktree mismatch and large
project_view/Rust-helper changes that are not accepted as part of this plan.
Main implemented only the narrow focus fast path in project_focus: after cache
invalidation, focus requests queue sidebar refresh through project_view when
available and fall back to the old synchronous sidebar refresh if the request
path is unavailable or fails.

Main review also found a blocker in the current worker3 project_view dirty
state: pending sidebar refresh called an undefined
`_record_project_view_sidebar_refresh`. Main fixed only that blocking path by
adding the metrics helper, declaring the metrics fields, removing duplicate
success recording, and covering `request_sidebar_refresh()` followed by
`build_response()`.

## Active TODO

- Main: keep worker3's wider project_view/Rust-helper changes quarantined until
  they receive a separate review decision; do not bundle them with the accepted
  focus fast-path and pending-refresh fix unless explicitly selected.
- Main: continue after the first candidate commit by reviewing the quarantined
  project_view/Rust-helper work as a separate optimization slice.
- Next profiling pass: split `shell-system` into tmux, ask CLI subprocess,
  shell wrapper, terminal frontend, and unrelated system work.
- Next workload pass: run a mixed-provider matrix for Codex, Gemini, Claude,
  OpenCode mounted-idle, and active asks.

## Blockers

- Current high-load sample primarily targeted Codex; Claude/OpenCode/Gemini
  active-load shares still need a controlled mixed-provider matrix.
- The `shell-system` bucket is too broad for broad implementation ownership;
  worker1 must narrow it before larger runtime changes.
- The current worktree still contains unrelated and unaccepted dirty changes,
  including project_view/Rust-helper work from worker3; commit packaging must be
  path-scoped.

## Last Landed

- `af2818d Add runtime performance profiling and latency fast paths`: lifecycle
  profiling harness, detached tmux prepare cache, project_focus fast path,
  pending sidebar-refresh support, tests, and plan evidence.

## Next Commit Target

Separate project_view/store optimization review. This must not reuse the
quarantined worker3 project_view/Rust-helper slice without a fresh scoped
review, staged-tree tests, and source-runtime smoke.

## Last Verified

- Source runtime profile artifact:
  `/tmp/perf_realtarget/real_provider_cpu_profile_accurate3.json`
- Worker1 harness review:
  `python -m pytest -q test/test_perf_runtime_lifecycle_profile.py`
  passed with `11 passed`.
- Worker1 smoke checks from `/home/bfly/yunwei/test_ccb2`:
  `/tmp/ccb_runtime_profile_startup_diagnose_scoped.json` and
  `/tmp/ccb_runtime_profile_load_sleep_scoped.json`.
- Worker2/main tmux prepare cache review:
  `PYTHONPATH=lib python -m pytest -q
  test/test_cli_runtime_launch_tmux_panes.py test/test_v2_runtime_launch.py -q`
  passed.
- Main focus fast-path review:
  `PYTHONPATH=lib python -m pytest -q
  test/test_ccbd_project_focus.py test/test_sidebar_click.py` passed with
  `15 passed`.
- Combined targeted regression:
  `PYTHONPATH=lib python -m pytest -q
  test/test_perf_runtime_lifecycle_profile.py
  test/test_cli_runtime_launch_tmux_panes.py test/test_v2_runtime_launch.py
  test/test_ccbd_project_focus.py test/test_sidebar_click.py` passed with
  `117 passed`.
- Project_view dirty-state regression:
  `PYTHONPATH=lib python -m pytest -q
  test/test_ccbd_project_view.py test/test_ccbd_service_graph.py` passed with
  `65 passed`; this verifies current consistency but does not accept worker3's
  mismatched project_view/Rust-helper slice.
- Project_view pending-refresh blocker fix:
  `PYTHONPATH=lib python -m pytest -q
  test/test_ccbd_project_focus.py test/test_sidebar_click.py
  test/test_ccbd_project_view.py test/test_ccbd_service_graph.py` passed with
  `81 passed`.
- Final targeted regression:
  `PYTHONPATH=lib python -m pytest -q
  test/test_perf_runtime_lifecycle_profile.py
  test/test_cli_runtime_launch_tmux_panes.py test/test_v2_runtime_launch.py
  test/test_ccbd_project_focus.py test/test_sidebar_click.py
  test/test_ccbd_project_view.py test/test_ccbd_service_graph.py` passed with
  `183 passed`.
- Source wrapper smoke after runtime helper change:
  `/home/bfly/yunwei/ccb_source/ccb_test --diagnose` and
  `ccb_test config validate` passed from `/home/bfly/yunwei/test_ccb2`.
- Worker report artifact:
  `.ccb/ccbd/artifacts/text/completion-reply/job_21a7c0c0b62a-art_19c8d2c809734472.txt`
- Rust helper benchmark evidence remains in
  `dev_tools/perf_results/python_rust_phase3_native_output_helper.json`,
  `python_rust_phase4_storage_scan_helper.json`, and
  `python_rust_phase12_storage_summary_helper.json`.

## Dispatch Notes

- Workers must not commit, push, reset, checkout, or delete unrelated dirty
  worktree changes.
- Reviewer agents are not part of this task; `reviewer1` dispatch
  `job_1d22628e6e26` was cancelled at the user's request.
- Source runtime validation must run from `/home/bfly/yunwei/test_ccb2` with
  `/home/bfly/yunwei/ccb_source/ccb_test` and isolated `HOME` /
  `CCB_SOURCE_HOME`.
- Each worker reply must include changed files, commands/tests run, measured
  before/after values when available, residual risk, and rollback notes.
