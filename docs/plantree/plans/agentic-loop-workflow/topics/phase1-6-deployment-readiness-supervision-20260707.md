# Phase 1-6 Deployment Readiness Supervision

Date: 2026-07-07
Status: ACTIVE / DEPLOYMENT READINESS BLOCKED

## Purpose

This topic tracks the post-acceptance deployment-readiness lane for the
[Phase 1-6 acceptance goal](../goals/phase1-6-acceptance-goal.zh.md).

The 2026-07-05 acceptance report claims Phase 6A and bounded Phase 6B
single-round capability. This lane does not retract that bounded claim. It
adds the user's current deployment-standard requirement: real-provider workflow
testing must prove that the visible entry path, frontdesk handoff, planner and
orchestrator activation, execution/review, UI visibility, and dynamic lifecycle
cleanup work together under realistic use.

## Gate Status

Deployment readiness is blocked until an independent audit lane approves the
evidence. `talk2` may supervise, inspect raw evidence, and submit repair work,
but `talk2` must not self-approve deployment readiness. The final verdict must
come from `reviewer2` or from an explicit owner decision that names the
self-approval exception.

The read-only audit artifacts are current blockers for this page:

- reviewer2 `job_7c18b7d9e333`: BLOCKER B1, because the previous review
  procedure gave `talk2` both execution supervision and final reviewer power.
  The same audit also raised HIGH findings for module-level coverage,
  sequence13 contradiction handling, and fixed JSON/JSONL evidence rows.
- reviewer1 `job_50c72bc31578`: HIGH findings requiring frontdesk-started
  L1-L4 regression, module-level integration gates, final deployment verdict
  ownership, route/complexity mix, stricter UI evidence, and positive
  busy-retain evidence.

## Current 2026-07-07 Retake State

The latest real-provider retake is still blocked; no deployment-ready verdict
is claimed.

- worker1 `job_5ff54a7da3ea` found that an empty project can complete
  frontdesk intake but auto-handoff then stops with
  `frontdesk_auto_handoff_requires_plan_slug` / `no_plan_root`. This violates
  the operator-facing requirement that frontdesk is the workflow entry point.
  Source repair now makes dispatcher and CLI frontdesk handoff bootstrap a
  script-owned default `frontdesk-intake` plan root when no plan exists, while
  preserving the explicit-selection guard for multiple existing plan roots.
- worker3 `job_b809499ebc22` proved clean dynamic unload for one mounted loop
  (`released_count=2`, `retained_count=0`, `agents=[]`) but the run remains
  `BLOCKER`: terminal pass was not proven, later frontdesk delivery failed,
  and one runner path kept selecting an earlier blocked task.
- worker1 `job_c1dec0dbdea8` exposed a separate ask-first blocker: provider
  auto-retry created a successful successor job, but the round still used the
  original failed orchestrator job and wrote `blocked / ask_job_incomplete`.
  Source repair now follows `provider_options.retry_source_job_id` successor
  records from `.ccb/agents/*/jobs.jsonl` and records retry lineage on the
  ask result.
- worker2 `job_a67f6b1eba47` exposed a sequence23 L1-L4 harness blocker:
  frontdesk and planner completed, and planner produced the required route mix,
  but two non-direct tasks used route-equivalent IDs
  (`phase6b-l3-needs-detail-detail-ready` and
  `phase6b-l4-macro-adjustment-replan-required`) instead of the canonical
  harness IDs. Source repair now allows strict route-equivalent aliases only
  when the canonical task is absent, the route is non-direct, and exactly one
  matching task packet proves the expected route. Direct execution rows still
  require canonical IDs.
- worker3 `job_fd2f68958546` exposed the same retry-successor class outside
  ask-first execution: a planner activation job failed with
  `codex_prompt_delivery_failed / delivery_anchor_missing`, then CCB auto-retry
  created a completed successor, but role-output import still consumed the
  original failed job and wrote `role_output_import_blocked`. Source repair now
  resolves completed retry successors for frontdesk/planner/orchestrator/
  task_detailer role-output imports, records retry lineage in script-owned
  evidence, and treats a successor import as satisfying the original activation.
- Talk2 local verification after these repairs:
  `test/test_v2_ccbd_dispatcher.py test/test_loop_capacity_cli.py
  test/test_plan_tasks_cli.py test/test_v2_ask_service.py` -> `213 passed`,
  plus py_compile and `git diff --check` for the touched frontdesk and
  ask-first surfaces.
- Latest local verification for the sequence23/worker3 follow-up repairs:
  `test/test_phase6b_l1_l4_frontdesk_runner.py` -> `21 passed`;
  `test/test_loop_capacity_cli.py -k 'auto or ask_first or direct_execution or
  retry_successor or role_output_import'` -> `50 passed, 66 deselected`; and
  py_compile passed for `role_output_import.py`, `loop_runner.py`, the
  sequence runner, and the touched tests.
- Fresh real-provider retake `job_cb53e5eb2d6b` is in flight. It must prove,
  from a fresh `/home/bfly/yunwei/test_ccb2` root with inherited provider
  environment, frontdesk default-plan bootstrap, planner handoff,
  orchestrator/worker/reviewer/round-reviewer execution, retry-successor
  lineage if present, task terminal authority, and dynamic coder/reviewer
  release. Until that artifact is inspectable and passes, deployment readiness
  remains blocked.
- Latest strict-audit update:
  - worker1 `job_c8174e64f651` is accepted as a real single-task
    frontdesk-to-terminal pass. Fresh root
    `/home/bfly/yunwei/test_ccb2/deploy-frontdesk-default-plan-e2e-worker1-20260707191048`
    proved empty-project `frontdesk-intake` bootstrap, frontdesk -> planner ->
    orchestrator -> worker -> reviewer -> `ccb_round_reviewer`, final task
    `done`, `round_result=pass`, project tests passing, and dynamic release
    for loop `lp924e60` with `released_count=2`, `retained_count=0`, observed
    topology `agents=[]`, and only resident roles in final `ps`.
  - worker3 `job_5b7340b05ef8` is accepted as blocker exposure, not readiness
    evidence. A single frontdesk ask produced two planner authority paths: the
    desired dispatcher/frontdesk handoff and a legacy loop-runner frontdesk
    role-output import path. Source repair now treats an existing
    `.ccb/runtime/frontdesk-handoff/<job>.json` marker with status
    `starting`/`started` as authoritative and returns
    `frontdesk_handoff_already_started` instead of submitting a second planner
    job. Failed/blocked handoff markers stay blockers and do not fall back to
    a second planner path.
  - worker2 `job_a62553e07afe` is accepted as blocker exposure for the L1-L4
    route-mix lane. L1 and L2 direct rows reached `done/pass`; L3 observed
    `needs_detail` and task_detailer replied with a `detail_ready`
    recommendation, but role-output import rejected the reply as
    `task_detailer_reply_missing_required_sections` because the real provider
    used markdown headings such as `## task-detail-design.md` and inner human
    headings such as `# Task Detail Design`. Source repair now parses both
    bold-label and markdown-heading task_detailer sections while avoiding
    extensionless inner-heading terminators. Verified locally:
    `test_loop_runner_imports_task_detailer_markdown_heading_sections` ->
    pass; focused task_detailer/needs_detail selection -> `4 passed`; full
    `test/test_loop_capacity_cli.py` -> `118 passed`; py_compile and
    `git diff --check` clean for the touched surface. A fresh worker2 L1-L4
    real-provider rerun is required before this lane can be accepted.

## Current Boundary

Accepted already:

- Phase 6A fake-provider source-wrapper matrix for single-round capability.
- Phase 6B bounded real-provider single-round capability from L0, L1-L4
  repeat12, and L5 partial repeat4.

Not accepted for deployment readiness yet:

- Production/default enablement.
- Long-running multi-round workflow convergence.
- Arbitrary workflow authoring.
- Post-detail execution after `detail_ready`.
- Reviewer-rework stability.
- Frontend/manual entry path as a fully automated workflow start.
- UI/sidebar agent switching as an operator-ready surface.

## Known Post-Acceptance Evidence

- Manual real-provider pressure project:
  `/home/bfly/yunwei/test_ccb2/manual-real-pressure-20260707-103713`.
