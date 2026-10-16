# Platform And IDE Support

Fixel Recall uses one loopback gateway and the official host configuration surfaces. The safety
engine is identical across operating systems and editors.

## Compatibility Matrix

| Surface                             | Integration                                                 | Current evidence                                                     |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| macOS Codex CLI                     | `~/.codex/config.toml`                                      | Release-tested                                                       |
| macOS Claude Code CLI               | `~/.claude/settings.json`                                   | Release-tested                                                       |
| Linux Codex CLI and Claude Code CLI | Same user configuration under `$HOME`                       | Validated in Ubuntu CI with official-host fake-provider smoke tests  |
| WSL 2 Codex CLI and Claude Code CLI | Linux installation inside WSL; gateway binds inside WSL     | Implemented; separate WSL canary required                            |
| Windows native Codex CLI            | `%USERPROFILE%\.codex\config.toml`                          | Validated in Windows CI with official-host fake-provider smoke tests |
| Windows native Claude Code CLI      | `%USERPROFILE%\.claude\settings.json`                       | Validated in Windows CI; local MCP uses `cmd /c npx`                 |
| Codex IDE in VS Code                | Shares Codex CLI `config.toml` and MCP configuration        | Same configuration path as Codex CLI                                 |
| Claude Code in VS Code              | Uses the installed Claude Code runtime and settings         | Same configuration path as Claude Code CLI                           |
| Codex IDE in Cursor                 | Uses the Codex IDE extension and shared Codex configuration | Supported configuration path                                         |
| Cursor native AI                    | No Fixel Recall route                                       | Unsupported: no verified local base-URL contract                     |

## Install And Check

Install with Node.js 24 or 26:

```bash
npx fixel-recall setup
npx fixel-recall platform doctor
npx fixel-recall start
```

The setup command remains a dry run until the user confirms it. It never writes credentials.

## Codex IDE

The Codex CLI and IDE extension share the user-level `config.toml`. Configure Fixel Recall once,
then restart the IDE extension so it reloads the provider and MCP entries. This applies to the Codex
extension running in VS Code or Cursor.

Official reference: <https://developers.openai.com/codex/config-basic>

## Claude Code IDE

Claude Code's VS Code integration runs through Claude Code and uses its settings. Fixel Recall
writes the local `ANTHROPIC_BASE_URL` into the managed `env` object and registers exact retrieval in
the Claude MCP configuration. Restart the Claude Code session after setup.

Official references:

- <https://docs.anthropic.com/en/docs/claude-code/ide-integrations>
- <https://docs.anthropic.com/en/docs/claude-code/llm-gateway>

## Windows Native

Run setup from PowerShell or Windows Terminal. Fixel Recall uses Node's home-directory and path
APIs, so it does not hard-code POSIX separators. For an ephemeral `npx` installation, MCP entries
use the officially documented Windows form `cmd /c npx`.

Claude Code additionally requires Git for Windows according to its official Windows setup.

## WSL 2

Install and run Fixel Recall inside the same WSL distribution as Codex or Claude Code. Use Linux
paths and do not mix a Windows-side gateway with a WSL-side client during the initial canary.
`127.0.0.1` remains the only default bind address.

## Cursor Boundary

Fixel Recall supports the Codex IDE extension when it runs in Cursor. It does not claim to intercept
Cursor's native Agent, Tab Completion, or other editor-owned model traffic. Cursor documents custom
API keys, but not a local provider base URL that satisfies Fixel Recall's route, authentication and
pass-through requirements.

Official reference: <https://docs.cursor.com/settings/api-keys>

## Release Gate

A platform is publicly supported only after all of these pass on that platform:

1. install, build and full tests
2. loopback fake-provider routes for OpenAI and Anthropic
3. streaming, cancellation and kill switch
4. setup, rollback and uninstall in a temporary home directory
5. MCP exact retrieval
6. no credential or raw-body persistence checks

The platform doctor reports `validation-required` for WSL and IDE surfaces until matching runtime
evidence exists. CLI validation evidence is recorded in `docs/CROSS_PLATFORM_VALIDATION.md`.
