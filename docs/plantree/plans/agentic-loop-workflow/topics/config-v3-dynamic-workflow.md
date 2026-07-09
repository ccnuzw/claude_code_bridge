# Config V3 Dynamic Workflow

Date: 2026-07-08

## Status

Design follow-up lane. Source implementation has not started. This revision
deepens the control-file contract and implementation split; it is still a
planning artifact, not a shipped config contract.

2026-07-08 update: the v3 lane now includes an enhanced configuration control
panel direction. The panel is an editing, explanation, preview, and validation
surface over the same config authority; it is not a second runtime authority
or a replacement for `.ccb/ccb.config`.

`ccb_self` design input was requested in job `job_a398feb91b6d`; the artifact
is stored at
`.ccb/ccbd/artifacts/text/completion-reply/job_a398feb91b6d-art_98066c1131e749fe.txt`.
This topic records the implementation-facing direction, not a final landed
contract.

`odesign` reviewed the enhanced control panel direction in job
`job_669f39f1971f`; the artifact is stored at
`.ccb/ccbd/artifacts/text/completion-reply/job_669f39f1971f-art_f6bca9c79a7649eb.txt`.
The adopted product framing is a "config preparation workflow", not an admin
dashboard.

## Goal

Keep `version = 2` as the stable static-layout CCB config for users who prefer
manual pane and agent arrangement. Add `version = 3` as an opt-in dynamic
workflow config where users declare workflow roles, providers, models, and
runtime capacity while CCB owns agent placement, mount, release, and validation.

The v3 design must make a real opened project easier to prepare:

- no hand-written static `[windows]` layout for the agentic workflow path;
- required workflow roles are explicit and validated before startup;
- provider/model choices such as `codex`, `claude`, and `gpt-5.5` are declared
  per role or inherited from defaults;
- missing rolepacks, unsupported providers, invalid model flags, and static/v3
  field mixing fail during `ccb config validate`, not during a live provider run.

## Current V2 Baseline

Current v2 config has three active shapes:

- compact layout text such as `agent1:codex; agent2:claude`;
- rich TOML with `[windows]` plus `[agents.<name>]` overlays;
- optional dynamic execution substrate under `[loop.capacity]` and
  `[loop.role_profiles.<profile>]`.

Important implementation anchors:

- `lib/agents/config_loader_runtime/parsing_runtime/validation.py` hard-checks
  `version == 2`.
- `lib/agents/models_runtime/names.py` sets `SCHEMA_VERSION = 2`.
- `lib/agents/models_runtime/config_runtime/project.py` rejects any
  `ProjectConfig.version` other than the schema version.
- `lib/cli/services/config_validate.py` currently reports source/default
  agents/agents/cmd/layout and style warnings, but not workflow role
  completeness.
- `lib/agents/config_loader_runtime/parsing_runtime/loop_capacity.py` already
  parses role profiles with rolepack installation checks.

The v3 work must preserve this v2 behavior and its tests.

## Control File Authority Model

`version = 3` remains a desired-state control file, not live runtime authority.
The live authority remains the mounted daemon graph, lifecycle records, current
configured-agent runtime records, queue/mailbox state, and explicit CCB command
results.

The v3 control file owns:

- the workflow profile to activate;
- logical resident role slots and dynamic role profiles;
- provider, model, thinking, workspace, provider-profile, and startup defaults;
- capacity limits, lifetime, reuse, release, and window placement policy;
- validation requirements before startup or reload.

It must not own:

- direct tmux pane ids or hand-authored agent window layouts;
- provider conversation flow or `ask` edges;
- task status, round status, or artifact import authority;
- provider replies as runtime permissions;
- direct writes under `.ccb/runtime` other than through CCB commands.

The implementation should compile v3 into existing runtime consumables without
rewriting the user's file into v2. The first slice may compile an in-memory
effective `ProjectConfig` for compatibility with current ccbd startup/reload,
but the disk source remains v3 and `ccb config validate` must report the v3
workflow surface, not a fake user-authored `[windows]` layout.

