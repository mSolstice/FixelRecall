# macOS CLI Release Checklist

Review date: 2026-08-02

Release commit: `2df94b1`

Status: **Fixel Recall for macOS CLI**

Broad hosted/enterprise production deployment: **not included in this release**

## Supported Scope

- macOS CLI use only.
- Codex CLI through the local OpenAI Responses-compatible route.
- Claude Code CLI through the local Anthropic Messages-compatible route.
- Safe mode default.
- Local gateway on loopback.
- Local fake-provider development and validation.
- Local dashboard/static dashboard checks included in fake-provider validation.
- Local MCP exact retrieval path included in fake-provider validation.
- Skill validation for generated Codex and Claude Code skill copies.

## Not Included In This Release

- Codex IDE.
- Claude Code IDE.
- Windows native.
- WSL.
- Broad hosted or enterprise production deployment.
- Public hosted service.
- Production database.
- Real savings claims across private or broad workloads.
- Real model-profile approval beyond limited canary evidence.
- Third-party security-reviewed release.

## Evidence

- Latest commit: `2df94b1`.
- GitHub Actions: green according to user report for commit `2df94b1`.
- Local checks passed:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm test`
  - `pnpm test:compatibility`
  - `pnpm check:skills`
  - `FIXEL_RECALL_TEST_CANARIES='[]' pnpm scan:test-canaries -- .`
  - `pnpm smoke:openai`
  - `pnpm smoke:anthropic`
- Fake-provider validation: passed.
- Real route canaries: passed for OpenAI/Codex and Anthropic/Claude Code with explicit user consent.
- Generated toy-project real-provider benchmark canary: passed.
- Real user-level install, rollback and uninstall canary: passed on macOS CLI.

## Privacy And Safety Defaults

- Safe mode is default.
- Provider credentials are not stored by Fixel Recall setup.
- Authentication values must stay in user shell environment or normal secret storage.
- Raw request bodies must not be logged or persisted.
- Secret-sensitive content must not be rendered.
- Exact, current, action-critical, code, command, path, ID and secret-sensitive material stays
  protected by policy.
- Unknown or unsafe transformation shapes pass through unchanged.
- Benchmark evidence must remain clearly labelled when synthetic or canary-only.

## Dry-Run Setup

The installer is dry-run by default. Run this first:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp
```

Confirmed macOS CLI canary command used after dry-run review:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp --confirm --replace-existing-manifest
```

Credentials are not written by this command.

## Rollback Command

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js rollback --confirm
```

Rollback restores backed-up files recorded in the install manifest.

## Uninstall Command

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js uninstall --confirm
```

Uninstall removes Fixel Recall-managed entries and restores/removes managed files according to the
manifest.

## What Not To Claim Publicly

- Do not claim broad hosted or enterprise production deployment.
- Do not claim Codex IDE support.
- Do not claim Claude Code IDE support.
- Do not claim Windows native support.
- Do not claim WSL support.
- Do not claim proven real-world savings across private repositories.
- Do not claim approved real model profiles.
- Do not claim third-party security review.
- Do not claim hosted or multi-user deployment support.
- Do not publish packages or create a public release until the chosen release process is reviewed.