- Three direct-execution tasks reached `done`, `next_owner=terminal`, route
  `direct_execution`, and `round_result=pass`.
- Project tests passed: `17 tests`.
- Resident `ps` after the run showed only frontdesk, planner, orchestrator,
  task_detailer, and ccb_round_reviewer.
- Dynamic loop release evidence for `lp7898e3`, `lp7753a0`, and `lp0614a4`
  shows observed topology `agents=0`, `released_count=2`, `retained_count=0`,
  and loop coder/code_reviewer lifecycle `removed` / `unloaded`.

This is useful evidence, but it does not by itself satisfy deployment
readiness because it does not cover the full UI/sidebar operator path or the
full L1-L4 route mix after the latest source changes.

## Known Regression Risk

Historical sequence13 evidence exists at
[../history/phase6b-real-provider-l1-l4-sequence13-b7-20260705.md](../history/phase6b-real-provider-l1-l4-sequence13-b7-20260705.md).
It is `Status: not_claimable`. The L2 row records
`round_result_source=supervisor_timeout_after_reviewer_pass`.

That failure is treated as a deployment-readiness regression risk even though
the older bounded Phase 6B claim used sequence12 evidence. The observer bug
found during the 2026-07-07 pressure run was repaired locally:

- `pend --watch` / `watch` no longer impose a default 10 second timeout.
- `CCB_WATCH_TIMEOUT_S=<positive seconds>` still provides an explicit
  diagnostic timeout.
- Focused tests passed for default no-timeout and explicit-timeout behavior.
- A completed real job from the pressure project was re-read through
  `ccb_test pend --watch` with the project role store loaded and produced the
  terminal event stream.

The sequence13 `not_claimable` result is an active contradiction gate for any
claim that L1-L4 real-provider workflow is stable on the latest source. Older
repeat12 pass evidence and the 2026-07-07 three-task pressure run must not be
used to close this gate. Deployment readiness requires a fresh real-provider
L1-L4 regression that explicitly compares against the sequence13 failure shape
and proves the observer no-default-timeout repair in the same evidence set.

## Active Worker Jobs

| Lane | Worker | Job | Required evidence |
| :--- | :--- | :--- | :--- |
| Frontdesk real entry E2E | worker1 | `job_0caf0ca1c344` | Fresh real-provider root; frontdesk=codex; user natural-language task starts at frontdesk; frontdesk creates intake evidence and automatically hands off to planner; planner/orchestrator/execution happens without manual planner activation; at least two direct-execution tasks; fixed JSON/JSONL evidence rows plus task, job, round, changed-file, test, and dynamic-release evidence. |
| L1-L4 regression | worker2 | `job_cd6b21bc5896` | Fresh L1-L4 real-provider run started through frontdesk natural-language entry; no manual planner activation before frontdesk handoff; explicit comparison to sequence13; no default watch timeout false failure; L1/L2 pass, L3 detail_ready, L4 macro and blocked valid non-success; module-level rows and B7/equivalent JSON evidence. |
| Runtime/UI/lifecycle stress | worker3 | `job_153786148bfd` | At least five frontdesk-entry bounded tasks across complexity levels: L0-L2 direct execution, one L3 needs_detail, one L4 macro_adjustment_request or blocked, and one L5 partial or reviewer-rework observation; dynamic loop release after each direct execution; positive busy-retain evidence; resident role reachability; independent project socket/tmux; sidebar/agent-switch evidence or precise blocker. |

Supplemental stricter-gate requests were submitted after reviewer audit
hardening:

- worker1 `job_ec6a6a8b2ef8`
- worker2 `job_a8d5fddd2a67`
- worker3 `job_553ecdfb89ca`

These supplemental jobs must use the fixed row schema and the updated
module/UI/lifecycle gate. Older artifacts may remain useful raw evidence, but
they do not satisfy deployment readiness unless they meet the stricter gate.

Additional strict retest asks were submitted on 2026-07-07 after the first
supplemental batch:

- worker1 `job_e6cffc269af4`
- worker2 `job_ac5fef15fa2a`
- worker3 `job_731bc4142333`

As of the latest local state check, worker1 `job_e6cffc269af4` is completed
and passes the Frontdesk=Codex direct-execution retest lane. worker2
`job_a8d5fddd2a67` is completed as `BLOCKER / not_claimable` for the stricter
L1-L4 lane and also landed a focused retry-policy source repair. A new fresh
post-repair L1-L4 retest is assigned to worker2 as `job_93f0288df5f7`.
worker3 `job_553ecdfb89ca` is completed as `BLOCKER / not deployment-ready`;
its artifact is blocker evidence, not readiness evidence. The older queued
worker2 ask `job_ac5fef15fa2a` failed with an empty artifact and is not
evidence; later worker3 ask `job_731bc4142333` also failed with an empty
artifact and is not evidence.

Worker2 `job_93f0288df5f7` completed the fresh sequence16 retest from
`/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence16-worker2-20260707120823`
after worker1's explicit-project ask repair. The frontdesk target blocker is
cleared, but sequence16 is still `not_claimable`: L1 reached
`direct_execution -> done/pass`; L3 reached `needs_detail -> detail_ready`; L4
macro reached `macro_adjustment_request -> replan_required`; L4 blocked reached
`blocked -> blocked`; L2 reached `direct_execution` but became terminally
`blocked` before worker/reviewer execution because rolepack/bootstrap setup
failed. Logs show `roles_install_all.stderr` reporting `role source not found`
for `agentroles.ccb_frontdesk`, `agentroles.ccb_planner`,
`agentroles.ccb_task_detailer`, `agentroles.ccb_orchestrator`,
`agentroles.ccb_round_reviewer`, and `agentroles.code_reviewer`. The generated
B7 also missed task-show/round evidence for direct rows and preserved stale
dynamic residue from `loop-lpa2c402-*` despite post-B7 cleanup returning
`state: unmounted`. This is a sequence driver/B7 evidence blocker, not accepted
L1-L4 evidence. worker3 `job_553ecdfb89ca` returned
`BLOCKER / not deployment-ready`: it passed UI/sidebar switching,
busy-retain, and observer timeout rows, but found direct-execution release
residue, repeated `task_detailer` activation for the same `needs_detail` task,
provider delivery failures, and incomplete route mix. A focused repair for the
release and `needs_detail` lifecycle blockers landed as worker3
`job_fb4475224824`: task_detailer output now imports detail artifacts once and
settles `detail_ready`, and release reconcile now performs one bounded non-busy
residue retry. Talk2 accepts this as source repair only; a fresh real-provider
stress rerun is still required. These live and completed blocker states are not
acceptance evidence.

Worker1 `job_df3c9451c8b5` is accepted as source repair for the sequence16
rolepack/bootstrap and B7 evidence blocker. It fixes source-test draft RolePack
discovery, validates installer-compatible `catalog.level = "experimental"`,
switches the maintained sequence packet to real `ccb_test roles install
--skip-tools` role seeding with install metadata checks, observes/reuses
existing task records, and repairs B7 to read round evidence from task-show
artifact paths while requiring successful cleanup evidence before stale topology
residue can be treated as released. Talk2 verified the 94-test targeted bundle,
py_compile, no remaining invalid draft catalog levels, and a source-wrapper
smoke that installed all seven required roles into a fresh local role store from
`/home/bfly/yunwei/test_ccb2`. This does not close deployment readiness; it
authorizes the next fresh sequence17 retest lane.

Worker2 `job_6437d7ef41ea` completed sequence17 from fresh root
`/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence17-worker2-20260707-131428`.
The run is `not_claimable`. It confirms the repaired role seeding path and a
clean final `kill_status: ok` / `state: unmounted` cleanup, but exposes a new
harness/controller blocker. The frontdesk-started natural-language request
created a meta direct-execution task
`fresh-sequence17-real-provider-deploymen-20260707052218`, whose worker changed
evidence/report files and deleted or renamed existing project-root authority
files in its isolated workspace; ask-first correctly blocked promotion with
`round_result_source=isolated_workspace_deletions_unsupported`. The driver then
created and started a separate manual L1 task
`phase6b-l1-doc-direct-execution`; cleanup ran while that worker job was still
incomplete, producing `ask_job_incomplete`. The generated B7 also used stale
pre-terminal task-show evidence and missed available round summaries. This is
not a valid provider-task failure and not deployment evidence. The next focused
repair must make the frontdesk-started request and L1-L4 sequence one
authoritative flow, prevent cleanup before terminal round authority, and
regenerate B7 from final task-show plus round artifacts.