## V3 Field Contract

### Top-Level Tables

Allowed in the first v3 slice:

| Table | Purpose | Notes |
| :--- | :--- | :--- |
| `version` | Must be integer `3`. | Loader dispatch key. |
| `[workflow]` | Workflow profile and entry role. | Required. |
| `[workflow.defaults]` | Provider/model/thinking defaults shared by roles. | Optional but recommended. |
| `[workflow.defaults.resident]` | Defaults for resident role slots. | Optional. |
| `[workflow.defaults.dynamic]` | Defaults for dynamic profiles. | Optional. |
| `[workflow.runtime]` | Capacity, lifetime, release, and placement policy. | Required for dynamic execution. |
| `[workflow.resident.<slot>]` | Long-lived or semi-resident workflow roles. | Required slots depend on profile. |
| `[workflow.dynamic.<profile>]` | Ephemeral/on-demand execution profiles. | Required profiles depend on profile. |
| `[ui]` | Sidebar/view presentation. | Allowed only when it does not define agents. |
| `[tool_windows]` | Non-agent managed tool windows. | Allowed because they are not agent authority. |
| `[maintenance]` | Maintenance heartbeat policy. | Allowed unchanged from v2. |

Forbidden in v3:

- `[windows]`
- `[agents]`
- `default_agents`
- `layout`
- `cmd_enabled`
- `[loop.role_profiles]`
- `[loop.capacity]`

The forbidden fields are not compatibility shims. They fail validation because
they would create dual authority between static layout and dynamic workflow
compilation.

### `[workflow]`

Required keys:

| Key | Type | Values | Meaning |
| :--- | :--- | :--- | :--- |
| `mode` | string | `agentic-loop` initially | Selects the v3 control-file family. |
| `profile` | string | `agentic_loop_v1` initially | Selects required roles and defaults. |
| `entry_role` | string | resident slot name | User-facing entry target; first slice requires `frontdesk`. |

Unknown keys should fail. Future workflow families should add a new profile or
mode with an explicit parser, not silently accept arbitrary fields.

### Role/Profile Fields

Resident slots and dynamic profiles share a base field set:

| Field | Resident | Dynamic | Meaning |
| :--- | :---: | :---: | :--- |
| `role` | required | required | RolePack id such as `agentroles.ccb_frontdesk`. |
| `provider` | optional | optional | Inherits from defaults when omitted. |
| `model` | optional | optional | Inherits from defaults; compiled to provider startup args. |
| `thinking` | optional | optional | Provider-specific thinking/effort hint where supported. |
| `workspace_mode` | optional | optional | `inplace`, `git-worktree`, or later `copy`. |
| `workspace_group` | optional | optional | Only valid with `workspace_mode = "git-worktree"`. |
| `startup_args` | optional list | optional list | Extra provider startup args; must not duplicate model flags. |
| `provider_profile` | optional table | optional table | Same semantics as v2 provider profiles. |
| `env` | optional table | optional table | Provider process env overlay; no secrets printed in diagnostics. |
| `labels` | optional list | optional list | Diagnostics/UI labels. |
| `description` | optional | optional | Human-readable config summary. |

Dynamic-only fields:

| Field | Required | Meaning |
| :--- | :---: | :--- |
| `max_instances` | yes | Per-profile dynamic capacity ceiling. |
| `reuse` | no | `prefer_idle`, `always_new`, or `pinned`; default comes from `workflow.defaults.dynamic`. |
| `legacy_aliases` | no | Migration-only profile aliases, e.g. `["worker"]` for `coder`. |
| `release_policy` | no | `auto`, `hide`, `park`, `retain`, or `unload`; defaults from runtime policy. |
| `window_class` | no | Placement hint such as `execution`; not a concrete tmux pane. |

Resident-only fields:

| Field | Required | Meaning |
| :--- | :---: | :--- |
| `lifecycle` | no | Defaults to `resident`; future values may include `semi_resident`. |
| `window_class` | no | Placement hint such as `user` or `plan`. |

