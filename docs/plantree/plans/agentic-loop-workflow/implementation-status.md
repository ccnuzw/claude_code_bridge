# Agentic Loop Workflow Implementation Status

Date: 2026-07-14
Status: In progress - source gate accepted; fresh visible root15 is admitted
Branch: `workflow/g6c-integration`
Worktree: `/home/bfly/yunwei/ccb_worktrees/g6c-integration`
Current accepted source HEAD before this status update: `b14c66ef`

## Current Phase

The release target remains one visible Frontdesk-started lane with one semantic
orchestration bundle and one to four reviewed `Worker + Reviewer` workgroups.
G0-G5, Decisions 027-028, and Decision 029 P0-P4 source implementation are
accepted. Decision 029 P5 visible real-provider acceptance is active.

The reviewer-rework authority race, strict role-output import drift, stale
detail authority, canonical fake result, RolePack projection gaps, and Phase 2
restart-runtime cleanup leak are closed through `b14c66ef`. The complete source
suite and post-run live-residue audit pass, so root15 is no longer source-gated.

## Authority

- Release goal: [single-lane-multi-workgroup-release-goal.md](goals/single-lane-multi-workgroup-release-goal.md)
- Decision 029: [029-planner-feedback-and-task-set-closure.md](decisions/029-planner-feedback-and-task-set-closure.md)
- P0-P5 plan: [planner-feedback-and-task-set-closure-plan.md](topics/planner-feedback-and-task-set-closure-plan.md)
- Source gate: [g6c-source-gate-and-root15-readiness-20260714.md](history/g6c-source-gate-and-root15-readiness-20260714.md)

Provider replies remain evidence only. Scripts own task, task-set, revision,
closure, integration, topology, round, release, and delivery authority.

## Last Landed

- `58d9a9dc` and `ed07d619`: linearized Worker-owned chain transitions and
  concurrent smoke submission close the rework parent-authority race.
- `ba034865` through `ded3ea48`: strict role-output import, stale-detail
  authority refresh, canonical V3/fake round results, and terminating Detailer
  manifest semantics.
- `3f95d03c` through `632892f8`: Frontdesk request identity/handoff projection
  and exact one-assigned-Reviewer-per-hop Coder contracts.
- `b14c66ef`: Phase 2 restart tests register in-process runtime owners and
  clean their ccbd/accelerator trees and provider bridges.

Earlier accepted and rejected real-provider checkpoints remain indexed by the
plan README and the root13/root14 history records.

## Active TODO

1. Run fresh visible root15 through all five Decision 029 routes, task-set
   closure, Frontdesk delivery, strict B7, shutdown, and zero residue.
2. Complete G6 visible three/four-workgroup, restart, busy-retain/sidebar
   pressure, and exact provider/model qualification rows.
3. Repeat weaker-model qualification at least five times per exact
   provider/model/RolePack digest; do not claim unobserved `5.6` or Luna ids.
4. Integrate onto the current release base and complete G7 build, fresh
   install, update, rollback, and installed-candidate visible acceptance.
5. Freeze production evidence; keep G8 publication/tagging separately
   authorized by the user.

## Blocked By

No source blocker remains for root15. Production/default enablement remains
gated by fresh visible root15, the remaining G6 matrix, and G7 candidate
package/install/update/rollback acceptance. Exact weaker-model ids and
credentials must be discovered from the live provider configuration before
claims are made.

## Acceptance Ownership

Workers may implement and run bounded source/fake or opened-project blocks;
`mother` reviews Role boundaries and RolePack changes. `talk2` owns task
publication, dependency ordering, raw evidence/diff review, acceptance, and
next-step routing. Real acceptance uses a fresh opened project under
`/home/bfly/yunwei/test_ccb2`, this worktree's explicit `ccb_test`, inherited
provider environment where required, and a root-local `AGENT_ROLES_STORE`.

## Last Verified

- Focused P0 RolePack integration gate: `103 passed`.
- Phase 2 cleanup repair: seven restart-recovery nodes `7 passed`; cleanup
  units `11 passed`; direct post-run process/listener scans returned zero.
- Final correct-environment source gate at `b14c66ef`: `4674 passed, 2 skipped
  in 1064.46s`; post-run related process count `0`, listening Unix socket
  count `0`, and four non-listening fixture socket files removed with the
  disposable short root.
- Evidence:
  `/home/bfly/yunwei/test_ccb2/g6c-full-source-final2-b14c-20260714-121525`.
- Worktree was clean at `b14c66ef` after evidence collection and cleanup.

## Non-Claims

The branch is not yet a packaged candidate or production/default-enablement
claim. Root8, root13, and root14 remain rejected diagnostic evidence. A green
source suite admits root15 but does not replace visible G6/G7 acceptance.
