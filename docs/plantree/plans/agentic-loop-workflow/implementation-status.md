# Agentic Loop Workflow Implementation Status

Date: 2026-07-11
Status: In progress
Branch: `workflow/agentic-loop-topology`
Worktree: `/home/bfly/yunwei/ccb_worktrees/agentic-loop-topology`

## Current Phase

The active release target is single-lane production closure: one visible,
frontdesk-started macro task, one semantic orchestration bundle, and one to
four independently reviewed `Worker + Reviewer` workgroups. Multi-lane
Roadmap scheduling remains out of scope.

G0/F1 and R1/G1 are complete. Commit `0c2f19ef` adds semantic task revision
fencing, canonical effective-capacity binding, adaptive selection evidence,
node-keyed exact-once intent/recovery, sole node-map one-group execution,
strict immaculate freshness, V2 replan-safe compatibility, and removal of the
normal post-worker orchestrator call. Multi-node bundles still pause before
bind. The current phase is the remaining Wave 1 Config V3 and RolePack work.

## Authority

- Goal and execution waves:
  [goals/single-lane-multi-workgroup-release-goal.md](goals/single-lane-multi-workgroup-release-goal.md)
- Detailed contracts and tests:
  [topics/single-lane-multi-workgroup-modification-and-test-plan.md](topics/single-lane-multi-workgroup-modification-and-test-plan.md)
- Accepted release boundary:
  [decisions/025-single-lane-multi-workgroup-release-gate.md](decisions/025-single-lane-multi-workgroup-release-gate.md)
- Frozen F1 interfaces:
  [decisions/026-authority-envelope-and-adaptive-workgroup-selection.md](decisions/026-authority-envelope-and-adaptive-workgroup-selection.md)

Provider replies remain evidence only. Scripts own bundle, task, node,
integration, topology, round, and release authority. Mount topology remains
physical placement/lifecycle state, not a semantic dispatch graph.

## Last Landed

- `0c2f19ef`: R1 authority/runtime closure and generalized one-node kernel.
- `ec01d53a`: F1 Decision 026 and adaptive selection freeze.
- `77ca803a`: production-closure Goal, whole-block worker waves, direct
  acceptance campaign, and separate deployment versus publication gates.
- `5f938559`: G1 foundation evidence and roadmap/status checkpoint.
- `34027943`: orchestration-bundle foundation source and tests.
- `ce4f7590`: single-lane multi-workgroup release plan and test matrix.

Foundation evidence:
[history/single-lane-multi-workgroup-g1-foundation-20260710.md](history/single-lane-multi-workgroup-g1-foundation-20260710.md).

R1 closure evidence:
[history/single-lane-r1-authority-runtime-closure-20260711.md](history/single-lane-r1-authority-runtime-closure-20260711.md).

## Next Target

Implement and integrate C1 Config V3 core and P1 RolePack contract against the
landed R1 interfaces, one package at a time after direct diff review and tests.

## Execution Queue

- Wave 0, complete: F1 is frozen by Decision 026.
- Wave 1, active: R1 is integrated; C1 Config V3 core and P1 RolePack contract
  will use separate worktrees/branches.
- Wave 1 integration: `talk2` reviews and integrates C1, then P1;
  focused and non-Gemini repository gates run on the combined branch.
- Wave 2, gated: R2 Git integration, T1 topology/capacity, and E1 evidence/
  fake harness may run in parallel only after Wave 1 passes.
- Wave 3, gated: one owner closes the central ready-frontier scheduler; it is
  not split across workers.
- G5-G7 acceptance: `talk2` directly owns source/fake, visible real-provider,
  UI/lifecycle, package/install/update/rollback, and final readiness decisions.

## Active TODO

1. Dispatch C1 and P1 as bounded whole-block code packages.
2. Review each returned commit against file ownership and invariants; integrate
   one at a time and rerun adjacent tests.
3. Start G2/G3 only after the combined Wave 1 gate is green.
4. Keep real 1-4 group roots unopened until the multi-node runtime gate passes.

## Blocked By

No external dependency blocks Wave 1. Internal gates intentionally block
multi-workgroup execution, Config V3 runtime enablement, package publication,
and multi-lane work until their predecessor phases pass. Exact package version,
registry, tag, and publication remain explicit release-time decisions.

## Validation And Acceptance

Workers may implement and self-test coherent packages, but their reports are
supporting evidence only. `talk2` reviews diffs, integrates commits, reruns
tests, and directly owns all acceptance.

Visible real validation must use fresh projects under
`/home/bfly/yunwei/test_ccb2`, the explicit source `ccb_test`, inherited system
provider environment, a project-local `AGENT_ROLES_STORE`, and an inspectable
separate terminal/UI. Required runs are V0 one-group compatibility, V1/V2/V3
real two/three/four-group tasks, V4 restart/failure/rollback/busy-retain, and
V5 packed external-install workflow. Raw task/job/Git/topology/UI evidence must
agree with B7; script output cannot substitute for the opened project.

## Last Verified

- R1 owned suite: `195 passed`.
- R1 adjacent suite: `117 passed`.
- Unrestricted repository run: `4000 passed, 2 skipped, 5 failed`; four
  failures are out-of-gate Gemini restart-timing blackbox cases. The fifth is
  a stale Phase 6B repeat8 status-doc assertion reproduced on parent commit
  `ec01d53a`.
- R1 evidence links and `git diff --check`: passed after this status update.

## Non-Claims And History

The branch is not production-ready: multi-node bundles pause before execution,
Git integration and the ready-frontier scheduler are absent, Config V3 is not
implemented, RolePack projection is not updated, and no
multi-workgroup real-provider or packed-candidate acceptance exists.

The superseded detailed status log is preserved at
[history/implementation-status-through-g1-foundation-20260710.md](history/implementation-status-through-g1-foundation-20260710.md).
Older bounded Phase 1-6 acceptance remains available in
[history/phase1-6-acceptance-report-20260705.md](history/phase1-6-acceptance-report-20260705.md).
