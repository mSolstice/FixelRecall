# Release Readiness

Review date: 2026-07-22

Decision: **NO-GO**

The release-candidate tree passes the local automated fake-provider checks, but it is not
release-ready against the full acceptance criteria. The release gate still requires real Codex and
Claude Code provider canaries with explicit consent, reviewed Linux CI evidence, OS support
expansion beyond macOS, and a clean release-candidate commit.

## Version

- Package version: `0.0.0`
- Node engine: `>=24 <27`
- pnpm engine: `>=11 <12`
- Package manager: `pnpm@11.13.0`

## Commit

- Release-candidate commit: generated after this report is staged.
- Expected working tree after commit: clean.
- Final commit hash: report from `git rev-parse HEAD` after commit.

Do not cut a release if `git status --short` shows uncommitted changes after the release-candidate
commit.

## Supported Operating Systems

Current evidence:

- macOS: tested locally on Darwin 24.6.0 arm64 with Node.js 26 and pnpm 11.
- Linux: CI workflow is configured for Ubuntu with Node.js 24 and 26, but this review did not verify
  a current remote GitHub Actions run.
- Windows native: unsupported for this release.
- WSL: unsupported for this release.

See `docs/OS_SUPPORT.md` for the current OS support evidence and known path, permission, temp
directory, symlink and loopback differences.

## Supported Codex Surfaces

Current surface status:

- Codex CLI: fake-provider tested. Environment doctor detected `codex-cli 0.136.0-alpha.2`;
  `.agents/skills/context-diet/` exists; the fake OpenAI Responses-compatible route passes through
  `/v1/responses`.
- Codex IDE: not release-tested. This repository does not contain tests or official setup
  instructions proving Codex IDE support.

Not release-proven:

- Real Codex custom-provider canary was not run.
- Codex IDE surface was not tested and is not supported for this release.
- Real user-level Codex configuration write/rollback has temp-directory tests only.

## Supported Claude Code Surfaces

Current surface status:

- Claude Code CLI: fake-provider tested. Environment doctor detected `2.1.217`;
  `.claude/skills/context-diet/` exists; the fake Anthropic Messages-compatible route passes through
  `/v1/messages`.
- Claude Code IDE: not release-tested. This repository does not contain tests or official setup
  instructions proving Claude Code IDE support.

Not release-proven:

- Real Claude Code `ANTHROPIC_BASE_URL` canary was not run.
- Claude Code IDE surface was not tested and is not supported for this release.
- Real settings write/rollback has temp-directory tests only.

## Provider And Model Profiles

Provider routes currently proven:

- OpenAI Responses-shaped fake provider route: `/v1/responses`
- Anthropic Messages-shaped fake provider route: `/v1/messages`

Model/profile evidence:

- Synthetic benchmark profile: `synthetic-safe-profile-v1`
- Renderer doctor profile: local synthetic doctor profile with `provider: unknown`
- pxpipe-compatible renderer reference: `teamchong/pxpipe@76f4fd2`

Release limitation:

- No real OpenAI model profile is approved for release.
- No real Anthropic model profile is approved for release.
- Unknown, expired or failed profiles disable imaging by policy.

## Commands Run

