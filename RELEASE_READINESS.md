# Release Readiness

Review date: 2026-07-22

Decision: **NO-GO**

This review re-ran the current repository commands against `docs/ACCEPTANCE_CRITERIA.md`. The
release-candidate commit passes local fake-provider checks, but it is not release-ready because real
provider canaries have not been explicitly approved or run, Linux CI has not been reviewed for this
commit, Windows native and WSL are unsupported, IDE surfaces are not release-tested, and real
user-level install/uninstall has not been canaried outside temporary test directories.

## Version

- Package version: `0.0.0`
- Node engine: `>=24 <27`
- pnpm engine: `>=11 <12`
- Package manager: `pnpm@11.13.0`

## Commit And Tree

- Commit reviewed: `2cc1b1269cf06188e90e00204ba5f7fd6095c61b`
- Short commit: `2cc1b12`
- Tree before this report update: clean
- Tree after this report update: dirty until `RELEASE_READINESS.md` is committed

## Supported OS

- macOS: local fake-provider beta tested on Darwin 24.6.0 arm64 with Node.js 26 and pnpm 11.
- Linux: GitHub Actions is configured for Ubuntu with Node.js 24 and 26, but a current remote CI run
  was not reviewed in this pass.
- Windows native: unsupported for this release.
- WSL: unsupported for this release.

See `docs/OS_SUPPORT.md` for path, permission, temp directory, symlink and loopback notes.

## Supported Codex Surfaces

- Codex CLI: fake-provider tested through the OpenAI Responses-compatible route `/v1/responses`.
- Codex IDE: not release-tested and not supported for this release.
- Real Codex provider canary: not run; explicit consent was not provided.
- Real Codex user-level configuration migration: not canaried outside temporary test directories.

## Supported Claude Code Surfaces

- Claude Code CLI: fake-provider tested through the Anthropic Messages-compatible route
  `/v1/messages`.
- Claude Code IDE: not release-tested and not supported for this release.
- Real Claude Code provider canary: not run; explicit consent was not provided.
- Real Claude Code user-level settings migration: not canaried outside temporary test directories.

## Provider And Model Profiles

Provider routes proven with fake providers:

- OpenAI Responses-shaped route: `/v1/responses`
- Anthropic Messages-shaped route: `/v1/messages`

Model/profile evidence:

- Synthetic benchmark profile: `synthetic-safe-profile-v1`
- Renderer doctor profile: local synthetic doctor profile with `provider: unknown`
- pxpipe-compatible renderer reference: `teamchong/pxpipe@76f4fd2`

Release limitation:

- No real OpenAI model profile is approved for release.
- No real Anthropic model profile is approved for release.
- Unknown, expired or failed profiles disable imaging by policy.

## Commands Run

