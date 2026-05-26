# Test And Release Gates

Date: 2026-05-25

## Documentation Gates

- Markdown links introduced by the README refresh resolve locally.
- `README.md` and `README_zh.md` remain content-parity peers.
- Asset references load from the repo and include useful alt text.
- The README does not require private paths, private API keys, or local-only
  project names to understand examples.

## Config Example Gates

- Compact layout examples align with
  [ccb-config-layout-contract.md](../../ccb-config-layout-contract.md).
- `version = 2` windows examples do not mix legacy `cmd` with `[windows]`.
- Agent-local `key`, `url`, and `model` examples follow the shortcut contract.
- Worktree examples state the git repository requirement.

## Media Gates

- New screenshots and animations are captured from current v7 behavior or are
  explicitly labeled as mockups.
- Public media hides API keys, local tokens, private prompts, and irrelevant
  machine-specific paths.
- Each animation has a static fallback or nearby prose summary for readers who
  cannot view animated media.
- File sizes are checked before committing to avoid making the README slow to
  load.

## Suggested Verification

These are candidate gates for the README implementation phase; exact commands
should be confirmed before use:

- Markdown link check.
- README image path check.
- `ccb config validate` against documented config snippets if the command is
  available in the installed release.
- A smoke start against a temporary project when producing real screenshots or
  videos.

