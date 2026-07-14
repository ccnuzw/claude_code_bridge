# Agentic Loop Workflow Implementation Status

Date: 2026-07-14
Status: In progress - Phase2 wiring repair landed; fresh provider gate pending
Branch: `main`
Current source commit: `62753d63791f8b644ee6f5f5433fe57070fb2c84`

## Current Phase

The current-main source/fake baseline remains accepted at `2c936a48`, with
`4992 passed, 2 skipped`. A fresh Codex/Claude visible run then exposed a
production Phase2 dependency-assembly defect before Orchestrator activation.
The minimal repair landed as `62753d63`; focused loop, scheduler, task-set, and
public auto-runner checks pass. The broadened Phase2 rerun under a short Unix
socket path is active before fresh real-provider admission.

The release target remains one visible Frontdesk-started lane, one semantic
orchestration bundle, and one to four independently reviewed
`Coder + Code Reviewer` workgroups. Codex is primary and Claude secondary;
providers without authenticated local state are outside the real gate.

## Authority

- Release goal: [single-lane-multi-workgroup-release-goal.md](goals/single-lane-multi-workgroup-release-goal.md)
- Decision 029: [029-planner-feedback-and-task-set-closure.md](decisions/029-planner-feedback-and-task-set-closure.md)
- Source acceptance: [g6c-current-main-source-acceptance-20260714.md](history/g6c-current-main-source-acceptance-20260714.md)
- Wiring/provider diagnostic: [g6d-phase2-wiring-real-provider-diagnostic-20260714.md](history/g6d-phase2-wiring-real-provider-diagnostic-20260714.md)

Scripts own task, task-set, revision, closure, integration, topology, round,
release, and delivery authority. Provider replies remain evidence, not state
authority.

## Last Landed

- `2c936a48` closes G7 release identity and rollback-backup safety on top of
  the accepted authority/recovery candidate.
- `c725b56f` records the accepted source gate and fast-forwards it to `main`.
- `62753d63` explicitly wires `loop_runner_auto` and
  `frontdesk_intake_command` into both production Phase2 service builders and
  removes the eager legacy Frontdesk fallback.

## Active TODO

1. Accept the short-path broadened Phase2 rerun, then run the final full source
   suite on the terminal code candidate before packaging.
2. Run fresh visible Codex-primary C1/C2 and Claude-secondary C3 projects for
   two, three, and four workgroups, route mix, rework, restart, busy-retain,
   sidebar pressure, task-set closure, release, delivery, and zero residue.
3. Repeat each exact available weaker provider/model/profile/RolePack digest
   at least five times; do not invent `5.6` or Luna identifiers.
4. Select an unused release version and complete G7 pack, isolated install,
   update, injected-failure rollback, and installed-candidate live acceptance.
5. Keep G8 publication and tagging separately authorized.

## Blocked By

Production/default enablement remains gated by fresh visible provider evidence,
the terminal full source run, and the package/update/rollback gate. The
installed `v8.1.4` control plane is not accepted for important worker dispatch
after `ccb clear`; source `ccb_test` worker pools must be used until an
installed candidate contains the exact-anchor session fix.

## Acceptance Ownership

Workers execute bounded implementation and test blocks; `mother` reviews Role
boundaries and RolePack consistency. `talk2` owns dependency ordering, raw
evidence and diff review, acceptance decisions, cleanup, landing, and next-step
routing. Real-provider acceptance uses inherited Codex/Claude state and a
project-local `AGENT_ROLES_STORE`.

## Last Verified

- Source callback fixture:
  `/home/bfly/yunwei/test_ccb2/source-callback-fixture-c725-20260714T110602Z`,
  `5 passed`; two exact-anchor workers completed with non-empty artifacts and
  zero residue.
- Rejected real lanes:
  `/home/bfly/yunwei/test_ccb2/real-provider-visible-c1-codex-20260714T112158Z`
  and `/home/bfly/yunwei/test_ccb2/real-visible-c3-claude-20260714T112344Z`.
  Codex and Claude Frontdesk-to-Planner handoff completed; both auto-runners
  stopped on the same missing `loop_runner_auto` service field.
- Wiring repair evidence:
  `/home/bfly/yunwei/test_ccb2/auto-runner-wiring-job_acf28692264d`.
  Before: `3 failed`; after: `5 passed`, nearby suites `16 passed` and
  `5 passed`, public CLI exit `0` with bounded `idle`.
- Old rejected lanes were audited and force-unmounted; both finished with zero
  project-owned process, listener, socket, tmux, auto-runner, or active mount.
- The first broadened Phase2 run remains rejected because its long
  `XDG_RUNTIME_DIR` produced `AF_UNIX path too long`; a short-path unfiltered
  rerun is active and has not yet been accepted.

## Non-Claims

This status does not accept the fresh Codex/Claude workflow, weaker-model
stability, the terminal full source suite at `62753d63`, installed-package
acceptance, production/default enablement, publication, or a release tag.
