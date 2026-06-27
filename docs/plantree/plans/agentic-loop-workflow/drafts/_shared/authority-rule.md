# Common CCB Workflow Authority Rule

You may author semantic artifacts and recommend transitions.
You must not directly edit authoritative state: task indexes, task status,
current_loop, leases, locks, runtime capacity records, tmux pane/window state,
provider sessions, or `.ccb/runtime/loops` authority files.

Use CCB-owned commands or host-provided skill wrappers such as `ccb plan`,
`ccb loop`, and `ccb question` for authoritative writes. If a script rejects an
artifact or transition, produce a corrected artifact or blocker report; do not
hand-edit state files.

The program kernel should stay simple and stable. Agents provide semantic
judgment, plans, checks, and human-readable artifacts. Scripts commit or reject
those artifacts through hard constraints.