The first implementation should reject fields it does not actively understand.
Do not accept and ignore future-looking fields, because config validation is
supposed to catch drift before runtime.

## Proposed V3 Shape

Recommended user-authored shape:

```toml
version = 3

[workflow]
mode = "agentic-loop"
profile = "agentic_loop_v1"
entry_role = "frontdesk"

[workflow.defaults]
provider = "codex"
model = "gpt-5.5"
thinking = "medium"

[workflow.defaults.resident]
workspace_mode = "inplace"
reuse = "pinned"

[workflow.defaults.dynamic]
workspace_mode = "git-worktree"
reuse = "prefer_idle"

[workflow.runtime]
max_nodes = 2
default_lifetime = "current_round"
name_template = "loop-{loop_id}-{profile}-{index}"
release_policy = "auto"
window_policy = "auto"

[workflow.resident.frontdesk]
role = "agentroles.ccb_frontdesk"

[workflow.resident.planner]
role = "agentroles.ccb_planner"

[workflow.resident.orchestrator]
role = "agentroles.ccb_orchestrator"

[workflow.resident.task_detailer]
role = "agentroles.ccb_task_detailer"

[workflow.resident.ccb_round_reviewer]
role = "agentroles.ccb_round_reviewer"
provider = "claude"

[workflow.dynamic.coder]
role = "agentroles.coder"
max_instances = 1
legacy_aliases = ["worker"]

[workflow.dynamic.code_reviewer]
role = "agentroles.code_reviewer"
max_instances = 1
```

Required resident roles for the initial agentic-loop profile:

- `frontdesk`
- `planner`
- `orchestrator`
- `task_detailer`
- `ccb_round_reviewer`

Required dynamic profiles:

- `coder`
- `code_reviewer`

Optional extension roles may include `plan_reviewer`, `clarification_broker`,
recovery, monitor, domain-specific reviewer, and future specialist roles. They
must not weaken the required role checks.

## Defaulting And Normalization

Default resolution order for a role/profile field:

1. `workflow.resident.<slot>` or `workflow.dynamic.<profile>` explicit value.
2. `workflow.defaults.resident` or `workflow.defaults.dynamic`.
3. `workflow.defaults`.
4. Profile built-in default for `agentic_loop_v1`.
5. Validation error if the field is still required and absent.

Model normalization should be provider-scoped:

- preserve `raw_model` in validation/report payloads;
- normalize lower-case, trim whitespace, and convert spaces/underscores to
  hyphens;
- apply provider alias tables before generic rewrites;
- accept `gpt5.5` as an alias for `gpt-5.5` for Codex/OpenAI-family providers;
- compile model through the same provider model shortcut path used by v2
  `AgentSpec` / `LoopRoleProfileSpec`;
- fail if the provider has no model shortcut support or if `startup_args`
  already contain model flags.

Provider validation should use the provider registry as the source of known
providers. `provider_model_shortcuts.py` is only the source for model flag
compilation, not the complete provider list.

Profile name normalization:

- canonical dynamic implementation profile is `coder`;
- `worker` is allowed only as a migration alias on `coder`;
- generated runtime agent names may include `coder` or `code_reviewer` but
  should not create a resident `worker` target in v3;
- old task/topology records that ask for profile `worker` may resolve to
  `coder` only when the v3 profile explicitly declares `legacy_aliases =
  ["worker"]`.

## Effective Runtime Compilation

For `workflow.profile = "agentic_loop_v1"`, the compiler should produce these
effective runtime surfaces:

### Resident Agents

| Slot | Local ask target | Role | Default provider | Default placement |
| :--- | :--- | :--- | :--- | :--- |
| `frontdesk` | `frontdesk` | `agentroles.ccb_frontdesk` | `codex` | `ccb-user` |
| `task_detailer` | `task_detailer` | `agentroles.ccb_task_detailer` | `codex` | `ccb-user` |
| `planner` | `planner` | `agentroles.ccb_planner` | `codex` | `ccb-plan` |
| `orchestrator` | `orchestrator` | `agentroles.ccb_orchestrator` | `codex` | `ccb-plan` |
| `ccb_round_reviewer` | `ccb_round_reviewer` | `agentroles.ccb_round_reviewer` | `claude` | `ccb-plan` |

