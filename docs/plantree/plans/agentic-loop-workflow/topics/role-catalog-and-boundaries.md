# Workflow Role Catalog And Boundaries

Date: 2026-06-27

## Purpose

Define the role catalog needed by the CCB agentic workflow before converting
the roles into Agent Roles specs.

This document follows the current architecture in
[architecture.md](architecture.md) and the Chinese workflow overview in
[agentic-workflow-scheme.zh.md](agentic-workflow-scheme.zh.md).

The design principle remains:

```text
program kernel stays simple and stable
semantic flexibility belongs to roles
scripts commit or reject role artifacts
```

Roles should not be designed as one omnipotent main agent. Each role should
hold only the context required for its phase, produce explicit artifacts, and
respect script-owned authority.

## Role Design Tiers

### V1 Required RolePacks

These roles should be designed first for `agent-roles` because they are needed
to close the first planner-to-execution workflow loop.

| RolePack | Default Agent | Lifetime | Main Output |
| :--- | :--- | :--- | :--- |
| `agentroles.ccb_frontdesk` | `frontdesk` | long-lived / user-facing | macro task packet, user-facing summary, escalation display |
| `agentroles.ccb_planner` | `planner` | phase-activated | draft task packet artifacts and readiness recommendation |
| `agentroles.ccb_plan_reviewer` | `plan_reviewer` | phase-activated | planner quality review and readiness/blocker findings |
| `agentroles.ccb_clarification_broker` | `clarification_broker` | temporary per question batch | user-question artifact, defaults, deferred questions, normalized answers |
| `agentroles.ccb_orchestrator` | `orchestrator` | ask-activated per round | node plan, capacity request, task dispatch, round aggregation |
| `agentroles.ccb_worker` | `worker` | short-lived per work item | bounded implementation or investigation result |
| `agentroles.ccb_checker` | `code_reviewer` | short-lived per work item | node verification, fallback audit, pass/rework/block decision |
| `agentroles.ccb_round_checker` | `round_checker` | per execution round | round result report: `pass`, `partial`, `replan_required`, or `global_blocker` |

### V1 Script/Hybrid Roles

These are part of the workflow architecture but should not initially become
heavy semantic RolePacks.

| Role | Form | Reason |
| :--- | :--- | :--- |
| `loop_runner` | CCB program/helper | Owns deterministic routing, locks, leases, status edges, and one-shot activation. It must not become an agent conversation. |
| `plan_steward` | deterministic `ccb plan` first, optional semantic auditor later | Script commands own authoritative task/index/status writes. A semantic steward may summarize or audit, but cannot bypass scripts. |
| `runtime_layout_manager` | CCB program/helper | Owns tmux window/pane placement. Semantic roles request capacity; they do not mutate panes directly. |

### V2 Optional RolePacks

These should be designed after V1 loop closure is proven.

| RolePack | Default Agent | Trigger | Main Output |
| :--- | :--- | :--- | :--- |
| `agentroles.ccb_risk_reviewer` | `risk_reviewer` | destructive, release, migration, credential, or broad-runtime changes | risk gate and required approvals |
| `agentroles.ccb_inner_monitor` | `inner_monitor` | long-running or anomalous loop | health report and escalation recommendation |
| `agentroles.ccb_recovery` | `recovery` | provider/ask/tmux/lease failure | recovery plan or blocked evidence package |
| `agentroles.ccb_plan_steward` | `plan_steward` | durable plan sync boundary | low-noise plan-tree sync summary |
| `agentroles.ccb_domain_researcher` | `domain_researcher` | planner lacks domain evidence | source-backed research brief |
| `agentroles.ccb_spec_checker` | `spec_checker` | public contract or RolePack/spec changes | spec conformance report |

## V1 Role Boundaries

### Frontdesk

Owns:

- user conversation;
- macro task intake;
- scope, non-goal, and high-risk confirmation;
- presenting curated clarification questions;
- final user-facing summary;
- unrecoverable escalation display.

Must not:

- implement code;
- call worker/checker directly;
- write authoritative task status;
- read high-frequency loop logs unless presenting an escalation artifact;
- micromanage planner or orchestrator internals.

Required skills/templates:

- macro task intake template;
- user clarification display template;
- final summary / escalation template;
- optional `ask` skill only for sending macro packets to planner or asking
  configured dialog experts.

### Planner

Owns:

- understanding macro task intent;
- reading relevant plan-tree/source context;
- producing task packet artifacts: requirements, design notes, acceptance
  criteria, verification contract, risk notes, handoff;
- producing candidate questions for broker;
- recommending `ready`, `needs_clarification`, `blocked`, or `not_ready`.

Must not:

- talk directly to the user;
- manage runtime agents;
- mark status ready by editing files directly;
- lower acceptance criteria to make work executable;
- treat round checker output as permission to silently reduce scope.

Required skills/templates:

- task packet drafting template;
- verification contract template;
- candidate question template;
- readiness recommendation schema;
- `ccb plan` usage guide for artifact import through scripts.

### Plan Reviewer

Owns:

- checking planner artifacts for ambiguity, scope drift, missing acceptance,
  weak verification, unhandled risk, and hidden assumptions;
- approving or rejecting readiness as a semantic recommendation;
- forcing broker clarification when user input is truly blocking.

Must not:

- rewrite the whole plan as a second planner unless asked;
- implement code;
- mark task status directly;
- approve vague acceptance criteria.

Required skills/templates:

- readiness checklist;
- ambiguity/risk review template;
- negative prompt checklist for hidden fallback and scope shrinkage.

### Clarification Broker

Owns:

- merging planner candidate questions;
- removing duplicate, obsolete, already-answerable, or non-blocking questions;
- recording safe defaults and deferred questions;
- producing a compact user-facing question artifact for frontdesk;
- normalizing user answers for planner.

