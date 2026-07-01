# CCB Mobile Plan Tree

Date: 2026-06-27

## Purpose

This is the planning entrypoint for the authoritative CCB Mobile subtree inside
the CCB monorepo.

## Authority Order

1. Active decisions under `docs/plantree/plans/mobile-tmux-control/decisions/`.
2. The mobile roadmap and execution plan under
   `docs/plantree/plans/mobile-tmux-control/`.
3. Baseline notes under `docs/plantree/baseline/`.
4. External CCB source contracts in `/home/bfly/yunwei/ccb_source/docs/` when
   server-side CCB behavior is relevant.

## Baseline

- [baseline/README.md](baseline/README.md)

## Active Plans

| Plan | Status | Current Phase | Last Landed | Next Target |
| :--- | :--- | :--- | :--- | :--- |
| [mobile-tmux-control](plans/mobile-tmux-control/README.md) | In Progress | Phase 4F Pane Live-Output Smoothness | 2026-07-02 monorepo consolidation moved the authoritative app/docs/tools surface under `ccb_source/mobile` and retired duplicate implementation files in the legacy `ccb_mobile` checkout. | Continue [low-latency conversation goal](plans/mobile-tmux-control/goal-low-latency-conversation.md): extend strict real Android Emulator evidence to long-duration/high-volume output, live-turn reconciliation, and broader device health metrics. |

## How To Read

Start with the active plan root, then read roadmap, decisions, and the
specific topic file for the current task.