The local ask target is the logical slot name, not necessarily the RolePack
default agent name. This keeps current real-run command paths stable:
frontdesk asks target `frontdesk`, planner handoff targets `planner`, and
orchestrator activation targets `orchestrator`.

### Dynamic Profiles

| Profile | Role | Lifecycle | Default placement |
| :--- | :--- | :--- | :--- |
| `coder` | `agentroles.coder` | ephemeral/current round | `ccb-exec*` |
| `code_reviewer` | `agentroles.code_reviewer` | ephemeral/current round | `ccb-exec*` |

Dynamic profile compilation should produce the current `LoopCapacityConfig`
shape while retaining v3 metadata for validation and reporting. The generated
capacity names still use `workflow.runtime.name_template`.

### Generated Windows

V3 forbids user-authored `[windows]`, but ccbd may still need an effective
topology for startup and project view. The compiler may generate an internal
effective topology:

```text
ccb-user = frontdesk + task_detailer
ccb-plan = planner + orchestrator + ccb_round_reviewer
ccb-exec* = dynamic coder/code_reviewer agents as requested by loop capacity
```

This generated topology is runtime output, not user config. It should be
visible in `config validate --json` as `compiled_topology`, and in text output
as a summary, but it must not be written back into `.ccb/ccb.config`.

## Validation Output Contract

Text output should remain compact, for example:

```text
config_status: valid
config_version: 3
workflow_mode: agentic-loop
workflow_profile: agentic_loop_v1
entry_role: frontdesk
resident_roles: frontdesk, planner, orchestrator, task_detailer, ccb_round_reviewer
dynamic_profiles: coder, code_reviewer
compiled_resident_agents: frontdesk, task_detailer, planner, orchestrator, ccb_round_reviewer
effective_loop_capacity: enabled=true max_nodes=2 profiles=coder,code_reviewer
```

JSON output should be stable enough for B7 checks:

```json
{
  "config_status": "valid",
  "config_version": 3,
  "workflow": {
    "mode": "agentic-loop",
    "profile": "agentic_loop_v1",
    "entry_role": "frontdesk"
  },
  "resident_roles": [
    {
      "slot": "frontdesk",
      "target": "frontdesk",
      "role": "agentroles.ccb_frontdesk",
      "provider": "codex",
      "raw_model": "gpt5.5",
      "normalized_model": "gpt-5.5",
      "rolepack_installed": true
    }
  ],
  "dynamic_profiles": [
    {
      "profile": "coder",
      "role": "agentroles.coder",
      "provider": "codex",
      "max_instances": 1,
      "legacy_aliases": ["worker"],
      "rolepack_installed": true
    }
  ],
  "effective_loop_capacity": {
    "enabled": true,
    "max_nodes": 2,
    "name_template": "loop-{loop_id}-{profile}-{index}"
  },
  "compiled_topology": {
    "resident_windows": [
      {"name": "ccb-user", "agents": ["frontdesk", "task_detailer"]},
      {"name": "ccb-plan", "agents": ["planner", "orchestrator", "ccb_round_reviewer"]}
    ]
  },
  "warnings": []
}
```

Validation errors should include a stable `code`, a `path`, and a short
operator message. Example codes:

- `v3_static_layout_field_forbidden`
- `v3_required_resident_missing`
- `v3_required_dynamic_missing`
- `v3_rolepack_not_installed`
- `v3_provider_unknown`
- `v3_model_unsupported_for_provider`
- `v3_model_startup_args_conflict`
- `v3_worker_profile_not_canonical`
- `v3_capacity_exceeds_profiles`
- `v3_workspace_group_requires_worktree`
- `v3_reserved_name`