Talk2 audited worker1 `job_08f4c86e3973` as the focused source/static repair
for the sequence17 harness/controller blocker. During that audit, talk2 found
and fixed one additional guard gap before allowing a new real-provider run:
the driver rejected incomplete `round.json` authority but still allowed live
ask-first pending authority in `round.pending.json` and
`ask_first_stage_state.json`. The regression first failed, then passed after
the driver was hardened to stop with rc 78 on either pending file. Talk2 also
removed explicit provider timeouts from the provider-running `loop runner
--once` paths in the sequence12 driver so real-provider asks complete by
natural/persisted delivery instead of shell or CLI timeout truncation. Verified:
`test_phase6b_l1_l4_launch_request_doc.py` (`30 passed`), `test_rolepacks.py`
(`66 passed`), focused pending/timeout loop regressions (`78 passed, 128
deselected`), and `git diff --check`.

Fresh post-hardening real-provider asks are in flight:

- worker3 `job_89215d1865e5`: single-round dynamic-node unload stress test
  under a fresh `/home/bfly/yunwei/test_ccb2` root, inherited system provider
  environment, real direct-execution provider paths, no explicit provider
  timeout, and per-case audit of dynamic agents before/after terminal rounds.

Worker2 `job_a1edbee23686` returned `BLOCKER`, but talk2 rejects it as
runtime evidence because the reported fresh root
`/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence18-worker2-20260707135847`
does not exist on disk, and the reported B7, rows, and command log paths are
therefore not inspectable. A local search found no matching sequence18
frontdesk root; the latest matching L1-L4 root remains the old sequence17
directory with 13:33 timestamps. That root's command log also still contains
stale sequence14 activation labels and duplicate task-create behavior. This is
classified as `invalid_worker_evidence / harness_execution_drift`, not a
product pass or product failure. The next repair is to provide workers a
single parameterized, non-stale real-provider runner that emits a manifest with
the root, B7, rows, and command log paths before another L1-L4 retest is
accepted.

After the task-set contract repair, talk2 submitted worker2
`job_a67f6b1eba47` for a fresh sequence20 L1-L4 real-provider run. Local
evidence under
`/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence20-worker2-20260707151304`
shows the root was created and startup reported all five resident agents idle,
but the immediate runner `ps` readiness probe wrote an empty stdout with rc 0.
A manual diagnostic with the same lab-local `AGENT_ROLES_STORE` then produced
the expected five idle resident agents. Talk2 classifies this as a harness
readiness race, not deployment evidence. A focused source repair now retries
only missing/empty resident `ps` state for a bounded three attempts; explicit
`degraded` or `busy` state still fails immediately, and persistent empty output
still fails as `resident_agents_not_ready`. Verified:
`test/test_phase6b_l1_l4_frontdesk_runner.py` (`16 passed`), focused
frontdesk/planner task-set selection (`12 passed, 101 deselected`),
`py_compile`, and `git diff --check`. Sequence20 is consumed/non-claimable; a
fresh sequence21 or later retest is required.

Worker3 `job_89215d1865e5` created fresh root
`/home/bfly/yunwei/test_ccb2/deploy-single-round-unload-worker3-20260707140207`
and installed the required rolepacks, but the first frontdesk ask failed before
provider execution with `unknown agent: frontdesk`. The root's
`.ccb/ccb.config` mounts only `bootstrap:codex` under `[windows]`; the required
frontdesk/planner/orchestrator/task_detailer/ccb_round_reviewer definitions
exist only under `[loop.role_profiles.*]`. Per
[../../../../ccb-config-layout-contract.md](../../../../ccb-config-layout-contract.md),
role/profile declarations are not topology authority and do not create ask
targets; an agent must be referenced by compact layout or `[windows]` to be
configured and mounted. This is classified as
`invalid_worker_harness / resident_agent_not_mounted`, not a provider task
result. A worker1 addendum `job_e19d3a0c25a5` now requires the parameterized
runner to generate resident mounted ask targets for `frontdesk`, `planner`,
`orchestrator`, `task_detailer`, and `ccb_round_reviewer`, while keeping
`coder` and `code_reviewer` as dynamic loop profiles.

A later read of the same root found `.ccb/ccb.config` had been changed to a
compact resident layout, but `.ccb/agents/` still contained only
`bootstrap/agent.json`; the resident agents were not mounted. This narrows the
blocker: the runner must write the resident-agent config before startup, or
reload/apply it before use, and must validate mounted resident agents before
the first `ask frontdesk`. A second worker1 addendum `job_c515d0f1736e`
requires that guard and a regression for the bad state where config mentions
frontdesk but `.ccb/agents/frontdesk/agent.json` is absent.

Worker1 `job_a0fac3efdb4c` returned a source-tracked
`phase6b_l1_l4_frontdesk_runner.py` that resolves the inspectable manifest,
fresh-root, stale-label, no-provider-timeout, and pending-round guard pieces.
Talk2 audit found that it still lacks the mounted-resident-agent guard required
by the worker3 failure: the tests do not reproduce the state where config names
frontdesk but `.ccb/agents/` contains only bootstrap. A focused worker1
follow-up `job_83494eb661b7` now requires `RESIDENT_AGENT_TARGETS`, manifest
resident-target metadata, post-start/pre-frontdesk `agent.json` validation, a
hard `resident_agents_not_mounted` harness failure, and positive/negative tests.

Worker1 `job_e19d3a0c25a5` completed the config/static portion of that repair:
the manifest lists resident ask targets and generated config mounts
frontdesk/planner/orchestrator/task_detailer/ccb_round_reviewer through
`[windows]` while keeping coder/code_reviewer dynamic. Talk2 rejected it as a
complete fix because it still does not validate actual mounted resident
authority after startup. The exact worker3 bad state can still exist: config
names frontdesk, but `.ccb/agents/frontdesk/agent.json` is absent. A stricter
worker1 follow-up `job_7ebb314a7bcc` now requires a runtime guard before
`frontdesk-entry`: all resident `agent.json` files must exist or the harness
must fail with `resident_agents_not_mounted` before any `ask frontdesk`.
Worker1 `job_c515d0f1736e` then landed that negative runtime guard: manifest
records resident spec paths, `init` validates after startup, `frontdesk-entry`
validates before `ask frontdesk`, and the bootstrap-only worker3 bad state now
fails before writing a frontdesk ask command log. Talk2's follow-up audit found
one remaining test gap before accepting the runner as retest-ready: there must
also be a positive test proving that when all resident `agent.json` files
exist, `frontdesk_entry()` reaches the `frontdesk_entry_ask` command path. That
gap is assigned to worker1 as `job_c82254482242`.

Worker1 `job_83494eb661b7` completed the positive source/static coverage: all
resident `agent.json` files present allows `frontdesk_entry()` to reach the
stubbed `ccb_test --project ... ask frontdesk -- ...` command path. Talk2
verified the runner tests now pass with `9 passed`. This closes the
`agent.json` existence guard but not deployment readiness.

Worker3 `job_89215d1865e5` later produced a real root
`/home/bfly/yunwei/test_ccb2/deploy-single-round-unload-worker3-20260707143000`
that is still invalid as readiness evidence. It contains older 2026-07-06
files and B7/log residue, so it is not a clean fresh root. More importantly,
although all resident `agent.json` files exist, `initial_ps.stdout` shows every
resident agent as `state=degraded`, and the first frontdesk ask fails with
`codex_prompt_delivery_failed / delivery_anchor_missing`. The job snapshot
diagnostics show `delivery_checked_session_root` under the current root but
`delivery_current_log_path` under the old donor root
`/home/bfly/yunwei/test_ccb2/deploy-e2e-manual-simple-direct-sequence37-20260706`.
This is classified as `invalid_worker_harness / stale_provider_session_binding`
plus `resident_agents_not_ready`, not a product task result. A new worker1
source/static guard request `job_69c0af75ac18` requires the runner to validate
resident readiness, not just agent spec existence, before any future
`frontdesk-entry`.

