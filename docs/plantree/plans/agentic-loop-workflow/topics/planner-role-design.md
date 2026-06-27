# Planner Role Design

Date: 2026-06-25

## Purpose

The planner group turns a macro task from `frontdesk` into an execution-ready
task packet. It owns semantic understanding, requirement shaping, risk
surfacing, and readiness judgment, but it does not own authoritative state
writes.

This keeps `frontdesk` light and keeps durable plan-tree state from becoming a
free-form model scratchpad.

## Role Boundary

### Planner Group Owns

- Understanding the macro task and identifying missing requirements.
- Reading relevant plan-tree, source, and prior evidence.
- Producing draft requirements, design notes, acceptance criteria, verification
  contract, risk notes, and execution handoff.
- Emitting stage-batched candidate questions when user input is genuinely
  needed.
- Running internal review before marking a task ready.
- Returning `ready`, `needs_clarification`, `blocked`, or `not_ready` as a
  semantic recommendation.

### Planner Group Does Not Own

- Direct user conversation. User-facing questions go through broker and
  `frontdesk`.
- Authoritative task status, task index, phase, owner, or loop state writes.
- Runtime agent load/unload, `ask` scheduling, worker selection, or loop
  capacity.
- Final code correctness approval. It defines what must be proven; checker and
  round checker evaluate actual work.
- Silent fallback from unclear requirements to reduced scope.

## Internal Shape

V1 can start with two semantic roles:

```text
planner
  -> drafts plan packet
plan_reviewer
  -> checks ambiguity, acceptance criteria, risks, and verification contract
```

Optional later roles:

- `risk_reviewer`: only for destructive, release, migration, security,
  payment, credential, or broad-runtime changes.
- `domain_researcher`: only when planner lacks source-backed domain knowledge.
- `spec_checker`: only when the task changes public contracts or Role specs.

The group should remain small. If a task needs many specialists, planner should
produce a clearer plan packet and let orchestrator split execution work later.

## Inputs

Planner receives a macro packet from `frontdesk`:

```text
macro_task
user_goal
constraints
known_non_goals
risk_tolerance
target_plan_root
source_refs
prior_decisions
```

Planner may load:

- the target plan root README, roadmap, open questions, and active topics;
- relevant source files or tests;
- prior user answers from normalized clarification artifacts;
- accepted decisions and evidence indexes.

Planner should not load runtime loop logs unless they are referenced as durable
evidence or blocker material.

## Outputs

Planner writes draft artifacts, then asks `ccb plan` scripts to import them as
authoritative task packet files.

Draft outputs:

```text
requirements.md
design-notes.md
acceptance-criteria.md
verification-contract.md
risk-notes.md
handoff.md
candidate-questions.jsonl
planner-review.md
readiness.json
```

`readiness.json` should be compact:

```json
{
  "status": "ready",
  "confidence": "high",
  "blocking_questions": [],
  "deferred_questions": [],
  "required_artifacts": [
    "requirements",
    "acceptance",
    "verification",
    "handoff"
  ],
  "risk_flags": []
}
```

## Clarification Handling

Planner should batch questions by stage:

1. produce candidate questions with why-this-blocks evidence;
2. send them to broker, not directly to `frontdesk`;
3. wait for normalized answers or broker-recorded defaults;
4. update the draft plan packet;
5. only then request ready transition.

Planner should not ask every possible question up front. It should ask only
questions that block the current planning stage or create unacceptable risk if
defaulted.

## Readiness Rules

A task is execution-ready only when:

- desired behavior is concrete enough for a worker;
- non-goals and forbidden degradations are explicit;
- acceptance criteria are testable;
- verification contract states what must be proven;
- risk notes identify irreversible or user-sensitive choices;
- required user clarifications are answered, defaulted with evidence, or
  deferred with a reason;
- handoff is concise enough for orchestrator to split into bounded work items.

If these are missing, planner must return `not_ready` or
`needs_clarification`; it must not shrink scope to make the task executable.

## Plan Steward Relationship

Planner proposes content. Plan steward and `ccb plan` scripts write authority.

Recommended sequence:

```text
frontdesk macro packet
  -> planner draft artifacts
  -> plan_reviewer report
  -> ccb plan task-create / task-artifact
  -> ccb plan task-status --status ready
  -> loop runner may activate orchestrator
```

The plan steward can be implemented as:

- deterministic command services for actual writes;
- an optional semantic role that audits plan-tree consistency and prepares
  sync summaries, without bypassing scripts.

## Next-Loop Rehydration

Planner is responsible for creating the next task when a round returns
`partial` or `replan_required`, but it should not rely on retained conversation
memory from the prior planning turn.

For next-loop planning, planner should reload:

- the original task packet;
- imported completion, partial, blocker, or replan evidence;
- round checker report;
- orchestrator summary and dependency notes;
- node/checker reports referenced by the round report;
- normalized user answers when broker/frontdesk was involved.

Planner should then produce a revised task packet or clarification batch. It
must not treat round checker evidence as permission to lower acceptance
criteria. See
[round-checker-and-planner-rehydration.md](round-checker-and-planner-rehydration.md).

## Planner Stop Conditions

Planner is a workflow-loop participant, so it also needs bounded progress.
Loop runner should stop or escalate planner cycling when one of these limits is
reached:

- Maximum planner iterations for the same task without a new artifact, answer,
  decision, or evidence ref.
- Maximum `partial` or `replan_required` cycles for the same failure
  signature.
- Maximum user scope changes inside one active loop.
- Repeated readiness recommendations that fail script validation for the same
  reason.
- Repeated clarification batches that broker marks as non-blocking,
  duplicate, obsolete, or defaultable.

When a planner stop condition is hit, planner should produce a compact
escalation package with the task id, current artifacts, repeated failure
signature, unresolved decision, and recommended next owner. Scripts then mark a
paused or blocked state; planner must not silently reduce scope to satisfy the
limit.

## Context-Purity Budget

Planner context should include stable planning material and current stage
drafts. It should exclude:

- raw ask logs;
- node heartbeats;
- pane/provider runtime noise;
- every worker retry;
- unrelated historical tasks;
- release logs unless the current task is a release task.

If execution detail becomes durable evidence, the plan steward should link it
back into plan-tree at a boundary instead of dumping raw runtime logs into the
planner conversation.
