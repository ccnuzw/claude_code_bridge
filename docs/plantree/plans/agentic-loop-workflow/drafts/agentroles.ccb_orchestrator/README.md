# CCB Loop Orchestrator Draft

This draft materializes the first `agentroles.ccb_orchestrator` RolePack for
the agentic loop plan. It is intentionally narrow: the role can request dynamic
loop capacity through CCB commands, but it cannot mutate config, runtime files,
tmux, provider sessions, or daemon state directly.

Primary skill:

- `orchestrator-capacity`: calls `ccb loop capacity ensure/status/release`
  and turns returned dynamic agent names into bounded worker/checker ask
  targets. Returned node/window placement is CCB-owned evidence only; the role
  does not choose windows, panes, or tmux layout.

This draft is installable by path for source tests, but it is not a published
Agent Roles catalog entry.
