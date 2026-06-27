# Orchestrator Role Capability

Date: 2026-06-24

## Purpose

`orchestrator` is the loop-internal semantic dispatcher. It is activated by
`loop_runner` through `ask` for one execution round or one orchestration batch.
It turns an execution-ready task packet into bounded work items, selects a small
execution-node topology, dispatches constrained work through `ask`, and returns
structured aggregation for round checking or replanning.

It is not a daemon, not a permanent manager, and not the owner of runtime state.

## Activation Model

```text
loop_runner
  -> ask orchestrator
      inputs: task packet, verification contract, loop state refs, node budget
      outputs: work items, dependency graph, dispatch plan, runtime requests,
               partial summary, round-check handoff
```

`orchestrator` should receive references, not large copied context:

- Durable task packet path.
- Planner handoff path.
- Acceptance criteria path.
- Verification contract path.
- Current loop breadcrumb.
- Existing node/branch status refs.
- Runtime capacity summary.

`orchestrator` may read the referenced documents, reason semantically, and
produce draft artifacts. It must ask CCB scripts to record authoritative state.

## Core Capabilities

### 1. Task Complexity Assessment

Classify the current execution task before slicing:

| Class | Meaning | Default Node Count |
| :--- | :--- | :--- |
| `single` | One bounded implementation path, low cross-module risk | 1 |
| `split_serial` | Several dependent steps; parallelism would create rework | 1-2 |
| `split_parallel` | Independent work items can run safely in parallel | 2-4 |
| `replan_needed` | Task is too vague, too broad, or acceptance criteria are not executable | 0 |

Complexity signals:

- Number of affected modules.
- Cross-module dependency risk.
- Need for domain specialization.
- Test surface breadth.
- Whether work items can be independently verified.
- Whether partial branch completion is useful.
- Whether shared files would create merge or semantic conflicts.

Hard limits:

- V1 node count must be between 1 and 4.
- Prefer 1 node unless parallelism clearly reduces risk or wall time.
- If more than 4 nodes seem necessary, return `replan_needed` with a smaller
  task-splitting recommendation.

### 2. Work Item Slicing

Produce work items that are:

- Bounded.
- Testable.
- Independently reviewable.
- Traceable to acceptance criteria.
- Small enough for one `coder + checker` node.

Each work item should include:

```json
{
  "work_item_id": "wi-001",
  "title": "Implement config parser guard",
  "goal": "Make project config parsing fail visibly instead of falling back",
  "scope": ["lib/agents/config_loader_runtime"],
  "non_goals": ["rewrite config grammar"],
  "acceptance_refs": ["acceptance-criteria.md#config-visible-failure"],
  "verification_refs": ["verification-contract.md#real-cli-smoke"],
  "depends_on": [],
  "expected_artifacts": ["summary", "changed_files", "tests", "risk_notes"],
  "assigned_node": "node-001"
}
```

### 3. Dependency Graph And Branch Control

Build a small DAG:

```json
{
  "nodes": ["node-001", "node-002"],
  "edges": [["node-001", "node-002"]],
  "branches": [
    {"branch_id": "branch-config", "root_node": "node-001"}
  ]
}
```

When a node is `non_converged`, orchestrator should:

- Freeze that node.
- Freeze dependent downstream nodes.
- Continue unrelated sibling work when safe.
- Return a partial package for planner when the round drains.

It must not downgrade the branch to success or silently remove it from scope.

### 4. Runtime Agent Requesting

`orchestrator` may request execution capacity, but it must not directly mutate
runtime state.

Allowed:

- Request fixed configured agents for V1.
- Request dynamic load for a bounded batch of agents when the workflow spec and
  loop runner support it.
- Request idle unload after work completes.
- Provide reasons, node count, provider/role preferences, and expected lifetime.

Disallowed:

- Editing `.ccb/ccb.config` directly.
- Running `ccb reload` directly from the role.
- Killing panes or agents directly.
- Writing `.ccb/runtime/loops/*` authority files directly.
- Bypassing busy unload or provider replacement guards.

Runtime request shape:

```json
{
  "request_type": "ensure_execution_agents",
  "reason": "Need two independent coder/checker nodes for parallel branches",
  "node_count": 2,
  "max_node_count": 4,
  "preferred_roles": ["coder", "checker"],
  "lifetime": "current_loop_round",
  "fallback": "use fixed configured coder/checker serially"
}
```

`loop_runner` owns translating runtime requests into `ccb reload --dry-run`,
`ccb reload`, fixed-agent reuse, or rejection. Current CCB supports explicit
reload for append-only add-agent/add-window and idle remove-agent; busy unload,
provider replacement, agent movement, arbitrary layout reshaping, and background
watching remain out of scope.

### 5. Ask Dispatch

`orchestrator` dispatches work through `ask`, but every ask must be constrained.

Each worker ask should include:

- Work item id.
- Goal.
- Scope and non-goals.
- Acceptance refs.
- Verification refs.
- Forbidden degradation rules.
- Expected output schema.
- Artifact refs instead of large copied text where possible.
- Time/retry limits inherited from loop state.

Each checker ask should include:

- Work item id.
- Worker result refs.
- Acceptance refs.
- Verification refs.
- Fallback/degradation audit requirement.
- Expected status: `pass`, `rework`, `blocked`, or `non_converged`.

`orchestrator` should record submitted ask refs through script-owned runtime
commands such as `ccb loop ask-record`; it must not hand-edit `asks.jsonl`.

### 6. Aggregation

After node results return, orchestrator produces:

```text
orchestration_summary
  completed_nodes
  rework_nodes
  blocked_nodes
  non_converged_nodes
  frozen_branches
  drained_sibling_work
  dependency_graph
  changed_surfaces
  evidence_refs
  round_checker_handoff
```

If the round is partial, produce:

```text
partial_loop_report
  completed_nodes
  non_converged_nodes
  blocked_downstream_nodes
  skipped_nodes
  failed_assumptions
  recommended_replan_options
```

## Explicit Non-Authority

`orchestrator` must not:

- Modify durable plan-tree state directly.
- Modify runtime authority files directly.
- Start or stop providers directly.
- Confirm user-facing scope changes.
- Lower acceptance criteria.
- Convert partial work into `done`.
- Override checker or round checker quality gates.
- Expand beyond the configured 1-4 node budget.

## V1 Cut

V1 should start with fixed configured agents:

```text
planner -> loop_runner -> ask orchestrator
orchestrator -> ask coder
orchestrator -> ask checker
orchestrator -> aggregate
checker or round_checker -> verify
planner/frontdesk -> receive partial/replan only when needed
```

Dynamic load/unload can be added after the fixed-agent loop works. In V1,
orchestrator should still emit runtime requests in a structured form so the
later dynamic path has a stable contract.

## Role Pack Guidance

The `orchestrator` Role Pack should include:

- Role memory describing purpose, authorities, non-authorities, and V1 limits.
- A dispatch skill for work item slicing and ask payload generation.
- A runtime-request skill for producing structured load/unload requests without
  executing them.
- Templates for work items, dependency graphs, worker asks, checker asks,
  runtime requests, orchestration summaries, and partial loop reports.
- References to:
  - `topics/plan-and-runtime-list-structure.md`
  - `topics/execution-node-and-round-verification.md`
  - `topics/state-and-script-contract.md`
  - `docs/plantree/plans/ccbd-agent-hot-reload/roadmap.md`