Worker1 follow-up `job_c82254482242` plus talk2 local hardening close the
source/static guard: `phase6b_l1_l4_frontdesk_runner.py` now records resident
spec paths, validates all five resident `agent.json` identities, parses
`ccb_test --project <project> ps`, and refuses both `init` and
`frontdesk-entry` unless `frontdesk`, `planner`, `orchestrator`,
`task_detailer`, and `ccb_round_reviewer` are present and `state=idle`.
`degraded`, `busy`, and missing ps entries fail as
`resident_agents_not_ready` before any `ask frontdesk`. Talk2 verified the
runner tests now pass with `13 passed`; this is source/static hardening only,
not fresh real-provider readiness evidence.

Fresh post-guard real-provider retest asks were submitted after this repair:

- worker1 `job_df0ee0c52429`: frontdesk=codex direct-execution smoke with
  fixed evidence rows, resident idle preflight, project-root tests, and dynamic
  release proof.
- worker2 `job_e8f28dbc52f5`: fresh L1-L4 frontdesk-started route-mix
  regression using the maintained runner and resident idle preflight.
- worker3 `job_1c6a378536be`: UI/lifecycle pressure lane with dynamic unload,
  busy-retain, sidebar/operator evidence, and resident idle preflight.

These jobs are not evidence until their roots, B7/rows/report files, command
logs, and cleanup artifacts exist and are inspected. Any `resident_agents_not_ready`
or stale provider session binding result is accepted as blocker exposure, not
as deployment readiness.

## Post-Guard Callback Audit Procedure

When `job_df0ee0c52429`, `job_e8f28dbc52f5`, or `job_1c6a378536be`
returns, audit the artifact before changing claim state:

1. Confirm the reply names fresh, absolute paths for root, project, rows or
   B7/report, and command log; reject the reply as `invalid_worker_evidence`
   if any named path is missing or points to a consumed root.
2. Inspect the command log and environment evidence for inherited system
   provider homes. Reject any run that exports lab-local `HOME`,
   `CCB_SOURCE_HOME`, uses fake provider, or sets `CCB_SOURCE_RUNTIME_OK`.
3. Inspect `resident_ps_after_start` and
   `resident_ps_before_frontdesk_entry`. All five resident roles must be
   present and `state=idle` before the first `ask frontdesk`; otherwise record
   `resident_agents_not_ready` as a blocker exposure.
4. Verify the first task entry is natural-language frontdesk intake. Reject
   manual planner activation, pre-created task authority, or hard-coded route
   injection as deployment evidence.
5. Verify task state, route, and round outcome are script-owned imports. Treat
   provider replies as evidence only; reject provider-side authority mutation.
6. For direct-execution rows, inspect project-root file/test evidence,
   round_summary import, and dynamic coder/code_reviewer release evidence.
   Residue without a bounded reason is a blocker.
7. For UI/lifecycle rows, require operator-visible sidebar/socket/tmux
   evidence or a precise blocker. Backend-only evidence cannot prove the UI
   lane.
8. Confirm B7/evidence rows were written before cleanup and cleanup ran only
   after no pending ask-first or round authority remained.
9. Classify each row as `pass`, `valid_non_success`, `blocker`,
   `provider_failure`, `role_failure`, `test_design_failure`, or
   `invalid_worker_evidence`; do not fold non-success rows into `pass`.

## Worker Evidence Triage

| Worker job | Triage | Notes |
| :--- | :--- | :--- |
| worker1 `job_0caf0ca1c344` | `valid_raw_functional_evidence` / not deployment-ready pass | Fresh root `/home/bfly/yunwei/test_ccb2/deploy-frontdesk-real-e2e-worker1-20260707-110801` shows two frontdesk-started direct-execution tasks reaching `done/pass`, project-root changes, tests, round_summary authority, and dynamic release. It does not meet the current fixed evidence-row gate: `evidence_rows.json` is missing required fields including `case_id`, `fresh_root`, `entrypoint`, `complexity_level`, `provider_home_policy`, `agent_roles_store`, `expected_route`, `route_decision_correct`, `test_commands`, `test_result`, `dynamic_release`, `busy_retain`, `resident_reachability`, `authority_checks`, `module_checks`, `ui_checks`, `observer_checks`, `classification`, `evidence_paths`, and `diagnosis`. |
| worker1 `job_ec6a6a8b2ef8` | `pass` for Frontdesk real entry E2E lane only | Supplemental fixed evidence rows at `/home/bfly/yunwei/test_ccb2/deploy-frontdesk-real-e2e-worker1-20260707-110801/gate_evidence_rows.json` and `.jsonl` contain two rows, all required top-level fields, and existing evidence paths. The rows prove frontdesk natural-language entry, automatic frontdesk handoff to planner, direct_execution route correctness, project-root changes, script-owned task/round authority, dynamic release, resident reachability, inherited provider environment, and no topology dispatch for the L1/L2 direct-execution frontdesk lane. `busy_retain`, UI/sidebar switching, and explicit timeout behavior remain `n/a` in this lane and are still required from the worker3/UI and worker2/regression lanes before deployment readiness. |
| worker1 `job_e6cffc269af4` | `pass` for Frontdesk=Codex direct-execution retest lane only | Fresh root `/home/bfly/yunwei/test_ccb2/deploy-frontdesk-codex-e2e-worker1-20260707-114105` has fixed rows at `gate_evidence_rows.json` and `.jsonl`; validation reports `problems: []`. The row proves a natural-language frontdesk=codex request reached automatic planner handoff, route orchestrator `direct_execution`, coder, code_reviewer, execution orchestrator, `ccb_round_reviewer`, script-owned round import, project-root tests, final task `done/pass`, and dynamic release `released_count=2`, `retained_count=0`. It is not a deployment-ready pass because this row explicitly leaves busy-retain, UI/sidebar, and broader L1-L4 route mix outside scope. |
| worker2 `job_cd6b21bc5896` | `valid_raw_l1_l4_regression_evidence` / not deployment-ready pass | Fresh root `/home/bfly/yunwei/test_ccb2/deploy-l1-l4-real-sequence14-worker2-20260707110802` shows L1/L2 `direct_execution -> done/pass`, L3 `needs_detail -> detail_ready`, L4 `macro_adjustment_request -> replan_required`, and L4 `blocked -> blocked`; B7 says `Status: pass`, cleanup is `ok/unmounted`, and the sequence13 timeout shape was not reproduced. It does not satisfy the current deployment gate because the command log starts from supervisor/driver `plan task-create` and `loop runner --once`, not frontdesk natural-language intake; the rows also miss required fields such as `case_id`, `fresh_root`, `entrypoint`, `complexity_level`, `provider_home_policy`, `agent_roles_store`, frontdesk/planner/orchestrator job ids, `busy_retain`, `resident_reachability`, `module_checks`, `ui_checks`, `observer_checks`, `evidence_paths`, and `diagnosis`. |
| worker2 `job_a8d5fddd2a67` | `BLOCKER / not_claimable`; focused retry repair landed | Fresh root `/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence15-worker2-20260707113648` is a stricter frontdesk-started L1-L4 attempt. Evidence paths include `phase6b-real-provider-l1-l4-sequence15-b7-20260707.md`, `gate/worker2_sequence15_gate_evidence_rows.jsonl`, and `gate/worker2_sequence15_structured_report.md`. It proves natural-language frontdesk entry, controller handoff to planner, inherited `HOME=/home/bfly`, no lab-local `HOME/CCB_SOURCE_HOME`, explicit `CCB_WATCH_TIMEOUT_S=1` diagnostic timeout, default watch beyond the old 10 second window, and dynamic release for the frontdesk-created combined task. Formal L1 reached `direct_execution`, worker/reviewer completed, and round reviewer reported pass, but final round orchestrator delivery failed with `codex_prompt_delivery_failed / delivery_anchor_missing`; final task status is `blocked`, L2-L4 were not reached, and B7 is not claimable. Source repair in `lib/ccbd/services/dispatcher_runtime/finalization_retry_runtime/policy.py` now honors `decision.diagnostics.delivery_retryable=true` without overriding non-retryable API failures; talk2 re-verified retry tests and py_compile. Fresh post-repair retest assigned as worker2 `job_93f0288df5f7`; sequence15 is consumed failure evidence and must not be reused. |
| worker2 `job_93f0288df5f7` | `BLOCKER / not_claimable`; sequence driver/B7 blocker | Fresh root `/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence16-worker2-20260707120823` cleared the explicit-project frontdesk target blocker and produced partial route evidence: L1 `direct_execution -> done/pass`, L3 `needs_detail -> detail_ready`, L4 macro `macro_adjustment_request -> replan_required`, and L4 blocked `blocked -> blocked`. L2 reached `direct_execution` but became terminally `blocked` before worker/reviewer execution because rolepack/bootstrap setup failed: `roles_install_all.stderr` reports `role source not found` for required CCB route roles. The B7/equivalent report at `/home/bfly/yunwei/test_ccb2/phase6b-real-provider-l1-l4-sequence16-b7-20260707.md` is `not_claimable`: direct rows are missing task-show/round evidence, `script_owned_round_imports=false`, and stale dynamic residue remains in the report even though cleanup returned `state: unmounted`. This exposes a sequence driver and evidence-normalizer blocker; it is not a deployment-ready pass. |
| worker3 `job_153786148bfd` | `valid_raw_ui_lifecycle_evidence` / not deployment-ready pass | Fresh root `/home/bfly/yunwei/test_ccb2/deploy-runtime-ui-lifecycle-worker3-20260707111025` provides strong raw runtime evidence: five real frontdesk asks, five serial direct-execution rounds, sidebar target switching through `__sidebar-click`, resident planner/task_detailer askability after reflows, default `pend --watch` waiting past the historical 10 second window, explicit `CCB_WATCH_TIMEOUT_S=1` timeout behavior, and per-loop dynamic unload with `agents=[]`, `released_count=2`, `retained_count=0`, and loop lifecycle `removed` / `unloaded`. It is not a deployment-ready pass because the execution mode created/imported task authority by script after frontdesk asks and then ran `loop runner --once` one task at a time, so it does not prove full automatic frontdesk-to-planner-to-orchestrator progression; it also lacks the required fixed JSON/JSONL evidence row shape and does not include positive `retained_busy` release evidence. |
| worker3 `job_553ecdfb89ca` / `job_fb4475224824` | `BLOCKER / not deployment-ready`; focused lifecycle source repair accepted | Fresh root `/home/bfly/yunwei/test_ccb2/w3rtui-20260707114508` uses inherited provider environment and a project-local role store. Evidence rows at `gate_evidence_rows.json` and `.jsonl` have 8 rows with required fields and valid referenced paths. Positive rows: `w3-busy-retain-positive` proves bounded busy retention then idle release, `w3-ui-sidebar-switch` proves sidebar switching across frontdesk/planner/task_detailer/orchestrator/ccb_round_reviewer on the fresh socket/tmux, and `w3-observer-watch-timeouts` proves default watch can exceed the old 10s window while explicit 1s timeout remains diagnostic. Blocking rows: direct execution release left `lp38a34c` dynamic agents present after auto-release timeout until manual release recovered; `needs_detail` reached task_detailer and received detail content but repeatedly reactivated task_detailer instead of settling/importing `detail_ready`; provider delivery failures prevented full route mix. Focused source repair `job_fb4475224824` updates task_detailer role-output import to write `detail_design`, `detail_summary`, and `detail_packet` once, settle `detail_ready`, and add a one-time non-busy release retry for transient residue. Talk2 verified focused and nearby guard tests, but no real-provider stress rerun has proven the repair yet. |
| worker1 `job_c82254482242` + talk2 local hardening | `source_static_guard_accepted` / not deployment-ready pass | The frontdesk L1-L4 runner now blocks stale/degraded resident mounts by requiring mounted resident specs plus live `ps` state `idle` for all five resident roles before `init` proceeds past startup or `frontdesk-entry` submits `ask frontdesk`. Talk2 tightened the guard so `busy` is not treated as ready on a fresh preflight. Verified `test/test_phase6b_l1_l4_frontdesk_runner.py` -> `13 passed` and py_compile for the runner/test. No real-provider retest has consumed this repair yet. |
| worker1 `job_df0ee0c52429` / worker2 `job_e8f28dbc52f5` / worker3 `job_1c6a378536be` | `in_flight` | Fresh post-resident-idle real-provider retest wave. Required before acceptance: inspectable fresh roots under `/home/bfly/yunwei/test_ccb2`, inherited provider home, no fake provider, live resident `ps` all idle before frontdesk ask, fixed JSON/JSONL rows, script-owned authority evidence, dynamic release/retention evidence, cleanup after B7, and no missing evidence paths. |