## Enhanced Control Panel Direction

The v3 workflow control file is easier than hand-written static windows, but
it is still too dense for many users to author correctly by editing TOML alone.
Add an enhanced control panel as a companion surface, not as a new authority.

Recommended product shape:

- API-first local control plane: `ccb config validate --json`,
  `ccb config effective --json`, migration preview, reload dry-run JSON, and
  eventually a guarded apply path;
- local Web control panel as the rich default surface for schema-driven forms,
  role matrices, provider/model selection, validation explanations, dry-run
  diff, and migration preview;
- terminal fallback through existing CLI commands and a possible compact TUI
  view for users who do not want a browser;
- later mobile/remote presentation may reuse the same JSON contracts, but must
  not define independent validation or mutation semantics.

Authority boundary:

- `.ccb/ccb.config` remains the desired-state source file.
- `ccb config validate` and reload dry-run remain the source of truth for
  correctness and runtime impact.
- The mounted daemon graph remains live runtime authority after reload.
- The panel may save a draft, show a generated TOML preview, write the config
  through an atomic patch path, and request validate/dry-run/apply.
- The panel must not directly mutate `.ccb/runtime`, provider sessions, tmux
  panes, queue state, or generated topology files.
- The panel must not show provider secrets. It may show env var names,
  provider profile names, and redacted availability state.

The panel should answer four questions only:

- what the config declares;
- whether it is valid;
- what reload will change;
- whether runtime has consumed the saved config.

Final panel information architecture:

| Section | Purpose |
| :--- | :--- |
| Overview | Show config authority, version, workflow profile, entry role, digest/state chips, readiness summary, compiled topology preview, and action gates. |
| Workflow Setup | Edit workflow mode/profile and entry role, while keeping first-slice values constrained to `agentic-loop` / `agentic_loop_v1` / `frontdesk`. |
| Roles And Capacity | Show required resident slots and required dynamic profiles in one locked matrix, including rolepack, lifecycle, workspace, provider/model inheritance, validation state, and capacity totals. |
| Providers And Models | Edit defaults and per-role overrides through side-panel inspection; show raw model, normalized model, unsupported provider/model errors, and override badges. |
| Runtime Policy | Edit dynamic capacity, name template, workspace mode/group, release policy, reuse, lifetime, and placement hints. |
| Migration | Convert v2 static config into a v3 draft, show field mapping and `manual_required` items; show this section only for v2 or ambiguous configs. |
| Review And Apply | Combine validation, save, reload dry-run, and apply into one gated flow with digest-aware state labels and impact summary. |

First viewport requirements:

- show `.ccb/ccb.config`, config version, workflow profile, and entry role as
  the authority header;
- show state chips for `Draft`, `Saved Config`, `Validation`, and
  `Runtime Reload`;
- show required readiness counts such as resident roles `5/5`, dynamic
  profiles `2/2`, rolepacks installed/missing, and provider/model errors;
- show a minimal compiled topology preview for `ccb-user`, `ccb-plan`, and
  `ccb-exec*`;
- show the primary action rail: validate draft, save config, reload dry-run,
  apply reload; disabled actions must explain the unmet precondition.

Do not put charts, live logs, runtime metrics, provider conversations, or
session views on the first screen. The surface is a config preparation workflow,
not a live operations console.

Role, provider, model, and capacity editing rules:

- required resident rows are non-removable: `frontdesk`, `planner`,
  `orchestrator`, `task_detailer`, and `ccb_round_reviewer`;
- required dynamic rows are non-removable: `coder` and `code_reviewer`;
- each row shows rolepack status, inherited provider/model, explicit override
  badge, lifecycle, workspace mode, and validation state;
- provider/model edits should prefer defaults first and role overrides second;
- raw and normalized model values must be visible together;
- capacity edits should use bounded controls and computed totals, especially
  `max_nodes <= sum(dynamic.max_instances)`;
- `worker` must not appear as a primary editable v3 profile; show it only as a
  migration alias on `coder`;
