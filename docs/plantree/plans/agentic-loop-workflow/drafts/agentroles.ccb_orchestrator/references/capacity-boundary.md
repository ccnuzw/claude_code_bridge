# Capacity Boundary

`orchestrator-capacity` is the only V1 path from semantic orchestration into
dynamic CCB nodes. The skill calls `ccb loop capacity ensure/status/release`
and consumes returned JSON. It never edits project configuration or runtime
authority files directly.

The loop runner, CCB CLI, and ccbd own whether requested capacity becomes a
runtime overlay, guarded reload, or a rejected blocker.

Placement is also CCB-owned. `loop capacity` may return `node_id`,
`window_name`, `resolved_window_name`, or `placement` as evidence for reporting
and diagnostics, but the orchestrator must not choose those values, call raw
`ccb agent add --window`, or run tmux commands. Use `ccb layout status --json`
only as a read-only diagnostic view when capacity placement is unclear.