## Active Reviewer Audits

These audits are read-only scope checks. They do not replace raw evidence
inspection and do not approve deployment readiness. They do define current
deployment-readiness blockers and high-severity gates.

| Reviewer | Job | Scope | Result |
| :--- | :--- | :--- | :--- |
| reviewer1 | `job_50c72bc31578` | Check whether this supervision page and audit matrix miss acceptance-goal requirements or allow fake deployment readiness. | HIGH gaps found; no final approval. |
| reviewer2 | `job_7c18b7d9e333` | Independently check Phase 6A/6B boundary, sequence13 contradiction handling, evidence-row shape, and reviewer/talk2 responsibility split. | BLOCKER B1 plus HIGH gaps; no final approval. |

## Non-Negotiable Failure Criteria

Stop and repair before claiming deployment readiness if any worker evidence
shows:

- Frontdesk asks for a plan slug or human planner activation instead of doing
  the initial handoff from a user request.
- Provider-side commands mutate task authority fields directly.
- Runner, supervisor, or normalizer infers task status, route, or round result
  from provider conversation text instead of script-owned imports.
- Topology dispatch or communication DSL fields become the runner mainline.
- `blocked`, `partial`, timeout, or reviewer rejection is imported as `done`
  or `pass`.
- A B7/normalizer report emits `Status: pass` without reviewer-gated row
  evidence, or folds `not_claimable` / `valid_non_success` rows into `pass`.
- Worker/reviewer success is validated only in an isolated copy workspace while
  project-root authority evidence is missing.
- Dynamic loop agents remain active, retained, or present in config without a
  bounded reason.
- UI/sidebar state cannot switch to required resident agents and the failure is
  not precisely classified.
- Real-provider runs use fake provider, lab-local HOME, or lab-local
  CCB_SOURCE_HOME when the test is meant to inherit the system provider
  environment.
- Any worker evidence uses `CCB_SOURCE_RUNTIME_OK=1` for ordinary validation.
- `ccb_test` runtime validation runs from `ccb_source` instead of
  `/home/bfly/yunwei/test_ccb2`.
- Frontdesk receives a hard-coded plan slug, task id, or pre-scripted command
  instead of a natural-language user task.
- A required task/UI/lifecycle case has no fixed JSON/JSONL evidence row.

## Deployment Review Ownership

For each worker reply, `talk2` performs evidence triage only:

1. Read the full artifact reply before deciding.
2. Verify the fresh root, command shape, inherited provider-home policy, and
   project-local role store.
3. Inspect authoritative evidence rather than trusting summary text:
   task-show output, round_summary, orchestration_notes, topology observed
   files, dynamic lifecycle records, `ps`, tests, B7 rows, and command logs.
4. Classify each row as `pass`, `valid_non_success`, `system_failure`,
   `provider_failure`, `role_failure`, or `test_design_failure`.
5. Convert any blocker into a focused repair task with a reproduction command
   and a required regression test.
6. Do not mark the active goal complete until deployment-readiness evidence
   covers frontdesk entry, route mix, dynamic release, UI/sidebar visibility,
   and observer behavior.
7. Submit the completed evidence packet to the independent deployment audit
   lane. `talk2` must not issue the final deployment-readiness verdict.

## Evidence Audit Matrix

Use this matrix when worker artifacts arrive. A summary claim is not enough;
each item needs direct current-state evidence from the fresh test root or
source tree.