- advanced fields such as `startup_args`, `env`, `provider_profile`, and
  `workspace_group` should be collapsed by default and validated by path.

Review and apply state machine:

1. `Draft only`: changes exist only in panel state.
2. `Validated draft`: server-side validation passed for the draft digest.
3. `Saved to config`: atomic write to `.ccb/ccb.config` completed and a backup
   was created.
4. `Reload dry-run ready`: dry-run was computed against the saved config digest.
5. `Reloaded runtime`: mounted runtime consumed that config digest.

Errors should group into blocking errors, warnings, reload-impact blockers, and
migration/manual-required items. Every error needs a stable `code`, `path`,
short operator message, and field anchor. Save, dry-run, and apply state must
not rely on toast-only feedback.

Responsive layout:

- desktop: left section navigation, center editor/table, right sticky
  inspector for validation, dry-run impact, and action state;
- medium width: section navigation collapses to tabs and the inspector becomes
  a drawer;
- narrow/mobile: single-column sections, role rows become cards, action gates
  move to a sticky bottom bar, and TOML/diff/full validation views open
  full-screen;
- mobile should support review, validate, and light edits, not primary heavy
  authoring.

Minimum useful MVP:

- overview header with digest/state chips and action gates;
- locked `Roles And Capacity` matrix for required resident and dynamic entries;
- provider defaults editor plus per-role override drawer;
- runtime policy form for `max_nodes`, lifetime, reuse, release, workspace,
  and name template;
- validation panel with path-linked errors;
- read-only generated TOML/effective config preview;
- reload dry-run impact summary;
- apply confirmation with backup path and post-apply state;
- v2 migration preview only when current config is v2.

The first implementation should not start with a full Web application. It
should first make the CLI/control-plane JSON contracts stable enough for Web,
TUI, mobile, tests, and B7 evidence to share. Browser-side validation may help
with responsiveness, but server-side config validation remains authoritative.

Security and deployment constraints:

- serve the local Web panel on loopback only by default;
- use a project-local token or project socket authentication;
- default to read-only status until a user explicitly enters edit/apply mode;
- log config writes, validate results, and reload dry-run/apply summaries;
- never persist provider auth material, raw secrets, or provider session
  excerpts in panel state.

Avoid UI overreach in the first panel:

- no drag-and-drop workflow graph or pane layout editor;
- no live provider conversations, secrets, session excerpts, or raw auth
  material;
- no runtime mutation controls outside CCB command contracts;
- no independent browser-side authority or validation semantics;
- no v2/v3 mixed-field compatibility toggles;
- no generic model marketplace browsing before provider/model validation
  contracts are stable;
- no auto-save plus auto-reload behavior.

## Validation Rules

`ccb config validate` must reject v3 configs when:

- `[windows]`, `[agents]`, `default_agents`, `layout`, `cmd_enabled`, or
  `[loop.role_profiles]` are mixed into `version = 3`;
- a required resident role or dynamic profile is missing;
- a role id is not in `publisher.role` form;
- a required rolepack is not installed;
- provider names do not resolve through the provider registry;
- model shortcuts are unsupported for the provider;
- `model` conflicts with model flags in `startup_args`;
- `workspace_group` is configured outside `workspace_mode = "git-worktree"`;
- `workflow.runtime.max_nodes` exceeds dynamic profile capacity;
- users author `workflow.dynamic.worker` directly instead of canonical
  `workflow.dynamic.coder` plus `legacy_aliases = ["worker"]`;
- any generated or explicit role/profile name conflicts with reserved agent
  names.

`config validate` should also have a machine-readable shape, either through an
existing JSON output path or a new one, with fields for version, workflow
profile, resident role status, dynamic profile status, rolepack installation,
provider/model normalization, warnings, and effective loop capacity.

## Migration Direction

Add a dry-run-first migration command after the v3 parser and validator are
stable:

```bash
ccb config migrate --to 3 --dry-run
ccb config migrate --to 3 --write
```

