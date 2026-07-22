# Installer Rollback Design

## Status

This document designs transactional local install and uninstall for Context Diet. It does not
approve write-enabled installation yet. Current CLI setup remains preview-only until these plans are
implemented with tests against temporary config fixtures.

## Codex Config Targets

Codex support targets the CLI first.

- User config: `~/.codex/config.toml`
- Project instructions: `AGENTS.md`
- Generated skill copy: `.agents/skills/context-diet/`
- Optional project-local metadata: `.codex/` only when explicitly selected

The installer may add a managed custom provider block pointing Codex at the local Context Diet
gateway. It must preserve existing model providers, comments where practical, and the user's direct
provider configuration.

## Claude Code Config Targets

Claude Code support targets the CLI first.

- User settings: `~/.claude/settings.json`
- Project settings: `.claude/settings.json` only when explicitly selected
- Project instructions: `CLAUDE.md`, which imports `AGENTS.md`
- Generated skill copy: `.claude/skills/context-diet/`

The installer may add or preview `ANTHROPIC_BASE_URL` routing to the local gateway. It must not
remove or rewrite unrelated Claude Code settings.

## MCP Config Targets

Exact retrieval is shared through the local MCP server.

- Codex MCP entry: `context-diet-retrieval`
- Claude Code MCP entry: `context-diet-retrieval`
- Command: `context-diet`
- Args: `mcp retrieval`
- Environment: no credentials

MCP config writes must be host-specific and reversible. The installer must never accept arbitrary
filesystem paths as MCP retrieval authority.

## Optional Claude Code Hook Handling

Claude Code hooks are optional. The only planned hook is a non-destructive `SessionStart` doctor or
status check.

Rules:

- Hooks are never mandatory.
- Hooks must be shown in preview before installation.
- Existing hooks must be preserved.
- A managed hook must have a stable marker so uninstall can remove only that hook.
- Hook output must not print credentials or raw context.

## Manifest Format

Each install writes a local manifest before mutating user config. The manifest is the source of
truth for rollback and uninstall.

Required fields:

- `manifest_version`
- `installation_id`
- `created_at`
- `context_diet_version`
- `hosts`
- `targets`
- `backups`
- `managed_fragments`
- `dry_run`
- `status`
- `last_completed_step`
- `rollback_status`

Each target records:

- target ID
- host
- human-readable path label
- canonical resolved path stored only in the private local manifest
- planned action
- pre-change hash
- post-change hash after write
- backup ID
- managed fragment marker

The public installation ID must not contain a raw repository path or user name.

## Backup Strategy

Before any mutation, the installer creates a restricted-permission backup of the exact target file.

Rules:

- Backup before write.
- Use atomic replacement for changed config files.
- Store backups under Context Diet local state, not inside the project repository.
- Record content hash and file mode when available.
- Never back up provider credentials into logs, reports or dashboard output.
- Do not delete backups until uninstall or rollback has completed and the user confirms cleanup.

## Dry-Run Behavior

Dry-run is the default for all setup commands until write-enabled install is explicitly implemented.

Dry-run must show:

- target files
- managed fragments
- backup plan
- rollback plan
- whether confirmation would be required
- route restoration instructions

Dry-run must not:

- write user config
- create backups
- start persistent services
- store credentials
- alter shell profiles

## Confirmation Prompts

Write-enabled install will require explicit confirmation after showing the plan.

The confirmation must state:

- which host configs will change
- which MCP entries will change
- whether the optional Claude Code hook is included
- where backups will be stored
- how rollback and uninstall work
- that credentials are not written

Broad confirmations such as "yes to everything forever" are not valid for destructive or
configuration-changing actions.

## Rollback Behavior

Rollback uses the manifest and backups only.

Rollback order is the reverse of install order:

1. Remove or restore MCP entries.
2. Remove optional Claude Code hooks.
3. Restore Claude Code settings.
4. Restore Codex settings.
5. Mark the manifest rolled back.

If a target changed after installation, rollback must stop for that target and report that user
edits were detected unless the user explicitly chooses a conflict-resolution path. Rollback must not
guess how to merge unrelated user edits.

## Interrupted Install Recovery

The manifest records `last_completed_step` after each successful atomic write.

On the next installer, rollback or uninstall command, Context Diet checks for incomplete manifests.
If one exists, it offers:

- resume from the next step
- rollback completed steps
- inspect the manifest

Interrupted recovery must not perform writes without confirmation.

## Uninstall Behavior

Uninstall reads the manifest and removes only Context Diet managed fragments.

Uninstall must:

- stop local Context Diet services when requested
- restore backed-up config when safe
- remove managed custom provider entries
- remove managed MCP entries
- remove managed optional Claude Code hooks
- leave unrelated user config untouched
- retain or delete local vault data only after explicit user confirmation

If the manifest is missing, uninstall may offer manual restore instructions but must not rewrite
unknown config.

## Credential Handling

The installer may reference credential environment variable names such as `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY`. It must never write actual credential values.

Credentials must not appear in:

- manifests
- backups metadata
- logs
- reports
- dashboard payloads
- test snapshots
- generated skill files

## What Must Never Be Written

Context Diet install and uninstall must never write:

- provider API keys
- bearer tokens
- cookies
- passwords
- raw prompts
- raw request bodies
- source code copied from user repositories
- secret-sensitive scanner spans
- arbitrary filesystem paths supplied by a model
- public IDs derived from raw repository paths
- hidden host settings outside the approved target list

## Implementation Gate

Write-enabled install remains blocked until these are present:

- temp-fixture tests for fresh install, existing install, cancelled install and partial failure
- rollback tests for every changed target
- user-edit conflict tests
- credential canary scanner over manifests, logs and backups metadata
- parity tests for Codex CLI and Claude Code CLI
