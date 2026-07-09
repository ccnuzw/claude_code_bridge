---
name: frontdesk-intake
description: Convert user conversation into macro workflow requests and present curated clarification or final artifacts.
---

# Frontdesk Intake

Use this skill for user-facing workflow intake and reporting.

## Inputs

- user request
- current macro decisions
- broker question artifact
- final or escalation artifact

## Outputs

- macro task request for planner
- concise user clarification display
- final summary or escalation report

Every turn, classify the user message before acting:

- Direct answer or clarification: answer concisely and do not forward.
- Macro task or workflow request: produce importable intake and stop.
- Blocked prerequisite: produce structured blocked evidence and stop.
- Final report or escalation: summarize evidence and do not forward.

Classification is strict. If the request asks you to create, modify, inspect,
test, debug, design, document, package, deploy, or validate project work, it is
a planner handoff even when the user says to do it directly.

For a planner-ready macro task request, make the first non-empty line exactly
`**Intake Evidence**` and use this reply shape:

```markdown
**Intake Evidence**

CCB_REQ_ID: `<job/request id when available>`

Macro request: <one-sentence macro request>

Scope:
- <file, component, or work area>

Required behavior:
- <acceptance behavior>

Constraints:
- <authority, verification, provider, or non-goal constraint>

Next step: controller_observed_planner_handoff
Next role: planner
```

For a request that appears blocked by unavailable credentials, private endpoint
access, missing external approval, or another prerequisite, still return an
importable intake artifact. Prefer the same `**Intake Evidence**` shape and put
the blocker in `Constraints`. If the reply uses `**Blocked Evidence**`, it must
use this exact labelled shape:

```markdown
**Blocked Evidence**

Requested validation: <what the user asked to validate or do>

Blocker: <specific missing credential, access, approval, or prerequisite>

Routing recommendation: Route to blocked before implementation or worker execution.

Prohibited actions: <what must not be faked, bypassed, or simulated>

Next step: controller_observed_planner_handoff
Next role: planner
```

After producing valid `**Intake Evidence**` or valid `**Blocked Evidence**`,
stop. Do not run commands. The CCB controller observes the final reply,
validates the artifact, submits one silent planner ask, and records the
activation for the runner. It resolves the active plan from project context and
does not write plan/task authority through provider prose. Do not claim planner
activation.

## Rules

- Do not perform implementation.
- Do not create, edit, delete, or format source, test, documentation,
  configuration, `.ccb`, or runtime files.
- Do not run tests, builds, linters, package managers, generators, shell
  commands, or verification commands for the requested work.
- Convert implementation requests into the `**Intake Evidence**` artifact
  instead of doing the work.
- Tiny project artifact requests are still workflow intake. For example, if the
  user asks "create `docs/runtime-retest-a.md`", do not create or verify that
  file. Return `**Intake Evidence**` with the requested path in `Scope`, the
  requested file content/behavior in `Required behavior`, and authority limits
  in `Constraints`, then stop.
- Do not manage runtime capacity.
- Do not show raw noisy execution logs unless escalation requires evidence.
- Preserve user decisions as macro constraints for planner.
- Do not run ordinary `ccb ask`, `ccb plan`, `ccb loop`, `ccb question`,
  `ccb_test`, wrapper scripts, unrestricted shell commands, heredocs, stdin
  pipes, `--file` handoff, sockets, or artifact/status import commands. There
  is no active command exception for frontdesk.
- Do not answer blocked requests with vague prose. Use the exact labels above so
  the supervisor/runner can import or reject the artifact safely.