| Requirement | Acceptable evidence | Reject if |
| :--- | :--- | :--- |
| Fresh real-provider root | Root path under `/home/bfly/yunwei/test_ccb2`, created for the worker lane, with command log and project-local `.ccb` anchor. | Root reused from sequence/repeat history, missing command log, or source checkout used as runtime root. |
| Inherited provider environment | Command log or env print shows no lab-local `HOME` or `CCB_SOURCE_HOME` export; provider profiles inherit system auth/config. | Fresh provider home is forced for real-provider test or login churn is caused by test harness. |
| Project-local role store | `AGENT_ROLES_STORE=$ROOT/roles` and installed rolepacks include frontdesk, planner, orchestrator, task_detailer, coder, code_reviewer, and round_reviewer. | Command resolves roles from `/home/bfly/.roles/installed` and fails or silently uses a global role drift. |
| Frontdesk starts the workflow | User-facing ask targets `frontdesk` with natural language; frontdesk produces intake evidence and a planner handoff without manual planner ask as the first step. | Frontdesk asks for plan slug, requests supervisor to start planner manually, receives a hard-coded slug/task id, or no planner job is submitted. |
| Planner/orchestrator authority | Planner imports script-owned task anchors; orchestrator route is imported by runner/supervisor script-owned path. | Provider reply text directly mutates task status/route/round authority. |
| Route correctness | Task rows include expected route, observed route, and `route_decision_correct` computed from those values. | Expected/observed route is missing or route correctness is provider-supplied. |
| Direct execution project-root effect | Changed files are present in the project root before reviewer and round reviewer validation; tests run from project root. | Success is based only on `.ccb/workspaces/loop-*` copy workspace changes. |
| Round result authority | `round_summary.md` imported through script-owned path with actor/job id/digest and final task status matching the round result. | Timeout, reviewer rejection, blocked, or partial is rewritten as pass/done. |
| Dynamic release | Observed topology for each execution loop has `agents=[]`, `released_count=2`, `retained_count=0`; dynamic lifecycle records are `removed` / `unloaded`. | Loop agents remain active/retained without bounded reason, config still lists dynamic agents, or cleanup hides unexplained residue. |
| Busy-retain safety | During an active provider ask, release evidence shows bounded `retained_busy`; after idle proof, release evidence reaches `released_count>0` and `retained_count=0`. | Busy dynamic agents are killed early, or retained agents are later hidden by cleanup without idle/release proof. |
| Resident role reachability | After dynamic release, `status`, `ps`, or a safe ask/reachability check proves resident frontdesk/planner/orchestrator/task_detailer/round_reviewer remain mounted and reachable. | Dynamic cleanup breaks resident panes, identities, or askability. |
| UI/sidebar visibility | Fresh project socket/tmux path is under the fresh root; evidence includes timestamped surface proof such as screenshot, UI log, `ccb status --json`, and tmux `list-windows`/`list-panes` before/after agent switching. | UI attaches to `ccb_source` backend, sidebar cannot switch without diagnosis, or only a free-form claim is provided. |
| Observer behavior | A real job longer than the old 10 second window can be watched to terminal without default timeout; explicit positive `CCB_WATCH_TIMEOUT_S` remains a diagnostic timeout. | Worker relies on fixed default timeout or marks late terminal completion as failure without persisted terminal check. |
| Module-level Plan/Task Document | Evidence shows task_packet, execution_contract, orchestration_notes, detail artifacts when applicable, and round_summary authority with digest/actor metadata. | Document anchors are missing, provider-authored, or imported through unsupported artifact kinds. |
| Module-level Orchestration | Evidence shows route result enters the correct next owner for direct_execution, needs_detail, macro_adjustment_request, blocked, and partial/rework cases. | Route is manually forced, skipped, or accepted without next-owner transition proof. |
| Module-level Ask Collaboration | Evidence shows ask submit/persist/resume behavior, no provider-memory authority import, and reviewer rejection/partial cannot become hidden pass. | Runner parses provider conversation memory as authority or hides reviewer rejection. |
| Module-level Dynamic Lifecycle | Evidence covers normal release, positive busy-retain, resident reachability, and no dispatch DSL fields in mount-only topology. | Release only proves the happy idle case or topology dispatch fields reappear. |
| Module-level Evidence/Reporting | Every case has a JSON/JSONL row and the final report keeps pass, valid_non_success, not_claimable, and system failure distinct. | Free text is the only evidence, or a normalizer false-positive pass is accepted. |
| Classification | Each row classifies into `pass`, `valid_non_success`, `system_failure`, `role_failure`, `provider_failure`, or `test_design_failure` with human diagnosis. | Non-pass rows are hidden, collapsed to pass, or left unclassified. |
| Final deployment report | A final `history/phase1-6-deployment-readiness-report-<YYYYMMDD>.md` includes phase results, module results, fake-provider matrix, real-provider lab, failure taxonomy, first stable complexity breakpoint, unresolved blockers, Phase 6A/6B boundary, and next priorities. | Final report is missing, owner/reviewer verdict is missing, or bounded Phase 6B evidence is expanded into production/default enablement. |

## Required Evidence Row Shape

Workers may add more fields, but each task or UI/lifecycle case must be
represented by a JSON-compatible row with at least these fields. Free-form
summary text is secondary evidence only.

```json
{
  "case_id": "stable-case-id",
  "fresh_root": "/home/bfly/yunwei/test_ccb2/<fresh-root>",
  "entrypoint": "frontdesk|supervisor_l1_l4|ui_lifecycle",
  "complexity_level": "L0|L1|L2|L3|L4|L5|n/a",
  "provider_home_policy": "inherited_system_environment",
  "agent_roles_store": "/home/bfly/yunwei/test_ccb2/<fresh-root>/roles",
  "expected_route": "direct_execution|needs_detail|macro_adjustment_request|blocked|partial_completion|n/a",
  "observed_route": "direct_execution|needs_detail|macro_adjustment_request|blocked|partial_completion|missing|n/a",
  "route_decision_correct": true,
  "task_id": "task-id-or-null",
  "frontdesk_job_id": "job_* or null",
  "planner_job_id": "job_* or null",
  "orchestrator_job_id": "job_* or null",
  "worker_job_id": "job_* or null",
  "reviewer_job_id": "job_* or null",
  "round_reviewer_job_id": "job_* or null",
  "final_status": "done|detail_ready|replan_required|blocked|partial|missing|n/a",
  "next_owner": "terminal|planner|orchestrator|frontdesk|missing|n/a",
  "round_result": "pass|partial|blocked|detail_ready|replan_required|missing|n/a",
  "round_result_source": "round_reviewer_reply|script_owned_import|missing|n/a",
  "changed_files": [],
  "test_commands": [],
  "test_result": "pass|fail|not_run|n/a",
  "dynamic_release": {
    "loop_id": "loop-id-or-null",
    "observed_agents": 0,
    "released_count": 2,
    "retained_count": 0,
    "lifecycle_removed_unloaded": true
  },
  "busy_retain": {
    "observed": true,
    "retained_busy_count": 1,
    "idle_release_verified": true
  },
  "resident_reachability": {
    "frontdesk": true,
    "planner": true,
    "orchestrator": true,
    "task_detailer": true,
    "round_reviewer": true
  },
  "authority_checks": {
    "provider_reply_authority_parsing_absent": true,
    "script_owned_route_imports": true,
    "script_owned_round_imports": true,
    "topology_dispatch_absent": true,
    "communication_edges_absent": true,
    "project_root_effect_verified": true
  },
  "module_checks": {
    "plan_task_document": true,
    "orchestration": true,
    "mount_topology": true,
    "ask_collaboration": true,
    "dynamic_lifecycle": true,
    "evidence_reporting": true
  },
  "ui_checks": {
    "project_socket_under_fresh_root": true,
    "source_checkout_backend_isolated": true,
    "sidebar_agent_switch_verified": true
  },
  "observer_checks": {
    "default_watch_waited_to_terminal": true,
    "explicit_timeout_still_times_out": true
  },
  "classification": "pass|valid_non_success|system_failure|role_failure|provider_failure|test_design_failure",
  "evidence_paths": [],
  "diagnosis": "short human-readable reason"
}
```

Rows that use `missing`, `not_run`, or `n/a` must explain why in `diagnosis`.
For deployment readiness, an incomplete row is acceptable evidence of a bug,
but not evidence of readiness.

## Current State

