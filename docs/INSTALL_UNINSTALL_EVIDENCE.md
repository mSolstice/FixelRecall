# Install And Uninstall Evidence

## Scope

This evidence covers the local configuration writer using temporary test directories only. It does
not touch real `~/.codex`, real `~/.claude`, real shell profiles, real MCP settings, or provider
credentials.

## Evidence Summary

| Claim                                               | Evidence                                                                                                                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install dry-run writes nothing                      | `packages/cli/src/index.test.ts` runs `setup codex --mcp` without `--confirm` against a temp root and verifies no manifest is created and the existing fake Codex config is unchanged. |
| Confirmed install writes expected fake config       | The same test runs `setup codex --mcp --confirm` and verifies the temp `.codex/config.toml` contains the Context Diet managed provider block and fake loopback route.                  |
| Manifest is created                                 | Confirmed install verifies `.context-diet/install-manifest.json` exists in the temp root and records `environment-variable-references-only`.                                           |
| Credentials are never written                       | Tests scan command output, fake Codex config, fake MCP config, fake Claude Code settings and manifest text for fake credential canaries such as `SECRET_VALUE`, `Bearer ` and `sk-`.   |
| Rollback restores previous config                   | A temp Codex config is installed, then `rollback --confirm` restores the exact previous file contents from the backup.                                                                 |
| Uninstall removes only Context Diet-managed entries | A temp Claude Code settings file with unknown user fields is installed, then `uninstall --confirm` removes `contextDietManaged` while preserving the unrelated user field.             |
| Interrupted install can be resumed                  | A synthetic interrupted manifest is written under a temp root, then `setup codex --resume --confirm` completes the managed Codex config write.                                         |
| Interrupted install can be rolled back              | A synthetic interrupted manifest with a backup is written under a temp root, then `rollback --confirm` restores the backed-up Codex config.                                            |
| Codex and Claude Code paths are both covered        | Codex tests cover custom provider and rollback. Claude Code tests cover `ANTHROPIC_BASE_URL` metadata, optional hook, MCP option and uninstall preservation.                           |

## Temp-Only Test Roots

All integration tests create roots with `mkdtemp(join(tmpdir(), ...))` and remove them in `finally`
blocks. The CLI accepts the injected `configRoot` test option, so test writes are scoped to those
temporary directories.

Representative fake paths:

- `<tmp>/context-diet-cli-install-*/.codex/config.toml`
- `<tmp>/context-diet-cli-claude-*/.claude/settings.json`
- `<tmp>/context-diet-cli-install-*/.context-diet/mcp.json`
- `<tmp>/context-diet-cli-install-*/.context-diet/install-manifest.json`

## Fake Config Written

Codex confirmed install writes only a managed block with:

- local loopback gateway base URL
- `context_diet_local` provider name
- `OPENAI_API_KEY` as an environment variable reference, not a value

Claude Code confirmed install writes only a managed `contextDietManaged` object with:

- local loopback gateway base URL
- `ANTHROPIC_API_KEY environment variable` as a reference, not a value
- optional non-destructive SessionStart status hook when requested

MCP confirmed install writes a local `context-diet-retrieval` entry with:

- command `context-diet`
- args `mcp retrieval`
- empty `env`

## Commands Run

The evidence was checked with:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm test:compatibility
pnpm check:skills
```

The full test suite uses local fake-provider loopback servers. In the managed sandbox this requires
local loopback permission; it does not use real provider credentials or real provider traffic.

## Remaining Limits

This evidence proves local temp-directory behavior. It does not prove real user config migration
across every Codex or Claude Code version, and it does not prove IDE surfaces. Real-provider
canaries still require explicit consent and the separate canary plan.
