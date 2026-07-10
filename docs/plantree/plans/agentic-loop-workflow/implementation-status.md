# Agentic Loop Workflow Implementation Status

Date: 2026-07-10
Status: In progress
Branch: `workflow/agentic-loop-topology`
Worktree: `/home/bfly/yunwei/ccb_worktrees/agentic-loop-topology`

## Current Phase

The active release target is single-lane production closure: one visible,
frontdesk-started macro task, one semantic orchestration bundle, and one to
four independently reviewed `Worker + Reviewer` workgroups. Multi-lane
Roadmap scheduling remains out of scope.

G0 design is accepted and the first G1 foundation is landed. Commit
`34027943` provides strict bundle import/validation, canonical work packets,
deterministic ordering, explicit orchestrator candidate import, one-node
compatibility evidence, and a multi-node pre-bind pause. It does not execute
multiple workgroups. The current phase is F1 authority-interface freeze and
remaining G1 one-node kernel closure.

## Authority

- Goal and execution waves:
  [goals/single-lane-multi-workgroup-release-goal.md](goals/single-lane-multi-workgroup-release-goal.md)
- Detailed contracts and tests:
  [topics/single-lane-multi-workgroup-modification-and-test-plan.md](topics/single-lane-multi-workgroup-modification-and-test-plan.md)
- Accepted release boundary:
  [decisions/025-single-lane-multi-workgroup-release-gate.md](decisions/025-single-lane-multi-workgroup-release-gate.md)

Provider replies remain evidence only. Scripts own bundle, task, node,
integration, topology, round, and release authority. Mount topology remains
physical placement/lifecycle state, not a semantic dispatch graph.

## Last Landed

- `77ca803a`: production-closure Goal, whole-block worker waves, direct
  acceptance campaign, and separate deployment versus publication gates.
- `5f938559`: G1 foundation evidence and roadmap/status checkpoint.
- `34027943`: orchestration-bundle foundation source and tests.
- `ce4f7590`: single-lane multi-workgroup release plan and test matrix.

Foundation evidence:
[history/single-lane-multi-workgroup-g1-foundation-20260710.md](history/single-lane-multi-workgroup-g1-foundation-20260710.md).

## Next Target

Freeze F1 before dispatching parallel implementation packages:

1. define task revision identity and increment/binding semantics;
2. define the effective capacity snapshot and canonical digest inputs;
3. freeze final bundle/node/provenance fields and normalized digest rules;
4. freeze node state transitions and exact-once intent key
   `(bundle_revision, node_id, purpose, attempt)`;
5. freeze result mapping, structural-replan boundary, and controller ownership.

F1 closes only when design, source models, rejection cases, and one-node
compatibility tests agree. No G2/G3 fanout starts before that gate.

## Execution Queue

- Wave 0, active: `talk2` completes F1 directly.
- Wave 1, pending after F1: parallel whole blocks R1 runtime closure, C1 Config
  V3 core, and P1 RolePack contract in separate worktrees/branches.
- Wave 1 integration: `talk2` reviews and integrates R1, then C1, then P1;
  focused and non-Gemini repository gates run on the combined branch.
- Wave 2, gated: R2 Git integration, T1 topology/capacity, and E1 evidence/
  fake harness may run in parallel only after Wave 1 passes.
- Wave 3, gated: one owner closes the central ready-frontier scheduler; it is
  not split across workers.
- G5-G7 acceptance: `talk2` directly owns source/fake, visible real-provider,
  UI/lifecycle, package/install/update/rollback, and final readiness decisions.

## Active TODO

1. Complete and record F1 authority-interface freeze.
2. Dispatch R1/C1/P1 as bounded whole-block code packages.
3. Review each returned commit against file ownership and invariants; integrate
   one at a time and rerun adjacent tests.
4. Close G1 with sole node-state one-group execution, node-keyed recovery, and
   removal of the normal post-worker orchestrator activation.
5. Start G2/G3 only after the combined Wave 1 gate is green.

## Blocked By

No external dependency blocks F1/G1. Internal gates intentionally block
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

- Bundle/plan/loop/topology focused and adjacent suite: `209 passed`.
- Non-Gemini repository gate: `3868 passed, 2 skipped, 124 deselected`.
- Unrestricted repository run: `3988 passed, 2 skipped, 4 failed`; all four
  failures are recorded Gemini restart-timing blackbox cases, not hidden.
- Goal-document relative links and `git diff --check`: passed before commit
  `77ca803a`.
- Current status/Goal/archive relative-link audit and `git diff --check`:
  passed before this handoff commit.

## Non-Claims And History

The branch is not production-ready: the one-group engine is still partly
scalar, multi-node bundles pause before execution, Git integration and the
ready-frontier scheduler are absent, Config V3 is not implemented, and no
multi-workgroup real-provider or packed-candidate acceptance exists.

The superseded detailed status log is preserved at
[history/implementation-status-through-g1-foundation-20260710.md](history/implementation-status-through-g1-foundation-20260710.md).
Older bounded Phase 1-6 acceptance remains available in
[history/phase1-6-acceptance-report-20260705.md](history/phase1-6-acceptance-report-20260705.md).