Reviewer audits are complete and blocking/high findings have been folded into
this gate. As of 2026-07-07T11:50:57+08:00, worker1 supplemental job
`job_ec6a6a8b2ef8` passes the Frontdesk real entry E2E lane only. worker2
original job `job_cd6b21bc5896` is useful raw L1-L4/sequence13 regression
evidence, but it is not a deployment-readiness pass because it did not start
from frontdesk intake and does not use the fixed row schema. worker3 original
job `job_153786148bfd` is useful raw UI/sidebar, observer, resident
reachability, and dynamic-unload evidence, but it is not a deployment-readiness
pass because task authority was script-created/imported after frontdesk asks,
fixed evidence rows are missing, and positive busy-retain evidence is still
absent. Local ccbd snapshots plus completion artifact
`job_e6cffc269af4-art_1753c4299fb34562.txt` show worker1
`job_e6cffc269af4` is completed and passes the Frontdesk=Codex
direct-execution retest lane with fixed rows under
`/home/bfly/yunwei/test_ccb2/deploy-frontdesk-codex-e2e-worker1-20260707-114105`
showing one L2 frontdesk=codex direct-execution path reached `done/pass` with
clean dynamic release. The row does not cover L1-L4 route mix, UI/sidebar, or
positive busy-retain. worker2 `job_a8d5fddd2a67` is completed and is
`BLOCKER / not_claimable` for the stricter L1-L4 lane. Fresh root
`/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence15-worker2-20260707113648`
proves the frontdesk/planner entry path, inherited provider home, explicit
positive timeout diagnostic, default watch beyond the old 10 second window, and
dynamic release for the frontdesk-created combined task. Formal L1 then stopped
after worker/reviewer success because final round orchestrator provider
delivery failed with `codex_prompt_delivery_failed / delivery_anchor_missing`;
L2-L4 were not reached. worker2 applied a focused retry-policy source repair in
`lib/ccbd/services/dispatcher_runtime/finalization_retry_runtime/policy.py` so
`decision.diagnostics.delivery_retryable=true` can trigger automatic retry
without overriding non-retryable API failures. Talk2 re-ran
`test/test_ccbd_retry_failure_detail.py` (`4 passed`),
`test/test_stability_regressions.py::test_codex_delivery_guard_times_out_after_anchor_never_appears`
(`1 passed`), and py_compile for the touched retry files. A new fresh L1-L4
frontdesk-started retest after this repair was assigned to worker2 as
`job_93f0288df5f7`; sequence15 is consumed failure evidence and must not be
reused. A separate frontdesk auto-runner role-output issue was already repaired:
an earlier failed planner job `job_ce2490255a5a` had been logged repeatedly as
`role_output_import_blocked`, then a later auto-runner for successful planner
job `job_03c5c271f243` stopped on the old failed job instead of consuming the
requested wait job. The source bug was that blocked role-output imports were
not treated as settled for future auto-runner scans. A focused source repair
was assigned to worker1 as
`job_9e95855157d1`; completion artifact
`job_9e95855157d1-art_2036e8fd9d6d4770.txt` is accepted for that focused
repair. The scanner path now treats prior `role_output_import_blocked` records
as settled while leaving explicit consume `ok`-only, so blocked evidence is not
rewritten as pass. Talk2 re-ran `py_compile`, the new regression, the focused
`loop_runner_auto or role_output_import` selection (`9 passed`), and the full
`test/test_loop_capacity_cli.py` file (`109 passed`). The older queued worker2
ask `job_ac5fef15fa2a` failed with an empty artifact and is not evidence; the
active post-repair retest is worker2 `job_93f0288df5f7`. Later worker3 retest
ask `job_731bc4142333` also failed with an empty artifact and is not evidence.
Worker2 `job_93f0288df5f7` completed sequence16 as `not_claimable`: the
frontdesk target blocker was cleared and L1/L3/L4 route evidence exists, but L2
blocked before worker/reviewer execution due rolepack/bootstrap failure and B7
evidence is stale/missing task-show and round imports. worker3
`job_553ecdfb89ca` returned `BLOCKER / not deployment-ready`: positive rows
cover busy-retain, UI/sidebar switching, and observer timeout behavior, but
direct execution can leave dynamic release residue after auto-release timeout,
`needs_detail` can repeatedly reactivate task_detailer instead of settling to
`detail_ready`, and provider delivery failures prevented the full route mix.
Focused repair `job_fb4475224824` is accepted as source repair only: it settles
task_detailer output to `detail_ready` once and adds one bounded non-busy
release retry. These live and completed blocker states are triage observations
only until a fresh real-provider stress rerun proves the repair.
Worker1 `job_69c0af75ac18` added a source/static runner guard for the worker3
resident-agent readiness blocker: after startup and before frontdesk entry, the
maintained runner consumes logged `ccb_test --project <project> ps` output and
fails as `resident_agents_not_ready` unless every resident target is present
and `state=idle`; it also classifies snapshot evidence where
`delivery_current_log_path` points outside the current project root as stale
provider session/log binding. This records a guard only and is not deployment
readiness evidence.
Deployment readiness
remains blocked on independent final audit plus frontdesk-started L1-L4
regression, route/complexity mix, UI/sidebar, busy-retain, observer, and
final-report gates.

## 2026-07-07 Post-Guard Live Audit

Latest visible real-provider evidence is not deployment-ready.

- worker2 `job_e8f28dbc52f5` completed and is `invalid_harness`, not a pass.
  Fresh root:
  `/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence19-worker2-20260707143414`.
  The resident-idle guard passed before frontdesk entry, frontdesk made a
  natural-language intake, auto-handoff to planner was recorded, and planner
  activation was real. The blocker is deeper: planner returned a single
  controller-owned validation meta task
  `controller-owned-real-provider-l1-l4-rou-20260707063849` instead of the
  five L1-L4 route-mix tasks. The runner correctly rejected the run before
  claimable B7/rows were materialized.
- The sequence19 planner snapshot shows the current frontdesk-to-planner
  contract still asks for one `task-packet.md` plus one `readiness.json`.
  That contract can cover a small single task, but it cannot represent the
  requested multi-task route/complexity mix without flattening it into a meta
  task. This is a source contract gap, not a reporting gap.
- The auto-runner then treated the meta task as `direct_execution` and imported
  a blocked `round_summary` after topology apply timed out. That blocked
  evidence is valid failure evidence, but it is not route-mix coverage.
- worker1 fresh root
  `/home/bfly/yunwei/test_ccb2/deploy-frontdesk-codex-idle-smoke-worker1-20260707143308-job_df0ee0c52429`
  also showed valid resident-idle preflight and inherited provider-home
  evidence, but its frontdesk output surfaced an auto-handoff blocker in the
  first observed path. It remains failure evidence until source-level handoff
  behavior is reconciled.
- worker3 visible root
  `/home/bfly/yunwei/test_ccb2/deploy-single-round-unload-worker3-20260707153900`
  appears to reuse old sequence37 evidence and is not acceptable as a fresh
  deployment-readiness lane unless a later artifact identifies a different
  fresh root.

Follow-up work assigned by talk2:

- worker1 `job_8ee629a6634f`: implement and test a source-level
  frontdesk/planner multi-task handoff contract while preserving single-task
  compatibility and rejecting ambiguous meta-task-only output for multi-task
  requests.
- worker2 `job_d54ea15ed764`: harden the maintained frontdesk runner/B7 path
  so unexpected planner meta tasks produce structured non-claimable failure
  evidence instead of an unstructured harness exception.
- worker3 `job_4666f8642b59`: audit visible roots for fresh-root, provider
  environment, resident-idle, dynamic-unload, UI/sidebar, and first-blocker
  evidence quality.

Follow-up callback status:

- worker2 `job_d54ea15ed764` failed with `pane_dead` and produced a zero-byte
  artifact. It is invalid worker evidence and does not satisfy the requested
  runner/B7 hardening work.
- The follow-up source-only repair `job_d67e88548023` is accepted and verified
  by local tests; it hardens the runner/B7 path so unexpected planner meta
  tasks now produce structured `invalid_harness:
  frontdesk_planner_unexpected_meta_task` evidence. A later retry request
  `job_fa7e24e69871` failed with another zero-byte artifact and is not
  evidence.
