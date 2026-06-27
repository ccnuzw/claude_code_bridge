# Agentic Loop Workflow Architecture

Date: 2026-06-24

## Design Intent

The workflow should reduce `frontdesk` to an intelligent user-facing loop rather
than a universal executor. `frontdesk` talks to the user, captures the macro
objective, confirms scope and high-risk decisions, and receives final or
unrecoverable summaries. It should not micromanage planning, decomposition,
implementation, checking, recovery, or progress bookkeeping.

The system should instead be driven by a CCB-owned loop state machine. Agents
perform semantic work and produce artifacts; scripts and loop runner code write
authoritative progress state.

## Role Topology

```text
user
  -> frontdesk group
      -> planner group
          -> clarification broker -> frontdesk group (only when user input is needed)
          -> plan steward / execution docs
              -> loop runner
                  -> orchestrator
                      -> execution node 1
                      -> execution node 2
                      -> ...
                  -> round checker
                  -> inner monitor
              -> plan steward sync
      <- final summary or escalation
```

### Frontdesk Group

Responsibilities:

- User discussion and macro-task intake.
- Scope confirmation and risk confirmation.
- Final user-facing summaries.
- Unrecoverable escalation handling.

Non-responsibilities:

- Detailed implementation.
- Internal worker scheduling.
- Continuous task-progress bookkeeping.
- Reading or rewriting every plan-tree file.

### Planner Group

Responsibilities:

- Turn macro tasks into durable execution artifacts.
- Produce structured candidate questions only for product, scope, or risk
  uncertainty that cannot be answered from code or plan-tree evidence.
- Produce PRD-style requirements, design notes, acceptance criteria,
  verification contract, validation path, and initial risks.
- Internally review plan quality before marking the task execution-ready.
- Produce draft artifacts and readiness recommendations; CCB-owned `ccb plan`
  scripts write authoritative task status, indexes, and imported artifact
  records.

Expected internal nodes:

- `planner`: produces the plan.
- `plan_reviewer`: checks scope, ambiguity, acceptance criteria, and risks.
- `risk_reviewer`: optional node for destructive, release, or broad-runtime
  changes.

### Clarification Broker

Responsibilities:

- Receive a stage-level batch of candidate questions from planner group.
- Merge duplicates and remove questions already answerable from code, plan-tree,
  prior user answers, or accepted assumptions.
- Apply safe defaults for non-blocking choices and record them as assumptions.
- Defer questions that are real but not needed for the current phase.
- Mark obsolete questions when the plan changed before user input was needed.
- Publish only the remaining user-facing questions as compact display artifacts
  for `frontdesk`.
- Normalize user answers into planner-readable artifacts and notify planner
  that the phase can continue.

Non-responsibilities:

- Direct user conversation.
- Starting or advancing the execution loop.
- Long-term plan-tree authority.
- Keeping a large persistent semantic context.

The persistent component is the question queue and artifact set. The semantic
broker can be launched with fresh context per phase batch, then released after
questions are ready, defaulted, deferred, or answered.

### Plan Steward

Responsibilities:

- Maintain the mapping between macro tasks, plan-tree plan roots, and short-term
  loop tasks.
- Keep `docs/plantree` durable and low-noise.
- Write or update `implementation-status.md`, roadmap evidence, decisions, and
  blockers only when durable boundaries are reached.
- Provide a compact breadcrumb for current loop state.
- In V1, enforce the boundary through deterministic `ccb plan` commands. A
  semantic plan steward may audit or summarize, but cannot bypass script
  validation.

Non-responsibilities:

- Product implementation.
- Runtime lifecycle ownership.
- Provider recovery outside sanctioned CCB commands.

### Loop Runner

Responsibilities:

- Deterministically read loop state.
- Enforce leases, phase transitions, per-loop limits, and escalation rules.
- Activate orchestrator, execution nodes, monitor, recovery, or plan steward
  according to state.
- Release temporary loop resources at the end of a round.

The loop runner should be a CCB program/helper, not an agent conversation.

### Orchestrator

Responsibilities:

- Decompose an execution-ready task into bounded work items.
- Choose execution-node topology and dependencies.
- Define required artifacts and per-node done conditions.
- Aggregate node results and dependency graph state.
- Freeze non-converged branches without stopping unrelated sibling work.
- Produce a round summary for round checker after unaffected work drains.

Non-responsibilities:

- Long-term plan-tree authority.
- User-facing product decisions.
- Unbounded fanout.

### Execution Nodes

An execution node is a temporary or scoped team for one work item.

Default v1 shape:

```text
checker: derive node verification contract
worker: implement bounded work item
checker: review, test, and audit against original design
```

The checker is a peer quality gate, not the worker's manager and not a hidden
implementer. It may reject, request rework, block, or mark the node
non-converged. It must not lower acceptance criteria, silently accept fallback,
or turn partial work into success.