Must not:

- directly converse with user except through frontdesk artifacts;
- activate execution;
- rewrite product scope;
- ask every possible question upfront.

Required skills/templates:

- candidate-question filter template;
- user-question display artifact;
- normalized-answer artifact;
- defaults/deferred-question ledger.

### Orchestrator

Owns:

- reading ready task packet and verification contract;
- estimating complexity;
- choosing 1-4 execution nodes;
- requesting capacity through the fixed capacity skill;
- dispatching bounded worker/checker tasks with constraints;
- aggregating node results and dependency state;
- returning a round summary for round checker.

Must not:

- call reload/kill/tmux directly;
- write `.ccb/runtime` or task status directly;
- create unbounded fanout;
- convert `partial` into `done`;
- lower acceptance criteria.

Required skills/templates:

- `orchestrator-capacity` skill;
- node slicing template;
- worker dispatch template;
- checker dispatch template;
- round aggregation template;
- partial/non-convergence escalation rules.

### Worker

Owns:

- executing one bounded work item;
- producing concise implementation or investigation evidence;
- reporting files touched, commands run, and unresolved blockers.

Must not:

- change task scope;
- silently degrade;
- hide failed tests;
- edit plan-tree authority files;
- claim global success.

Required skills/templates:

- bounded work-item template;
- evidence report template;
- failure/blocker report template.

### Checker

Owns:

- deriving node-level verification from the planner contract and worker task;
- running or specifying focused tests;
- reviewing worker output for correctness, hidden fallback, degradation,
  scope shrinkage, and missing evidence;
- returning `pass`, `rework_required`, `blocked`, or `non_converged`.

Must not:

- become the primary implementer by default;
- lower acceptance criteria;
- approve partial work as complete;
- change global plan or task split.

Required skills/templates:

- node check plan template;
- fallback/degradation audit;
- rework request template;
- non-convergence report.

### Round Checker

Owns:

- verifying the integrated execution round;
- reading planner verification contract, orchestrator summary, and node reports;
- deciding concrete round result:
  `pass`, `rework_node`, `partial`, `replan_required`, or `global_blocker`;
- producing durable round report suitable for `ccb plan task-import-round`.

Must not:

- fix code;
- change product scope;
- directly write task status;
- infer success without evidence;
- route next loop by itself.

Required skills/templates:

- round verification plan;
- round result report with a standalone machine line:
  `round result: pass|partial|replan_required|global_blocker`;
- evidence reference checklist;
- hidden degradation audit.

## Script Boundary Required In Every RolePack

Every CCB workflow RolePack should include a common CCB authority rule:

```text
You may author semantic artifacts and recommend transitions.
You must not directly edit authoritative state:
- task index
- task status
- current_loop
- leases or locks
- runtime capacity records
- tmux pane/window state

Use CCB commands such as `ccb plan`, `ccb loop`, `ccb question`, or the
provided skill wrappers for authoritative writes.
```

## Design Requirements For Mother

When `mother` designs these RolePacks, it should produce for each V1 role:

- role id and default local agent name;
- identity and mission;
- authority and non-authority;
- required inputs;
- expected outputs and artifact schemas;
- required skills;
- reusable templates;
- negative instructions;
- CCB script boundary text;
- minimal smoke-test scenario;
- compatibility notes for CCB visible agents and future non-CCB hosts.

The first external Agent Roles spec pass should focus on:

1. `agentroles.ccb_planner`
2. `agentroles.ccb_plan_reviewer`
3. `agentroles.ccb_clarification_broker`
4. `agentroles.ccb_round_checker`
5. review and tighten the existing `agentroles.ccb_orchestrator`

`frontdesk`, `worker`, and `checker` can be drafted in the same catalog, but
they may reuse simpler generic role templates at first.

## Mother Design Review

The first `mother` RolePack design pass was completed on 2026-06-27 and is
recorded in
[../history/mother-rolepack-design-2026-06-27.md](../history/mother-rolepack-design-2026-06-27.md).

Accepted refinements:

- Treat `planner`, `plan_reviewer`, `clarification_broker`, `orchestrator`,
  and `round_checker` as P0 complete RolePack work.
- Treat `frontdesk`, `worker`, and `checker` as P1 simplified reference roles.
- Keep monitor, recovery, risk, plan steward, domain researcher, and spec
  checker as P2 boundary-only roles until V1 loop closure is stable.
- Require a shared authority rule in every CCB workflow RolePack.
- Split host-neutral RolePack content from CCB adapter-specific command,
  runtime, tmux, ask/callback, lease, and capacity details.

Immediate external Agent Roles spec handoff order:

1. common authority rule and artifact templates;
2. `ccb_planner`;
3. `ccb_plan_reviewer`;
4. `ccb_round_checker`;
5. tightened `ccb_orchestrator`;
6. `ccb_clarification_broker`;
7. simplified `frontdesk`, `worker`, and `checker`.

## Draft Landing Status

The first CCB workflow RolePack draft set is now present under
`drafts/`:

- `_shared/authority-rule.md` and `_shared/templates/*`;
- `agentroles.ccb_planner`;
- `agentroles.ccb_plan_reviewer`;
- `agentroles.ccb_clarification_broker`;
- `agentroles.ccb_orchestrator`;
- `agentroles.ccb_round_checker`;
- `agentroles.ccb_frontdesk`;
- `agentroles.ccb_worker`;
- `agentroles.ccb_checker`.

Current targeted verification:

```bash
PYTHONPATH=lib pytest -q test/test_orchestrator_rolepack.py
```

Result:

```text
7 passed
```

This verifies manifest translation, CCB adapter provider coverage, skill
projection paths, shared authority-rule presence, required templates, and the
shared round-result contract.
