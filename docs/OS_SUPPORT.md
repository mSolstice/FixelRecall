# OS Support

## Status Summary

Fixel Recall now includes cross-platform configuration and test targets. Release support remains
evidence-based: implementation alone does not turn a platform into a public support claim.

| Platform       | Release status                        | Evidence                                                                                       |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| macOS          | Validated CLI scope                   | Local checks and official-host fake-provider smoke passed on Darwin arm64.                     |
| Linux          | Validated CLI scope                   | Ubuntu CI passed the full suite and official Codex/Claude Code fake-host smoke.                |
| Windows native | Validated CLI scope                   | Windows CI passed the full suite and official Codex/Claude Code fake-host smoke.               |
| WSL            | Implemented; separate canary required | Linux-compatible setup and WSL detection exist; a real WSL 2 release canary is still required. |

## macOS Tested Status

The local macOS review ran with:

- Darwin arm64
- Node.js 26
- pnpm 11
- local fake-provider loopback tests
- temporary-directory install, uninstall and rollback tests

This proves behavior on the tested macOS environment. It does not prove every macOS version, shell,
filesystem or IDE configuration.

## Linux CI Status

GitHub Actions passed Linux coverage on Ubuntu with Node.js 24 and Node.js 26, including the full
suite and official Codex CLI and Claude Code CLI fake-provider smoke tests.

The Linux CI evidence verifies:

- dependency installation
- TypeScript build
- linting and formatting
- full fake-provider tests
- skill sync
- local gateway loopback binding
- temporary-directory install, rollback and uninstall tests

## Windows Native Status

Windows native CLI support passed the full CI suite and official Codex CLI and Claude Code CLI
fake-provider smoke tests. Platform configuration and transaction tests use isolated temporary roots
and fake credentials.

Known limitations:

- executable bin behavior through npm/pnpm shims
- real user-home setup, rollback and uninstall outside isolated CI roots
- IDE extension workflows

## WSL Status

WSL setup is implemented, but it remains `validation-required` until the separate WSL 2 canary
passes.

WSL may behave like Linux for many Node.js APIs, but it still needs separate validation because host
configuration, Windows-mounted paths, file permissions, firewall rules and loopback behavior can
differ from both native Linux and native Windows.

## Path And Permission Differences

Current code avoids symlink-dependent installation and uses explicit generated skill copies. This is
important because symlink creation and traversal differ across macOS, Linux, Windows and WSL.

Known differences to verify before expanding support:

- path separators: `/` versus `\`
- drive letters and UNC paths on Windows
- case sensitivity differences
- file mode support for `0o600`
- atomic rename semantics across filesystems
- whether user config paths are regular files, missing files or directories

## Symlinks

Symlinks are not required for the current skill sync or local installer approach.

The canonical skill is copied into generated host-specific directories:

- `.agents/skills/fixel-recall/`
- `.claude/skills/fixel-recall/`

This avoids relying on symlink support for Windows, WSL or locked-down filesystems.

## Temp Directory Behavior

Tests and fake-provider evidence use the operating system temporary directory through Node.js temp
APIs. Install, uninstall and rollback integration tests inject a temporary config root and clean it
up after the test.

Current evidence proves temp-root behavior on macOS, Linux CI and Windows CI. WSL still needs its
own runtime evidence.

## Local Gateway Loopback Behavior

The local gateway and fake providers are designed to bind to loopback addresses such as `127.0.0.1`.
In the managed Codex sandbox, loopback tests require explicit local permission; without that
permission they fail with `listen EPERM: operation not permitted 127.0.0.1`.

This sandbox permission issue is not the same as real provider traffic. The passing local evidence
uses fake providers and loopback only.

The macOS, Linux and Windows native CLI evidence verifies:

- gateway binds only to loopback by default
- OpenAI Responses-shaped fake route passes
- Anthropic Messages-shaped fake route passes
- streaming fake responses pass without full buffering
- kill switch and clean shutdown work
- no authentication values or raw request bodies are logged

Executed evidence and exact remaining gates are recorded in `docs/CROSS_PLATFORM_VALIDATION.md`.
