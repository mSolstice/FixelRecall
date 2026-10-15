# Cross-Platform Validation

Date: 2026-10-15

This report separates executed evidence from configuration simulation. A generated configuration is
not equivalent to running the product on that operating system.

## Evidence Summary

| Platform       | Configuration generation               | Runtime gateway                                                    | Install and rollback               | IDE contract                                  | Release status             |
| -------------- | -------------------------------------- | ------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------- | -------------------------- |
| macOS          | Executed                               | Executed with loopback fake providers                              | Executed                           | Codex and Claude shared-config paths reviewed | Validated local scope      |
| Linux          | Simulated locally                      | Official Codex and Claude Code fake-host smoke added to Ubuntu CI  | Simulated; Ubuntu CI pending       | Same Codex/Claude config contracts            | CI execution required      |
| WSL 2          | Linux/WSL detection tested             | Not executed inside WSL                                            | Linux-compatible generation tested | Same config contracts inside WSL              | Manual WSL canary required |
| Windows native | Windows generation tested              | Official Codex and Claude Code fake-host smoke added to Windows CI | Transaction and rollback simulated | Shared config paths reviewed                  | CI execution required      |
| VS Code        | Host configuration reviewed            | Uses the matching Codex or Claude runtime                          | No separate credential writer      | Official shared-host integration              | Host OS gate applies       |
| Cursor         | Codex extension configuration reviewed | Codex extension route only                                         | Uses Codex config                  | Native Cursor AI is excluded                  | Host OS gate applies       |

## Actions Reviewed

- Setup remains dry-run first and requires confirmation before writes.
- Codex and Claude Code can be installed in one transaction and one manifest.
- Existing files are backed up before editing.
- Rollback restores original bytes.
- Uninstall restores only files recorded in the manifest.
- Provider credentials are referenced by environment-variable name and are not stored.
- Native Windows ephemeral MCP launchers use `cmd /c npx`.
- macOS/Linux/WSL use the ordinary Node or `npx` launcher.
- Gateway binding remains loopback-only by default.
- Dashboard, status, health, bypass and kill-switch routes expose no credentials or raw context.
- OpenAI and Anthropic fake-provider routes, streaming, cancellation and errors remain covered.
- The official Codex CLI and Claude Code CLI are launched against loopback fake-provider routes by
  `pnpm smoke:official-hosts`; the test uses isolated temporary host configuration and fake keys.
- Exact retrieval remains local and authority-scoped.

## Local Results

The following passed on macOS arm64 with Node.js 26 and pnpm 11:

- formatting
- lint
- strict TypeScript
- build
- 442 unit and integration tests
- compatibility tests
- skill synchronization
- npm tarball installation and CLI smoke test
- macOS, Linux and Windows configuration-generation tests
- byte-for-byte rollback tests for generated platform configurations
- official Codex CLI and Claude Code CLI loopback smoke on macOS

## Remaining Runtime Gates

1. Open a pull request and require green Ubuntu, macOS and Windows GitHub Actions jobs, including
   the `Official hosts` matrix.
2. Run setup, gateway, MCP retrieval, rollback and uninstall once inside WSL 2.
3. Run one fake-provider request from Codex IDE and Claude Code in VS Code on each claimed OS.
4. Run the Codex extension in Cursor; do not test or claim Cursor's native AI route.
5. Keep public support wording at `validation-required` until the matching evidence is recorded.

No real-provider traffic was sent during this validation.
