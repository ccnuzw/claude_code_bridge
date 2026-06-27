# Clarification Flow

Date: 2026-06-24

## Principle

Clarification should be stage-batched, artifact-first, and reference-driven.

Planner group may discover many uncertainties while shaping a plan, but it
should not stream all of them to `frontdesk` or to the user. It should emit a
candidate batch for the current phase. A broker then filters the batch into a
small set of user-facing questions, records defaults and deferrals, and returns
normalized answers to planner group.

The goal is to preserve context purity:

- `frontdesk` sees only the curated user-facing question artifact and answer
  status.
- Planner group sees the broker review and normalized answers.
- Runtime artifacts hold raw candidates, raw answers, and fast-changing detail.
- Durable plan-tree files only receive accepted assumptions, decisions,
  blockers, or design consequences.

## Why Stage-Batched

Asking every question immediately creates too much context noise and forces
`frontdesk` into detailed planning. Asking every possible question up front
creates a long interrogation that may become obsolete once early answers or code
evidence change the plan.

Stage-batched clarification balances both risks:

- Ask only questions needed for the current phase.
- Let broker answer or default low-risk details from existing evidence.
- Defer later-phase uncertainty until it is actually needed.
- Keep one compact user interaction per phase when possible.

## Role Boundaries

| Role | Input | Output | Must Not Do |
| :--- | :--- | :--- | :--- |
| planner group | Macro task, plan-tree, code evidence | Candidate question batch | Directly ask the user |
| clarification broker | Candidate questions and evidence refs | User question artifact, assumptions, deferrals, normalized answers | Start execution loop |
| frontdesk | User question artifact ref | Raw user answer | Inspect all planning scratch by default |
| planner group after answer | Normalized answers and assumptions | Updated plan or execution-ready artifact | Re-ask broker-resolved details |

## Broker Lifecycle

The persistent component is not a long-lived semantic agent. Persistent state is:

- Question queue.
- Candidate question batch.
- Broker review.
- User-facing question artifact.
- Raw answers.
- Normalized answers.
- Deferred and obsolete question records.

The semantic broker should normally be launched with fresh context for one phase
batch, then released. A deterministic router can remain as a CCB helper that
creates files, validates schemas, and wakes the next owner.

## Runtime File Layout

```text
.ccb/runtime/loops/<loop-id>/clarification/<phase>/
  candidate_questions.jsonl
  broker_review.json
  user_questions.md
  assumptions.jsonl
  deferred_questions.jsonl
  obsolete_questions.jsonl
  raw_answers.jsonl
  normalized_answers.jsonl
```

## Candidate Question Shape

```json
{
  "question_id": "q-001",
  "phase": "planning",
  "asked_by": "planner",
  "question": "Should rich workflow be enabled by default for new projects?",
  "why_needed": "Default behavior changes install and startup experience.",
  "decision_surface": "product_scope",
  "blocking": true,
  "options": ["default_on", "opt_in", "project_config"],
  "evidence_refs": [
    "docs/plantree/plans/agentic-loop-workflow/roadmap.md"
  ],
  "default_if_unanswered": null,
  "defer_until": null
}
```

## Broker Classification

| Class | Meaning | Action |
| :--- | :--- | :--- |
| `user_needed` | Current phase is blocked by user preference, scope, or risk tolerance | Include in `user_questions.md` |
| `answerable` | Code, plan-tree, or prior answer already resolves it | Record broker answer and evidence |
| `assumed` | Safe default is acceptable for current phase | Record in `assumptions.jsonl` |
| `deferred` | Real question, but not needed for this phase | Record in `deferred_questions.jsonl` |
| `obsolete` | Plan changed and the question no longer applies | Record in `obsolete_questions.jsonl` |
| `split` | One question contains several decision surfaces | Split before classification |

## User Question Budget

The default target should be one compact question set per phase, with a small
maximum such as three user-facing questions unless the workflow spec raises the
budget. If more questions remain after broker filtering, broker should prefer:

1. Ask questions that block current phase safety or scope.
2. Default low-risk implementation details.
3. Defer future-phase choices.
4. Escalate to `frontdesk` only with the curated display artifact reference.

## Reference-First Handoff

Broker should avoid sending large text payloads through agent messages. It
should send compact references:

```json
{
  "event": "questions_ready",
  "loop_id": "20260624-rich-workflow-001",
  "phase": "planning",
  "display_ref": ".ccb/runtime/loops/20260624-rich-workflow-001/clarification/planning/user_questions.md",
  "count": 2
}
```

`frontdesk` presents the display artifact to the user, records the raw answer,
and returns only the answer artifact reference:

```json
{
  "event": "user_answered",
  "loop_id": "20260624-rich-workflow-001",
  "phase": "planning",
  "raw_answer_ref": ".ccb/runtime/loops/20260624-rich-workflow-001/clarification/planning/raw_answers.jsonl"
}
```

Broker then normalizes the answer and notifies planner:

```json
{
  "event": "answers_normalized",
  "loop_id": "20260624-rich-workflow-001",
  "phase": "planning",
  "answers_ref": ".ccb/runtime/loops/20260624-rich-workflow-001/clarification/planning/normalized_answers.jsonl"
}
```

## Event Flow

```text
planner_group
  -> ccb question candidates
  -> clarification_broker
  -> ccb question broker-review
  -> ccb question publish
  -> frontdesk
  -> ccb question answer
  -> clarification_broker
  -> ccb question resolve
  -> planner_group
```

Broker resolution must not directly activate `loop runner` or execution nodes.
Planner group remains responsible for incorporating clarified answers into the
plan and marking the task ready through the normal planning review path.

## Answer Normalization

Raw answers should be preserved, but planner should consume normalized records:

```json
{
  "question_id": "q-001",
  "raw_answer_ref": "raw_answers.jsonl#1",
  "normalized_decision": "project_config",
  "confidence": "high",
  "planner_note": "Use opt-in project config for v1; do not make rich default.",
  "requires_followup": false
}
```

If confidence is low, broker may return a second focused question to
`frontdesk`. It should not expand the scope or introduce unrelated questions in
that follow-up.
