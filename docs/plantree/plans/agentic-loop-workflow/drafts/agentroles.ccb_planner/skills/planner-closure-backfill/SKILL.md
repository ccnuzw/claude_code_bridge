---
name: planner-closure-backfill
description: Produce revision-fenced Planner replan or task-set closure proposals and compact Frontdesk status evidence from validated workflow envelopes.
---

# Planner Closure Backfill

Use this skill only when the activation mode is `detail_replan` or
`task_set_closure`. Initial intake remains owned by `planner-task-packet`.

## Inputs

- expected PlanTree and task/task-set revisions
- original intake and Planner task refs
- validated Detailer macro-impact evidence, or task-set closure envelope
- child round, release, cleanup, and evidence digests
- current Brief/Roadmap/TODO summary supplied by the host

Do not run shell commands, file reads/searches, tests, builds, CCB commands, or
notification commands. Use only the compact authority envelope in the prompt.

## Semantic Decisions

Planner decides:

- whether Detailer evidence changes scope, dependency, acceptance, risk,
  Roadmap ordering, or only local implementation detail;
- which accepted facts and completed child outputs remain valid;
- how partial, blocked, or replan branches change Roadmap/TODO state;
- whether the next milestone is ready, needs clarification, blocked, or the
  macro request is terminal;
- what concise status Frontdesk may report to the user.

Planner does not decide whether child evidence, cleanup, release, identity, or
revision checks passed. Those are script-owned input facts.

## Output

Return exactly these two fenced sections and no alternative authority shape:

````markdown
**planner-backfill.json**
```json
{
  "schema": "ccb.planner.backfill.v1",
  "mode": "detail_replan|task_set_closure",
  "expected_plan_revision": 1,
  "task_or_task_set_id": "stable-id",
  "task_or_task_set_revision": 1,
  "aggregate_result": "pass|partial|replan_required|blocked",
  "brief_summary": "durable compact summary",
  "roadmap_updates": [],
  "todo_updates": [],
  "decision_refs": [],
  "open_question_refs": [],
  "evidence_refs": [],
  "preserved_completed_scope": [],
  "unresolved_scope": [],
  "next_milestone": "milestone-id|terminal|needs_clarification|blocked",
  "frontdesk_notification_required": true
}
```

**frontdesk-status.md**
```markdown
Status: completed|partial|replan_required|blocked
Summary: <user-facing factual summary>
Completed scope:
- <scope or none>
Unresolved scope:
- <scope or none>
Next step: <next milestone, clarification, escalation, or terminal>
Evidence refs:
- <stable ref>
```
````

## Rules

- Never output `pass` when the closure envelope is partial, blocked,
  replan-required, incomplete, or system-failed.
- Never omit unresolved required scope from mixed outcomes.
- Multiple replan children produce one coherent macro proposal, not multiple
  independent Planner actions.
- Never overwrite a newer PlanTree revision. Return `revision_conflict` and the
  supplied current revision as a blocker.
- Do not fabricate child evidence, hashes, tests, release, cleanup, or user
  decisions.
- Do not modify PlanTree or send Frontdesk messages from this reply-only
  surface. The host imports the proposal and exposes any restricted delivery
  capability separately.