| Command                                                        | Result                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm install`                                                 | PASS. Dependencies already up to date. Non-fatal pnpm update metadata warning appeared.    |
| `pnpm check:environment`                                       | PASS. macOS, Git, Node 26, pnpm 11, Codex CLI, Claude Code CLI and required docs detected. |
| `pnpm format:check`                                            | PASS                                                                                       |
| `pnpm lint`                                                    | PASS                                                                                       |
| `pnpm typecheck`                                               | PASS                                                                                       |
| `pnpm build`                                                   | PASS                                                                                       |
| `pnpm test`                                                    | PASS with loopback permission.                                                             |
| `pnpm test:compatibility`                                      | PASS                                                                                       |
| `pnpm check:skills`                                            | PASS                                                                                       |
| `CONTEXT_DIET_TEST_CANARIES='[]' pnpm scan:test-canaries -- .` | PASS                                                                                       |
| `pnpm canary:preflight`                                        | PASS with explicit safe placeholder environment; no provider traffic sent.                 |
| `pnpm smoke:openai`                                            | PASS                                                                                       |
| `pnpm smoke:anthropic`                                         | PASS                                                                                       |
| `pnpm beta:fake`                                               | PASS                                                                                       |
| `node packages/cli/dist/index.js status`                       | PASS                                                                                       |
| `node packages/cli/dist/index.js benchmark --json`             | PASS                                                                                       |
| `node packages/cli/dist/index.js renderer doctor`              | PASS; status `HEALTHY`.                                                                    |

## Test Totals

Current local test totals:

- Full Vitest suite: 17 files, 279 tests passed.
- Compatibility suite: 1 file, 3 tests passed.
- Fake beta: 13 recorded beta steps passed for gateway, clients, transform, MCP retrieval,
  benchmark, dashboard smoke, kill switch, direct fake routing, delete-session and temp uninstall.
- OpenAI fake smoke: PASS.
- Anthropic fake smoke: PASS.
- Skill sync check: PASS.
- Test-output canary scan: PASS.

## Acceptance Criteria Summary

Pass or mostly pass:

- Repository foundation scripts exist and pass locally after formatting fix.
- Node.js 24/26 and pnpm 11 are declared.
- TypeScript strict mode is in use.
- Dual fake-provider transport passes for Codex-shaped and Claude-shaped routes.
- Provider-neutral types, firewall, vault, retrieval, renderer interface, provider adapters, proxy,
  dashboard, benchmark and skills have passing tests.
- Generated skill drift check passes.
- Fake-provider beta passes.

No-go gaps:

- Working tree is dirty; HEAD is not a clean release candidate.
- Real Codex provider canary has not been run.
- Real Claude Code provider canary has not been run.
- README status and known limitations have been updated, but the release commit remains dirty.
- Transactional install, rollback and uninstall have temp-directory tests only; real user-level host
  configuration migration is not release-proven.
- Windows native and WSL are unsupported for this release.
- Linux is CI-configured but no current remote CI result was verified in this review run.
- Codex IDE and Claude Code IDE surfaces are not tested.

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

- No critical or high security finding is known open in the current test scope.
- No comprehensive external secret-scanning service was run; repository canary scanning and tests
  passed.
- Real provider credentials were not used.

## Known Limitations

- Current release candidate is fake-provider and synthetic-data only.
- Real-provider canary plan exists, but real canaries were not executed.
- No production database is present.
- Installer/uninstaller write, rollback and uninstall only under explicit confirmation and have
  temp-directory coverage; real user host configuration migration is not release-proven.
- Dashboard is static/local-rendered in this package; no release-grade dashboard server boundary is
  implemented.
- Model-profile approval is synthetic only.
- Benchmarks are synthetic and must not be marketed as real savings.
- Highly cached or code-heavy workloads may produce neutral or negative value.
- Direct CLI invocation is covered for status, benchmark JSON and renderer doctor.
- Codex CLI is fake-provider tested; Codex IDE is not release-tested.
- Claude Code CLI is fake-provider tested; Claude Code IDE is not release-tested.
- Windows native, WSL and IDE-host paths are untested and unsupported for this release.

## Privacy Statement

Context Diet is designed as a local engine. In Safe mode, current instructions, code, diffs,
commands, exact values, paths, IDs, hashes, numbers and secret-sensitive values stay native.

Current evidence shows:

- Fake provider credentials are not logged in smoke or beta flows.
- Raw 4xx request-body persistence tests pass for both provider-shaped routes.
- The vault rejects secret-sensitive spans.
- Dashboard MVP exposes no raw-context API.
- Share-card and benchmark outputs use allowlists and synthetic labels.

Release caveat:

- This privacy statement is supported by synthetic/fake tests only. It is not yet backed by real
  provider canaries or third-party security review.

## Install Steps

Current install path:

1. Install Node.js 24 LTS or Node.js 26.
2. Install pnpm 11.
3. Run `pnpm install`.
4. Run `pnpm build`.
5. Run `pnpm check:environment`.
6. Run `pnpm beta:fake`.
7. Preview Codex setup with `context-diet setup codex`.
8. Preview Claude Code setup with `context-diet setup claude-code`.
9. Apply only after explicit confirmation and after reviewing `docs/INSTALL_UNINSTALL_EVIDENCE.md`.

Do not write real provider credentials into the repository. Do not run real provider tests without
the consent process in `docs/REAL_PROVIDER_CANARY_PLAN.md`.

## Uninstall Steps

Current uninstall guidance:

1. Stop the local gateway.
2. Restore Codex direct routing by switching back to the previous provider and removing the
   `context_diet_local` custom provider entry.
3. Restore Claude Code direct routing by unsetting `ANTHROPIC_BASE_URL`.
4. Remove optional Claude Code SessionStart hooks if added.
5. Remove `context-diet-retrieval` MCP entries if exact retrieval should be disabled.
6. Use `context-diet uninstall --confirm` only after reviewing the manifest and target files.
7. Delete temporary local sessions through `context-diet delete-session --confirm` after confirming
   the target session.

Transactional uninstall is proven only against temporary test directories.

## Rollback Steps

If a canary, fake beta or local setup fails:

1. Trigger the gateway kill switch.
2. Stop the local gateway.
3. Restore direct provider routing for Codex and Claude Code.
4. Remove temporary MCP entries and optional hooks.
5. Delete temporary Context Diet session and vault data.
6. Keep only safe metadata evidence.
7. Do not retry real-provider traffic until explicit approval is renewed.

## Measured Benchmark Evidence

Benchmark command source: exported CLI command runner with `benchmark --json`.

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
2. Linux CI has not been reviewed for this release-candidate commit.
3. Windows native, WSL and IDE surfaces are unsupported for this release.
4. Real user-level install/uninstall has not been canaried outside temporary test directories.
5. Current benchmark evidence is synthetic only.

Recommended next release blockers:

1. Review a clean Linux CI run for this exact commit.
2. Add Windows native and WSL validation before claiming support, or keep both explicitly
   unsupported.
3. Run real-provider canaries only after explicit user consent using
   `docs/REAL_PROVIDER_CANARY_PLAN.md`.