| Command                                                        | Result                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm install`                                                 | PASS. Already up to date. Non-fatal pnpm metadata fetch warning for update check.  |
| `pnpm check:environment`                                       | PASS. Darwin, Git, Node 26, pnpm 11, Codex CLI, Claude Code CLI and docs detected. |
| `pnpm format:check`                                            | PASS                                                                               |
| `pnpm lint`                                                    | PASS                                                                               |
| `pnpm typecheck`                                               | PASS                                                                               |
| `pnpm build`                                                   | PASS                                                                               |
| `pnpm test`                                                    | PASS with local loopback permission: 17 files, 279 tests.                          |
| `pnpm test:compatibility`                                      | PASS: 1 file, 3 tests.                                                             |
| `pnpm check:skills`                                            | PASS                                                                               |
| `CONTEXT_DIET_TEST_CANARIES='[]' pnpm scan:test-canaries -- .` | PASS                                                                               |
| `pnpm smoke:openai`                                            | PASS with local loopback permission.                                               |
| `pnpm smoke:anthropic`                                         | PASS with local loopback permission.                                               |
| `pnpm beta:fake`                                               | PASS with local loopback permission.                                               |

Sandbox note: the first sandboxed runs of `pnpm test`, `pnpm smoke:openai`, `pnpm smoke:anthropic`
and `pnpm beta:fake` failed with `listen EPERM: operation not permitted 127.0.0.1`. Rerunning with
local loopback permission passed. No real-provider traffic was sent.

## Test Totals

- Full Vitest suite: 17 files, 279 tests passed.
- Compatibility suite: 1 file, 3 tests passed.
- Fake beta: 13 beta steps passed for gateway, fake Codex client, fake Claude Code client,
  transform, MCP retrieval, benchmark, dashboard smoke, kill switch, direct fake routing,
  delete-session and temporary uninstall.
- OpenAI fake smoke: PASS.
- Anthropic fake smoke: PASS.
- Skill sync: PASS.
- Test-output canary scan: PASS.
- Real Codex provider canary: not run.
- Real Claude Code provider canary: not run.

## Acceptance Criteria Review

Pass or mostly pass locally:

- Repository foundation: Node/pnpm engines, strict TypeScript, scripts, concise agent files and
  local checks are present.
- Dual fake-provider transport: Codex-shaped and Claude-shaped routes pass fake smoke and beta.
- Normalised model: provider-neutral fixtures, ordering, metadata and pass-through tests exist.
- Exactness Firewall: Safe-mode protection and reason-code tests exist.
- Vault and retrieval: project/session isolation, expiry, deletion, integrity and MCP tests exist.
- Renderer: interface, pxpipe adapter, doctor, golden/failure tests and fallback behavior exist.
- OpenAI and Anthropic adapters: round-trip, transform, tool state, cache, image, unknown and
  streaming tests exist.
- Proxy: loopback default, allowlist, request limits, timeouts, kill switch, raw-body and credential
  tests exist.
- Metrics, dashboard, benchmark and skills have synthetic/local tests.
- Windows/WSL are clearly marked unsupported.

No-go against acceptance criteria:

- Linux checks were not reviewed from CI for this exact commit.
- Codex real-provider canary has not passed with explicit consent.
- Claude Code real-provider canary has not passed with explicit consent.
- Real user-level uninstall/rollback is not canaried outside temporary test directories.
- Codex IDE and Claude Code IDE are not release-tested.

## Security Findings

From `SECURITY_REVIEW.md`:

- Fixed high: upstream allowlist prefix matching could forward credentials to unintended origins.
- Fixed high: upstream redirects could be followed with credentials.
- Open medium: user-defined firewall regexes can be expensive if exposed to untrusted users.
- Open medium: MCP retrieval logs full opaque IDs; privacy hardening should hash or truncate them.
- Open low: dashboard serving boundary is not implemented in this package.
- Open low: installer/uninstaller have temp-directory coverage but no real user-config migration
  canary.

Current review notes:

- No critical or high security finding is known open in the current local fake-provider scope.
- Repository canary scan passed.
- Real provider credentials were not used.

## Known Limitations

- Current evidence is fake-provider and synthetic-data only.
- Real-provider canaries were not run.
- No production database is present.
- Install, uninstall and rollback have temp-directory evidence only.
- Dashboard is static/local-rendered in this package; no release-grade dashboard server boundary is
  proven.
- Model-profile approval is synthetic only.
- Benchmarks are synthetic and must not be marketed as real savings.
- Highly cached or code-heavy workloads may produce neutral or negative value.
- Codex IDE and Claude Code IDE are not release-tested.
- Windows native and WSL are unsupported for this release.

## Privacy Statement

Context Diet is designed as a local engine. In Safe mode, current instructions, code, diffs,
commands, exact values, paths, IDs, hashes, numbers and secret-sensitive values stay native.

Current local fake-provider evidence shows:

- Fake provider credentials are not logged in smoke or beta flows.
- Raw 4xx request-body persistence tests pass for both provider-shaped routes.
- The vault rejects secret-sensitive spans.
- Dashboard MVP exposes no raw-context API.
- Share-card and benchmark outputs use allowlists and synthetic labels.

Release caveat:

- This privacy statement is supported by synthetic/fake tests only. It is not yet backed by real
  provider canaries, Linux CI review for this commit, or third-party security review.

## Install, Uninstall And Rollback

Install:

- `context-diet setup codex` and `context-diet setup claude-code` dry-run by default.
- Writes require explicit `--confirm`.
- Tests use temporary configuration roots only.
- Provider credentials are never written.

Uninstall:

- `context-diet uninstall --confirm` removes only Context Diet-managed entries in tested temp roots.
- Manual direct-route restoration remains documented for Codex and Claude Code.

Rollback:

- `context-diet rollback --confirm` restores backups in tested temp roots.
- Interrupted install resume and rollback are tested against synthetic manifests in temp roots.

Release limitation:

- Real user-level host config install/uninstall/rollback has not been canaried.

## Benchmark Evidence

Evidence origin: `synthetic`.

Comparable benchmark result:

- Runs: 3
- Comparison: comparable
- Protected values imaged: 0 in all runs
- Output agreement method: task tests

Synthetic run details:

| Variant                           | Input tokens | Output tokens | Cached input tokens | Image tokens |  Latency | Retrieval calls |
| --------------------------------- | -----------: | ------------: | ------------------: | -----------: | -------: | --------------: |
| `uncompressed_control`            |       24,000 |         4,000 |                   0 |            0 | 1,800 ms |               0 |
| `safe_compressed`                 |       11,000 |         4,000 |               2,000 |          900 | 2,050 ms |               0 |
| `safe_compressed_exact_retrieval` |       12,000 |         4,000 |               2,500 |          900 | 2,250 ms |               2 |

This is not real-provider cost evidence and must remain labelled synthetic.

## Go Or No-Go Decision

**NO-GO for release.**

Reasons:

1. Real Codex and Claude Code provider canaries have not passed with explicit consent.
2. Linux CI has not been reviewed for this exact commit.
3. Windows native, WSL, Codex IDE and Claude Code IDE are unsupported for this release.
4. Real user-level install/uninstall/rollback has not been canaried outside temporary test
   directories.
5. Benchmark evidence is synthetic only.

Recommended next release blockers:

1. Review a clean Linux CI run for commit `2cc1b1269cf06188e90e00204ba5f7fd6095c61b`.
2. Run real-provider canaries only after explicit user consent using
   `docs/REAL_PROVIDER_CANARY_PLAN.md`.
3. Canary real user-level install/uninstall/rollback with safe fake credentials and reversible
   configuration.
