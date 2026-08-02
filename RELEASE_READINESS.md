# Release Readiness

Review date: 2026-08-02

Decision: **NO-GO**

This is a **fake-provider release candidate only**. The current repository passes local
fake-provider checks, local skill validation, limited real-provider route canaries and a generated
toy-project real-provider benchmark canary, but production go-live remains **NO-GO** because Windows
native and WSL are unsupported, IDE surfaces are not release-tested, Linux CI still needs review for
the final commit, and real user-level install/uninstall has not been canaried outside temporary test
directories.

## Version

- Package version: `0.0.0`
- Node engine: `>=24 <27`
- pnpm engine: `>=11 <12`
- Package manager: `pnpm@11.13.0`

## Commit And Tree

- Commit reviewed: `55fb258a41e6c8c62129d72a0e95c6f399771aad`
- Short commit: `55fb258`
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
- Real Codex provider canary: PASS with explicit user consent on 2026-08-02.
- Real Codex user-level configuration migration: not canaried outside temporary test directories.

## Supported Claude Code Surfaces

- Claude Code CLI: fake-provider tested through the Anthropic Messages-compatible route
  `/v1/messages`.
- Claude Code IDE: not release-tested and not supported for this release.
- Real Claude Code provider canary: PASS with explicit user consent on 2026-08-02.
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

- Full Vitest suite: 17 files, 291 tests passed.
- Compatibility suite: 1 file, 3 tests passed.
- Fake beta: 13 beta steps passed for gateway, fake Codex client, fake Claude Code client,
  transform, MCP retrieval, benchmark, dashboard smoke, kill switch, direct fake routing,
  delete-session and temporary uninstall.
- OpenAI fake smoke: PASS.
- Anthropic fake smoke: PASS.
- Local fake-provider skill validation: READY.
- Skill sync: PASS.
- Test-output canary scan: PASS.
- Real Codex provider canary: PASS. Safe-mode synthetic prompt returned the expected sentence
  through `/v1/responses`.
- Real Claude Code provider canary: PASS. Safe-mode synthetic prompt returned the expected sentence
  through `/v1/messages`.
- Real-provider benchmark canary: PASS for the generated toy project. OpenAI JSON benchmark passed
  all three variants; Anthropic JSON retry passed `safe_compressed` and
  `safe_compressed_exact_retrieval`; Anthropic single-variant retry passed `uncompressed_control`.
  All accepted variants had valid JSON replacement output and deterministic `node --test` success.

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
- Real-provider canaries are limited canary evidence only, not broad production benchmark evidence.
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
- Real provider credentials were used only by the user's local terminal environment for the
  explicitly approved canaries. Credentials were not committed, printed by repository tooling or
  stored in evidence.

## Known Limitations

- Current evidence is fake-provider, synthetic-data and limited real-provider canary evidence only.
- This is a local fake-provider release candidate, not a production release.
- Real-provider canaries passed for route checks and one generated toy-project benchmark canary, but
  they do not prove production savings or broad model compatibility.
- The real-provider benchmark canary used generated public-safe toy code only. It is not a private
  workload, broad workload, long-session or production benchmark.
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

- This privacy statement is supported by synthetic/fake tests and limited real-provider canaries. It
  is not yet backed by Linux CI review for this final commit, real user-level install/uninstall
  canary evidence, broad real workload evidence or third-party security review.

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

Evidence origin: `synthetic` for the comparable benchmark table below.

Real-provider benchmark canary: PASS for the generated toy project.

Real-provider benchmark canary evidence:

- Date: 2026-08-02.
- Scope: generated toy project in `/private/tmp/context-diet-real-benchmark-canary-demo`.
- Provider routes: OpenAI `/v1/responses` and Anthropic `/v1/messages`.
- Route result: all six benchmark requests returned provider status `200`.
- Gateway safety result: gateway stayed Safe mode, `rawBodiesPersisted=false` and
  `authValuesRetained=false`.
- Variants attempted for each provider: `uncompressed_control`, `safe_compressed` and
  `safe_compressed_exact_retrieval`.
- Initial deterministic result: failed. The returned patches were not strict applyable unified
  diffs, so the generated demo tests could not be used to prove task success.
- JSON-output retry: OpenAI `/v1/responses` passed all three variants with valid JSON replacement
  output and deterministic `node --test` success. Anthropic `/v1/messages` returned provider status
  `200` for all three variants, but all three initially failed strict JSON validation because
  responses contained markdown fences and surrounding non-JSON formatting.
- Anthropic-only JSON retry: Anthropic `safe_compressed` and `safe_compressed_exact_retrieval`
  passed strict JSON validation and deterministic `node --test`. Anthropic `uncompressed_control`
  returned provider status `200` but failed strict JSON validation because the response still used
  markdown fences.
- Anthropic single-variant JSON retry after safe fenced-block extraction: Anthropic
  `uncompressed_control` returned provider status `200`, passed JSON replacement validation and
  passed deterministic `node --test`.
- JSON-output safety result: gateway stayed Safe mode, `rawBodiesPersisted=false` and
  `authValuesRetained=false`.
- Conclusion: this is useful real-provider benchmark canary evidence for one generated toy project,
  but it must not be used to claim production savings or broad production quality.

Real-provider route canary evidence:

- OpenAI/Codex canary: PASS on 2026-08-02 through `/v1/responses` in Safe mode. The synthetic prompt
  returned `Context Diet real-provider canary passed.` Earlier failed attempts were caused by
  invalid or stale OpenAI credential/model setup before the successful run.
- Anthropic/Claude Code canary: PASS on 2026-08-02 through `/v1/messages` in Safe mode with
  `claude-haiku-4-5-20251001`. The synthetic prompt returned
  `Context Diet real-provider canary passed.` One earlier rejected request used a stale model alias.
- This is real-provider canary evidence only. It is not a production benchmark and must not be used
  to claim real-world savings.

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

**NO-GO for production go-live.**

Local fake-provider skill validation is ready, and the generated toy-project real-provider benchmark
canary has passed. This repository remains a fake-provider release candidate until the remaining
release blockers pass.

Reasons:

1. Real-provider route and generated toy-project benchmark canary evidence is not broad production
   benchmark evidence.
2. Linux CI has not been reviewed for the final commit.
3. Windows native, WSL, Codex IDE and Claude Code IDE are unsupported for this release.
4. Real user-level install/uninstall/rollback has not been canaried outside temporary test
   directories.
5. Broad benchmark evidence remains synthetic only.

Recommended next release blockers:

1. Review a clean Linux CI run for the final release-candidate commit.
2. Canary real user-level install/uninstall/rollback with safe fake credentials and reversible
   configuration.
3. Decide whether this release is scoped to macOS CLI only, or add tested support for Linux, WSL,
   Windows native and IDE surfaces before claiming them.
