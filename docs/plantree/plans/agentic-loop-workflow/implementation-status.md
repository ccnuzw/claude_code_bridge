# Agentic Loop Workflow Implementation Status

Date: 2026-07-14
Status: In progress - current-main source accepted; visible provider gate active
Branch: `workflow/g6c-current-main-candidate-20260714-125142`
Worktree: `/home/bfly/yunwei/ccb_worktrees/g6c-current-main-candidate-20260714-125142`
Accepted source commit before this status update: `2c936a48`

## Current Phase

The current-main candidate has passed its source/fake acceptance gate. The
active release target remains one visible Frontdesk-started lane, one semantic
orchestration bundle, and one to four reviewed `Worker + Reviewer` workgroups.
G0-G5, Decisions 027-028, and Decision 029 P0-P5 source authority are accepted.

The next gate is fresh visible real-provider qualification from opened projects
under `/home/bfly/yunwei/test_ccb2`, followed by G7 package/install/update/
rollback acceptance. Codex is primary and Claude secondary; providers without
authenticated local state are outside this release gate.

## Authority

- Release goal: [single-lane-multi-workgroup-release-goal.md](goals/single-lane-multi-workgroup-release-goal.md)
- Decision 029: [029-planner-feedback-and-task-set-closure.md](decisions/029-planner-feedback-and-task-set-closure.md)
- Current source acceptance: [g6c-current-main-source-acceptance-20260714.md](history/g6c-current-main-source-acceptance-20260714.md)
- Historical source gate: [g6c-source-gate-and-root15-readiness-20260714.md](history/g6c-source-gate-and-root15-readiness-20260714.md)

Scripts own task, task-set, revision, closure, integration, topology, round,
release, and delivery authority. Provider replies remain evidence, not state
authority.

## Last Landed

- `6746d749` and `e08409ce` repair provider defaults and Codex/Claude restart
  recovery on the current-main candidate.
- `87ef660b` through `55eb738e` close Detailer-to-Planner replan authority,
  transaction recovery, retry fencing, authenticated projection, and RolePack
  backfill contracts.
- `de84865d` and `2c936a48` reject colliding release builds and preserve an
  external rollback backup when update recovery fails.

## Active TODO

1. Diagnose the installed-control-plane zero-byte `failed` callbacks observed
   while provider sessions and tests continued; do not treat empty artifacts as
   acceptance evidence.
2. Run fresh visible Codex-primary and Claude-secondary G6 acceptance for two,
   three, and four workgroups, restart, busy-retain, sidebar/UI pressure, and
   final task-set/Planner/Frontdesk closure.
3. Repeat each exact available weaker provider/model/RolePack digest at least
   five times; discover exact model ids from live configuration and do not
   invent `5.6` or Luna identifiers.
4. Select a new unused release version, then complete G7 build, install,
   update, rollback, and installed-candidate visible acceptance.
5. Keep G8 publication and tagging separately authorized; do not reuse a
   published version or create tags without explicit release intent.

## Blocked By

Source acceptance is not blocked. Production/default enablement remains gated
by visible real-provider evidence, callback/result-collection reliability, and
the package/update/rollback gate. Exact weak-model rows require authenticated
Codex/Claude configuration available on the test host.

## Acceptance Ownership

Workers execute bounded implementation and test blocks; `mother` reviews Role
boundaries and RolePack consistency. `talk2` owns dependency ordering, raw
evidence and diff review, acceptance decisions, cleanup, landing, and next-step
routing. Real-provider acceptance uses inherited provider state and a lab-local
`AGENT_ROLES_STORE`.

## Last Verified

- Focused current-main gate:
  `/home/bfly/yunwei/test_ccb2/gate-l1-source-2c936a48-20260714TyZKFBB`,
  `222 passed`; exact historical failure set, `26 passed`.
- Rejected harness-path run:
  `/home/bfly/yunwei/test_ccb2/gate-full-source-2c936a48-20260714T101801Z-3366141`,
  `4987 passed, 5 failed, 2 skipped`; all five failures were caused by an
  unexpanded `{RANDOM}` basetemp and passed as `5 passed` under a safe path.
- Accepted full source gate:
  `/home/bfly/yunwei/test_ccb2/gate-full-source-2c936a48-20260714T183827Z-3882094`,
  `4992 passed, 2 skipped in 785.04s`, exit `0`.
- Fourteen test-owned runtime projects were force-unmounted after the accepted
  full run; post-cleanup process, pytest, Unix listener, and socket counts were
  all zero. The candidate worktree remained clean at `2c936a48`.

## Non-Claims

Source acceptance does not claim visible current-candidate provider
qualification, weaker-model stability, installed-package acceptance,
production/default enablement, publication, or a release tag.
