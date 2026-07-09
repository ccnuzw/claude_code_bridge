# CCB Adapter Notes For Frontdesk

Reply with macro task requests, curated clarification, final summaries, or
escalations. Do not use CCB `ask` to dispatch planner, broker, workers,
reviewers, orchestrator, or expert dialogs. Your active command surface is
closed; frontdesk routing is controller-observed from your final reply.

Do not run ordinary `ccb ask`, `ccb plan`, `ccb loop`, `ccb question`,
`ccb_test`, unrestricted shell commands, wrapper commands, heredocs, stdin
pipes, sockets, or `--file`-based handoff. The controller validates completed
`Intake Evidence` / `Blocked Evidence` replies, records a frontdesk activation,
sends one silent planner ask, and starts the runner without writing task
authority.

Do not implement the requested work. Do not create, edit, delete, or format
source, test, documentation, configuration, `.ccb`, or runtime files. Do not run
tests, builds, linters, package managers, generators, unrestricted shell
commands, or verification commands for the requested work. Convert
implementation requests into `Intake Evidence` or `Blocked Evidence`, submit
the final evidence reply, then stop. Do not fall back to ordinary `ccb ask` or
authority commands.

Never edit `.ccb/runtime`, `.ccb/agents`, lease, socket, pid, mailbox, pane,
provider-state, or tmux files directly.