Migration should map:

- v2 `[windows]` resident agents into `[workflow.resident.*]`;
- `[agents.<name>].role` into the corresponding workflow role slot;
- provider/model/provider_profile/startup_args/workspace settings into role
  tables;
- `[loop.capacity]` into `[workflow.runtime]`;
- `[loop.role_profiles.coder]` into `[workflow.dynamic.coder]`;
- legacy `[loop.role_profiles.worker] role = "agentroles.coder"` into
  `workflow.dynamic.coder` with `legacy_aliases = ["worker"]`.

Custom static layout, tool-only windows, repeated role instances, or ambiguous
agent-to-role mappings should produce `manual_required` in dry-run output and
must not be silently rewritten.

## Implementation Sequence

1. Add schema constants and tests that prove v2 behavior is unchanged.
2. Add v3 data models: workflow config, role spec, runtime policy, defaults,
   and provider/model normalization records.
3. Add loader dispatch by `version`, keeping v2 parser isolated.
4. Compile v3 into current runtime consumables: resident `AgentSpec` records
   and `LoopCapacityConfig`, while retaining the v3 workflow record for reports.
5. Extend `ccb config validate` text output and JSON-style payload for v3.
6. Add control-panel-ready JSON contracts for effective config, migration
   preview, reload dry-run summary, compiled topology, and validation errors.
7. Add negative validation tests for static/v3 field mixing, missing roles,
   missing rolepacks, provider/model conflicts, capacity mismatch, and
   `worker`/`coder` drift.
8. Add migration dry-run tests before any write mode.
9. Validate with `/home/bfly/yunwei/ccb_source/ccb_test` from
   `/home/bfly/yunwei/test_ccb2`, then run a real opened-project smoke only
   after source tests pass.

## Acceptance Criteria

- v2 compact, hybrid, and `[windows]` configs continue passing existing tests.
- v3 minimal valid config passes and reports all required roles/profiles.
- v3 missing `frontdesk`, `planner`, `orchestrator`, `task_detailer`,
  `ccb_round_reviewer`, `coder`, or `code_reviewer` fails before startup.
- v3 missing rolepack failure reproduces the real `agentroles.ccb_frontdesk`
  class of issue at validation time.
- v3 forbids user-authored `[windows]` and `[agents]` for dynamic workflow
  mode.
- provider/model conflicts are rejected without launching providers.
- migration dry-run is deterministic and never rewrites ambiguous static
  layouts.
- control-panel JSON contracts carry digest/timestamp, stable error
  `code`/`path`/message fields, rolepack/provider/model availability without
  secrets, and reload impact state before the UI is implemented.
- the first runtime smoke opens a visible test project under
  `/home/bfly/yunwei/test_ccb2` with inherited real provider environment only
  when that is the explicit test target.

## Implementation Slice Detail

Recommended source slices:

### Slice 1: Version Dispatch And Data Model

- Add explicit config schema constants such as `CONFIG_SCHEMA_V2 = 2` and
  `CONFIG_SCHEMA_V3 = 3`.
- Keep existing agent/runtime record `SCHEMA_VERSION = 2` untouched unless a
  separate runtime-record migration is intended.
- Add v3 model files under `agents/models_runtime/config_runtime/` or a
  sibling `workflow_config` module:
  - `WorkflowConfig`
  - `WorkflowDefaults`
  - `WorkflowRoleSpec`
  - `WorkflowRuntimePolicy`
  - `WorkflowValidationSummary`
- Return a discriminated load result that carries both the effective
  `ProjectConfig` and the source workflow config when version is 3.

### Slice 2: Parser And Fail-Fast Validator

- Add a v3 parser module instead of branching all v3 logic through the current
  v2 `validation.py`.
- Expand top-level key validation by schema version.
- Validate required role slots/profiles before building runtime specs.
- Validate rolepack installation before startup/reload.
- Validate provider/model using provider registry plus model shortcut helpers.
- Keep v2 parser tests untouched and add parallel v3 tests.

