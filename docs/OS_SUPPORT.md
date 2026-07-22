# OS Support

## Status Summary

Context Diet is currently a local fake-provider beta. OS support is based on repository evidence
available in this working tree, not on intended future support.

| Platform       | Release status                                     | Evidence                                                                                                          |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| macOS          | Supported for local fake-provider beta             | Local checks have run on Darwin arm64 with Node.js 26 and pnpm 11.                                                |
| Linux          | CI-targeted, not locally reverified in this review | GitHub Actions targets Ubuntu with Node.js 24 and 26, but remote CI results were not reviewed in this local pass. |
| Windows native | Unsupported for this release                       | No native Windows install, path, permission, gateway or CLI evidence is present.                                  |
| WSL            | Unsupported for this release                       | WSL is not tested separately from native Linux and has no install or gateway evidence in this release review.     |

## macOS Tested Status

macOS is the only locally exercised operating system in the current evidence set. The local review
ran with:

- Darwin arm64
- Node.js 26
- pnpm 11
- local fake-provider loopback tests
- temporary-directory install, uninstall and rollback tests

This proves local beta behavior on the tested macOS environment only. It does not prove every macOS
version, shell, filesystem or host-app configuration.

## Linux CI Status

The repository declares Linux coverage through GitHub Actions on Ubuntu with Node.js 24 and
Node.js 26. That is CI-targeted support, not a completed release claim from this local review.

Before release, a clean Linux CI run should verify:

- dependency installation
- TypeScript build
- linting and formatting
- full fake-provider tests
- skill sync
- local gateway loopback binding
- temporary-directory install, rollback and uninstall tests

## Windows Native Status

Windows native is unsupported for this release.

Known unproven areas:

- path parsing and drive-letter behavior
- file permissions and backup mode handling
- executable bin behavior through npm/pnpm shims
- local gateway loopback binding
- temp directory cleanup
- Codex and Claude Code config locations
- shell environment handling for provider base URLs

## WSL Status

WSL is unsupported for this release.

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

- `.agents/skills/context-diet/`
- `.claude/skills/context-diet/`

This avoids relying on symlink support for Windows, WSL or locked-down filesystems.

## Temp Directory Behavior

Tests and fake-provider evidence use the operating system temporary directory through Node.js temp
APIs. Install, uninstall and rollback integration tests inject a temporary config root and clean it
up after the test.

Current evidence proves temp-root behavior on macOS. Linux, Windows native and WSL temp cleanup
still need their own release evidence.

## Local Gateway Loopback Behavior

The local gateway and fake providers are designed to bind to loopback addresses such as `127.0.0.1`.
In the managed Codex sandbox, loopback tests require explicit local permission; without that
permission they fail with `listen EPERM: operation not permitted 127.0.0.1`.

This sandbox permission issue is not the same as real provider traffic. The passing local evidence
uses fake providers and loopback only.

Before broad OS support is claimed, each OS must verify:

- gateway binds only to loopback by default
- OpenAI Responses-shaped fake route passes
- Anthropic Messages-shaped fake route passes
- streaming fake responses pass without full buffering
- kill switch and clean shutdown work
- no authentication values or raw request bodies are logged