- worker3 `job_4666f8642b59` completed file-only evidence audit and is
  accepted for evidence classification. It confirms none of the three visible
  roots is deployment-readiness pass evidence: worker1 is
  `valid_non_success` blocked by missing plan root in the first observed
  frontdesk handoff; worker2 is `valid_non_success` with only failed-round
  dynamic release evidence after the L1-L4 matrix collapsed into one meta
  task; worker3 is `invalid_harness` because the visible root reused stale
  sequence37 evidence. UI/sidebar remains unproven in all three roots.
- worker1 `job_8ee629a6634f` completed and is accepted as source repair. The
  source-only frontdesk/planner task-set contract now passes the focused local
  regression set. This is still only source/static evidence; it does not
  prove deployment readiness by itself.

No readiness claim should be made until a fresh real-provider rerun proves:
frontdesk natural-language intake, planner decomposition into the intended task
set, script-owned imports, route execution/review, dynamic-agent release, and
auditable B7 rows before cleanup.

## 2026-07-07 Empty Provider Reply Retry Repair

Fresh real-provider evidence after the frontdesk/planner task-set repair exposed
a deeper dispatcher retry gap, not a timeout problem:

- worker1 root
  `/home/bfly/yunwei/test_ccb2/deploy-frontdesk-default-plan-retry-retake-20260707154728`
  proved empty-project `frontdesk-intake` bootstrap, planner handoff, direct
  execution, worker/reviewer completion, and dynamic release
  (`released_count=2`, `retained_count=0`). The remaining blocker was the
  orchestrator successor job `job_42a518b16c59`, which ended
  `status=incomplete`, `reason=task_complete_empty_reply`,
  `error_type=empty_provider_reply`. The source job
  `job_0501db85242a` had already used retry successor lineage after a delivery
  failure, so this was not a missing role-output retry-successor bug.
- worker2 root
  `/home/bfly/yunwei/test_ccb2/deploy-l1-l4-frontdesk-sequence21-worker2-20260707154609`
  showed the same blocker on multiple orchestrator jobs
  (`job_cab710892a57`, `job_479d110f3967`, `job_40c592036f1a`): the provider
  reached `task_complete` but produced no assistant text. Session logs confirm
  `last_agent_message=null`, so this was a real empty provider turn rather than
  a parser miss.

Root cause: dispatcher automatic retry only treated `failed` decisions as
retryable. `incomplete` decisions with
`task_complete_empty_reply` / `empty_provider_reply` were surfaced immediately
to callers, which stopped orchestrator/frontdesk-driven real-provider flows
after a transient empty provider turn.

Source repair:

- `finalization_retry_runtime.policy` now classifies
  `status=incomplete` with `reason=task_complete_empty_reply` or
  `diagnostics.error_type=empty_provider_reply` as auto-retryable under the
  existing message retry policy.
- `finalization_retry_runtime.replies` now emits an explicit empty-reply
  exhausted message and preserves terminal status `incomplete`, instead of
  disguising the condition as a generic provider/API failure.
- Regression coverage proves the first two empty replies schedule retry attempts
  without caller delivery; only exhausted attempts deliver an `incomplete`
  reply.

Verification run by talk2:

- `python -m pytest -q test/test_ccbd_retry_failure_detail.py` -> `5 passed`.
- `python -m pytest -q test/test_v2_message_bureau_dispatcher_integration.py -k 'auto_retries_retryable_api_failures or auto_retries_empty_provider_replies or auto_retries_resumable_pane_failures or does_not_auto_retry_nonretryable or does_not_auto_retry_non_retryable_runtime_failures'`
  -> `5 passed`.
- `python -m pytest -q test/test_v2_completion_detectors.py test/test_v2_completion_tracker.py`
  -> `18 passed`.
- `python -m pytest -q test/test_v2_execution_service.py` -> `65 passed`.
- `python -m py_compile` for the touched retry policy/reply/test files -> pass.
- `git diff --check` for the touched retry policy/reply/test files -> clean.

Fresh real-provider retests submitted after the repair:

- worker1 `job_c8174e64f651`: empty-project frontdesk entry E2E with default
  plan bootstrap, direct execution, empty-reply retry-lineage audit, and dynamic
  unload evidence.
- worker2 `job_a62553e07afe`: frontdesk/planner L1-L4 route-mix retest with
  script-owned import and dynamic release audit.
- worker3 `job_5b7340b05ef8`: focused repeated direct-execution dynamic-node
  unload and empty-reply retry stress.

Deployment readiness remains blocked until these fresh real-provider runs return
claimable evidence. Static/source tests are not sufficient for the deployment
standard.

## 2026-07-07 Frontdesk Single-Authority Handoff Repair

Fresh retest results after the empty-provider-reply retry repair:

- worker1 `job_c8174e64f651` is accepted as a real-provider frontdesk-entry
  single-task pass. Fresh root:
  `/home/bfly/yunwei/test_ccb2/deploy-frontdesk-default-plan-e2e-worker1-20260707191048`.
  The project started with no plan root; product flow created
  `docs/plantree/plans/frontdesk-intake`; frontdesk submitted planner,
  planner/orchestrator/worker/reviewer/round-reviewer completed; task
  `build-standard-library-python-cli-todo-t-20260707111202` reached
  `done`, `round_result=pass`, and verification
  `python -m unittest test_todo_store.py` passed. Dynamic release evidence:
  loop `lp924e60`, `released_count=2`, `retained_count=0`, observed
  topology `agents=[]`, and final `ps` showed only resident roles. No
  empty-provider-reply occurred in that pass, so retry lineage was not
  exercised.
- worker3 `job_5b7340b05ef8` is a real-provider blocker, not a pass. Fresh
  root:
  `/home/bfly/yunwei/test_ccb2/deploy-dynamic-unload-stress-worker3-20260707190914`.
  It proved resident preflight and showed positive dynamic release evidence
  for two contaminated direct-execution loops (`lpa1d234`, `lpa45a49`), both
  with `released_count=2`, `retained_count=0`, observed agents `[]`, and no
  active `ps` residue. However, one frontdesk ask created two planner/task
  authorities: dispatcher-triggered frontdesk handoff submitted planner job
  `job_b164e8453953` under `frontdesk-intake`, while the controller
  role-output import of the same frontdesk job submitted planner job
  `job_836dfd2cf19b` under `deploy-dynamic-unload-stress`. This produced two
  orchestrator/direct-execution paths from one user request, contaminating the
  stress matrix.

Root cause: after frontdesk was given the desired active handoff ability, the
legacy loop-runner frontdesk role-output consumer remained enabled as a fallback
and did not recognize `.ccb/runtime/frontdesk-handoff/<job>.json` as the
authoritative active handoff marker. Running `loop runner --once --job
<frontdesk-job>` after dispatcher handoff therefore submitted a second planner
ask.

Source repair:

- `role_output_import._consume_frontdesk` now checks for an existing
  frontdesk-handoff marker before resolving/bootstraping a plan or submitting a
  planner ask.
- If the marker is `starting`/`started`, role-output import records
  `frontdesk_handoff_already_started` and stops without mutating plan/task
  authority or submitting a duplicate planner ask.
- If the marker exists but is failed/blocked, it returns a blocker rather than
  falling back to a second planner submission.

Verification run by talk2:

- New regression:
  `test_loop_runner_does_not_duplicate_planner_when_frontdesk_handoff_started`
  proves a completed frontdesk job with a started handoff marker does not submit
  a second planner ask and does not create the caller-supplied alternate plan.
- `python -m pytest -q test/test_loop_capacity_cli.py::test_loop_runner_does_not_duplicate_planner_when_frontdesk_handoff_started`
  -> `1 passed`.
- `python -m pytest -q test/test_loop_capacity_cli.py -k 'frontdesk_forward_planner or frontdesk_handoff or role_output_import or consumes_completed_role_outputs'`
  -> `19 passed, 98 deselected`.
- `python -m pytest -q test/test_loop_capacity_cli.py` -> `117 passed`.
- `python -m pytest -q test/test_v2_ccbd_dispatcher.py -k 'frontdesk_handoff'`
  -> `1 passed, 39 deselected`.
- `python -m py_compile` for touched role-output/frontdesk retry files -> pass.

Fresh dynamic-unload retest is still required after this repair; worker3's
sequence above remains preserved failure evidence and must not be reused as pass
evidence.