### Slice 3: Effective Runtime Compiler

- Compile resident roles into `AgentSpec` objects with generated window
  placement metadata.
- Compile dynamic profiles into `LoopCapacityConfig`.
- Preserve v3 source metadata for `config validate`, project view, diagnostics,
  and future migration tooling.
- Do not write generated `[windows]` back to disk.

### Slice 4: Config Validate Reporting

- Extend `ConfigValidationSummary` with version, workflow profile, resident
  status, dynamic status, rolepack/provider/model status, compiled topology,
  and warnings.
- Add JSON payload tests before relying on it in deployment-readiness B7.
- Keep text output concise and stable for operators.

### Slice 5: Control API And Panel Readiness

- Add machine-readable outputs that a Web/TUI/mobile panel can consume without
  reparsing human text:
  - config source summary;
  - effective workflow config;
  - validation errors and warnings;
  - compiled resident topology;
  - effective loop capacity;
  - v2-to-v3 migration preview;
  - reload dry-run summary.
- Include digest/timestamp fields that distinguish draft, saved config,
  validated config, dry-run input, and reloaded runtime.
- Include provider/model/rolepack availability payloads without exposing
  provider secrets.
- Keep write authority behind explicit config patch/write plus validate and
  reload dry-run gates.
- Define the atomic write, backup, and rollback contract before exposing
  apply in any UI surface.
- Prefer shared Python service functions over duplicating validation rules in
  the UI layer.
- Add tests that prove the JSON contract carries stable `code`, `path`, and
  operator message fields for common failure modes.

### Slice 6: Local Control Panel Prototype

- Build only after Slice 5 is stable.
- Start read-only: overview, role/capacity matrix, provider/model summary,
  validation report, and compiled topology preview.
- Add draft editing only after atomic write/backup and reload dry-run gates are
  covered by tests.
- Use the adopted section order: Overview, Workflow Setup, Roles And Capacity,
  Providers And Models, Runtime Policy, Migration, Review And Apply.
- Treat local Web as the preferred rich surface; keep CLI/TUI fallback
  complete enough for headless users.
- Bind to loopback and use project-local authentication.

### Slice 7: Migration Dry-Run

- Implement `ccb config migrate --to 3 --dry-run` before any write path.
- Emit source field mapping, target TOML preview, warnings, and
  `manual_required` items.
- Add `--write` only after dry-run coverage proves deterministic behavior.

### Slice 8: Runtime Smoke

- Use `/home/bfly/yunwei/ccb_source/ccb_test` from
  `/home/bfly/yunwei/test_ccb2`.
- Start with fake-provider/source tests.
- Only after parser and generated runtime behavior are source-clean, run a
  visible opened-project real-provider smoke with inherited system provider
  environment as an explicit test.

## Non-Goals

- Do not make provider replies authoritative over runtime or task state.
- Do not revive provider-side direct `.ccb/runtime` mutation.
- Do not replace v2 static layouts.
- Do not introduce a broad workflow DSL before the role/profile validation
  path is stable.
- Do not claim production/default enablement from config parser tests alone.

## Open Decisions

- Exact provider alias table contents for model names beyond the initial
  `gpt5.5` -> `gpt-5.5` Codex/OpenAI-family alias.
- Whether `config validate --json` should be added to the existing command
  surface or routed through an existing JSON rendering path.
- Whether optional `plan_reviewer` and `clarification_broker` should become
  recommended defaults after the required seven-role path is stable.
- Whether MVP allows raw TOML editing or only read-only TOML/effective-config
  preview plus form editing.
- Whether validation accepts an unsaved draft payload or must always read from
  disk.
- Exact reload dry-run impact taxonomy, such as add, remove, restart, park,
  unload, blocked, and no-op.
- Whether rolepack installation belongs in the panel or is only reported as
  missing with CLI guidance.
- Whether mobile access remains local-device only under loopback defaults or a
  later remote path is supported through the mobile gateway.