Deferred complex shape:

- `fixer`: handles checker findings.
- `verifier`: runs focused validation.
- `specialist`: handles domain-specific investigation.
- `node_coordinator`: temporary intra-node coordination only when the work item
  cannot be safely split by orchestrator.

Each node must return structured artifacts:

- Work item id.
- Files touched or evidence inspected.
- Summary.
- Verification performed.
- Checker findings.
- Fallback or degradation audit.
- Node status: `passed`, `rework`, `blocked`, or `non_converged`.
- Remaining risks.

### Round Checker

The round checker verifies the loop round as an integrated result. It is
separate from per-node checker roles.

Responsibilities:

- Read planner's verification contract.
- Read orchestrator's dependency graph, node summaries, partial branches, and
  changed surfaces.
- Design the concrete round verification plan for the actual round output.
- Reuse node-level test evidence where valid.
- Add cross-node, integration, regression, and real-path tests where needed.
- Detect hidden degradation, partial work reported as done, or incompatible
  sibling changes.
- Return `pass`, `rework_node`, `replan_required`, or `global_blocker`.

Non-responsibilities:

- Product scope changes.
- Implementation fixes.
- Lowering acceptance criteria.
- Authoritative state writes.

Planner defines what must be proven. Round checker decides how to prove it for
the actual completed or drained round.

Round checker does not create the next loop plan. For `partial` or
`replan_required`, it returns a compact report and evidence refs. Planner is
then rehydrated from the task packet and round evidence to produce the next
task or clarification batch.

### Inner Monitor

The inner monitor watches loop health, not product correctness.

It should be split into two layers:

- Deterministic monitor: checks ask/job state, callback completion, timeouts,
  pane/provider health, missing artifacts, stale leases, and repeated retries.
- Semantic monitor: classifies ambiguous evidence only when deterministic checks
  cannot decide whether the loop is healthy, recoverable, or needs escalation.

The monitor may request recovery or escalation. It must not silently mutate
business task state.

## Handoff Model

Handoffs should be state-machine edges, not free-form agent forwarding.

Example:

```text
planning_ready -> orchestrator
clarification_needed -> clarification_broker -> frontdesk
answers_normalized -> planner_group
work_decomposed -> execution_node[*]
node_done(all_or_drained) -> orchestrator
node_non_converged -> branch_frozen -> drain_unaffected
orchestrator_done -> round_checker
round_passed -> plan_steward
round_partial -> planner_group
check_failed -> recovery
unrecoverable -> frontdesk
done -> plan_steward -> frontdesk
```

Each handoff should include:

- Task id.
- Phase.
- Owner.
- Required artifact refs.
- Evidence refs.
- Timeout.
- Escalation target.

## Termination Rules

Every loop must have explicit termination conditions:

- Done condition.
- Partial condition.
- Blocked condition.
- Replan-required condition.
- User-decision-needed condition.
- Maximum node rework rounds.
- Maximum same failure signature per node.
- Maximum loop iterations.
- Maximum recovery rounds.
- Maximum dynamic execution nodes.
- Maximum wall-clock runtime.
- Required verification evidence.

If a loop reaches a limit, it must stop and escalate to `frontdesk` with a compact
evidence package.

Local non-convergence should not automatically stop the whole loop. The loop
runner should freeze the affected node and dependent branch, drain unrelated
work, and return a partial package to planner unless the failure invalidates a
global design assumption or contaminates shared state.

## Team Spec Direction

Borrow the Team Builder idea by declaring workflow teams:

```yaml
teams:
  planner_group:
    agents: [planner, plan_reviewer]
    termination: plan_ready_or_blocked

  clarification_broker:
    agents: [semantic_broker]
    termination: questions_ready_or_defaulted

  execution_node:
    agents: [worker, checker]
    termination: checker_passed_blocked_or_non_converged

  round_checker:
    agents: [round_checker]
    termination: round_passed_partial_or_replan

  recovery_node:
    agents: [diagnoser, fixer, verifier]
    termination: root_cause_fixed_or_escalate

handoffs:
  clarification_needed: clarification_broker
  questions_ready: frontdesk
  answers_normalized: planner_group
  planning_ready: orchestrator
  work_decomposed: execution_node
  nodes_drained: round_checker
  round_partial: planner_group
  check_failed: recovery_node
  done: plan_steward
  unrecoverable: frontdesk
```

The spec should be declarative; the loop runner enforces it.

## Trellis Comparison

Trellis:

- Uses project-local files for workflow state.
- Uses hooks and skills to remind the main session.
- Relies on provider-native subagents where available.
- Keeps much of the flow main-session driven.

CCB target:

- Uses project-local and runtime-local files for workflow state.
- Uses scripts as the authority for transitions.
- Uses visible CCB agents and `ask`/callback state for execution.
- Makes the loop state machine, not `frontdesk`, drive the next handoff.
