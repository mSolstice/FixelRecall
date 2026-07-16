# Blueprint 2 Compatibility Bridge

## Purpose

This bridge records how the existing Prompt 0-10 implementation can continue through original
Prompts 11-29 without blocking the later Blueprint 2 extension. It is not a Blueprint 2 feature
implementation.

All future work remains simulation-only until explicitly approved otherwise. Do not use real OpenAI,
Anthropic, GitHub, telemetry, registry, marketplace or enterprise-service credentials.

## Repository Verification Through Prompt 10

The repository currently contains the expected Prompt 0-10 foundations:

| Area                   | Current evidence                                                                                                                                        | Status  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Repository foundation  | pnpm workspace, strict TypeScript, formatting, linting, Vitest, build, CI, package READMEs and fake `.env.example`                                      | Present |
| Transport feasibility  | Local fake gateway with health, OpenAI Responses-compatible and Anthropic Messages-compatible routes, streaming fixtures, smoke scripts and setup notes | Present |
| Provider-neutral model | Core normalised request, message, block, provider metadata, pass-through fragments and order preservation tests                                         | Present |
| Decision reasons       | Typed reason catalogue and `DecisionRecord` with CLI/dashboard explanations                                                                             | Present |
| Exactness Firewall     | Deterministic firewall package with protected spans, secret-sensitive spans, risk class and render eligibility                                          | Present |
| Policy engine          | Provider-neutral `evaluatePolicyDecision` with Safe/Balanced/Max/Bypass behavior and profitability gate                                                 | Present |
| Identity and scope     | Opaque project/session/block IDs, lifecycle helpers and cross-project separation tests                                                                  | Present |
| Local vault            | Filesystem JSON vault with atomic writes, restricted permissions, integrity, expiry, delete-session and corruption tests                                | Present |
| Exact retrieval        | Provider-neutral retrieval service and local MCP-compatible `get_exact_context` wrapper                                                                 | Present |

Known gap: original Prompts 11-29 are not implemented yet. This bridge only preserves extension
points so those prompts do not accidentally close off Blueprint 2 capabilities.

## Existing Interfaces Reused

The following existing public surfaces should be reused rather than replaced:

- `NormalizedRequest`, `NormalizedMessage`, `NormalizedBlock`, `ProviderMetadata` and
  `OriginalPassThroughFragment` in `packages/core` for provider-neutral request flow.
- `DecisionRecord`, `ReasonCode`, `PolicyMode`, `evaluatePolicyDecision` and policy input types in
  `packages/core` for policy, explanations, metrics and audit events.
- `RenderEligibility` in `packages/renderer` as the current renderer boundary placeholder.
- `SafeMetric` in `packages/metrics` for privacy-safe numeric reporting.
- `BenchmarkReadiness` in `packages/benchmark` for comparable-baseline discipline.
- `LocalContextVault` and scoped identity types in `packages/vault` for exact original storage.
- `RetrievalService` and `LocalRetrievalMcpServer` in `packages/retrieval-mcp` for exact retrieval.

## Bridge Interfaces Added

The following provider-neutral interfaces were added to `packages/core` because no equivalent
already existed and later prompts need these seams to avoid hard-coding local simulation sources:

| Interface                 | Needed by Blueprint 2 capability                                                                     | Why it is minimal                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ModelProfileSource`      | Signed model-profile registry, automatic model-change canaries, renderer doctor, compatibility audit | Reads a profile summary by ID only; no registry protocol or provider wire type.           |
| `PolicySource`            | Team policy distribution, policy presets, adaptive rollback                                          | Reads a policy summary by ID only; hierarchy and signatures remain later implementations. |
| `UsageHistorySource`      | Monthly savings projections, compatibility audit, adaptive compression                               | Reads a small usage summary; supports synthetic now and measured later.                   |
| `BenchmarkEvidenceStore`  | GitHub benchmark badges, leaderboard, compatibility verdicts                                         | Stores and retrieves evidence summaries without publishing or badge generation logic.     |
| `AuditEventSink`          | Tamper-evident enterprise audit, uninstall receipts, retrieval audit receipts                        | Appends content-free audit events only; no raw context or sink implementation.            |
| `CompatibilityEvaluator`  | Personal compatibility audit and explicit not-worth-using verdicts                                   | Evaluates a provider-neutral input into a verdict and reasons.                            |
| `SavingsProjectionEngine` | Weekly/monthly/annual projections and break-even analysis                                            | Produces labelled projections from usage and benchmark evidence.                          |
| `RendererHealthService`   | Dedicated renderer doctor, glyph profiles, profile quarantine                                        | Checks a profile and returns a health summary without depending on pxpipe.                |

The added supporting summaries are intentionally small:

- `EvidenceOrigin`
- `CompatibilityVerdict`
- `RendererHealthStatus`
- `ModelProfileSummary`
- `PolicyBundleSummary`
- `UsageHistorySummary`
- `BenchmarkEvidenceSummary`
- `AuditEvent`
- `CompatibilityInput`
- `CompatibilityReport`
- `SavingsProjectionInput`
- `SavingsProjection`
- `RendererHealthReport`

These are contracts only. They do not implement Blueprint 2 product behavior.

## Interfaces Deliberately Not Added

No additional interfaces were added for:

- GitHub badge publishing
- Public leaderboard networking
- Remote registry transport
- Team policy HTTP distribution
- Editor extension APIs
- Installation manifest storage
- Adaptive policy proposal execution
- Tamper-evident hash-chain storage

Those would duplicate future implementation details before original Prompts 11-29 establish the CLI,
dashboard, metrics, benchmark and renderer boundaries.

## Extension Points Prompts 11-29 Must Preserve

### 1. Personal Compatibility Audit

Preserve `CompatibilityEvaluator`, `ModelProfileSource`, `PolicySource`, `UsageHistorySource` and
`BenchmarkEvidenceStore`. The CLI and dashboard should consume verdicts from these interfaces, not
from provider adapters or hard-coded model names.

### 2. Explicit Not-Worth-Using Verdicts

Preserve `CompatibilityVerdict` values, especially `not_worth_using`, `audit_only` and
`unsupported`. Future scoring must be allowed to recommend no optimisation without treating that as
a failure.

### 3. Monthly Savings Projections

Preserve `SavingsProjectionEngine` and `UsageHistorySource`. Metrics work must keep measured,
estimated and synthetic values labelled separately and must not claim percentages without a valid
baseline.

### 4. One-Command Onboarding

Prompt 11-29 CLI/setup work should produce previewable actions and later feed an installation
manifest. It must not silently change real user-level Codex or Claude Code configuration.

### 5. Dedicated Renderer Doctor

Renderer work should expose health through `RendererHealthService`, not through pxpipe-specific
objects. Renderer failure must continue to return original content.

### 6. GitHub Benchmark Badges

Benchmark work should write `BenchmarkEvidenceSummary` records first. Badge generation can later
consume evidence summaries and must label synthetic outputs.

### 7. Local Compatibility Leaderboard

Leaderboard simulation should consume `BenchmarkEvidenceStore` records. Public publishing should
remain out of scope until explicitly approved.

### 8. Per-User Adaptive Compression

Adaptive work should consume usage, benchmark, audit and retrieval evidence. It must not override
the Exactness Firewall, secret rules, Safe-mode code/current protections or authorisation controls.

### 9. Signed Model-Profile Registry

Profile registry work should implement `ModelProfileSource`. Signature verification details should
stay inside the source implementation and surface only `signatureStatus` and profile status.

### 10. Automatic Model-Change Canaries

Canary work should mark profiles as `retest_required` or disabled through profile summaries and
evidence records. It must not run real provider canaries during simulation.

### 11. Multilingual Glyph Profiles

Glyph profile work should feed `RendererHealthService` and `ModelProfileSource`. Unsupported glyphs
must continue to fall back to native text.

### 12. Team Policy Distribution

Policy distribution should implement `PolicySource`. Lower-level policy must never weaken the
built-in safety floor or mandatory organisation policy.

### 13. Tamper-Evident Enterprise Audit

Enterprise audit work should implement `AuditEventSink` with content-free events. Raw prompts,
retrieved exact text, auth headers and secrets must remain forbidden.

### 14. Editor Extension

The editor extension should call local APIs and consume these provider-neutral summaries. It must
not duplicate policy, firewall, vault or retrieval logic.

### 15. Transactional Uninstall and Rollback

Installer/uninstaller work should preserve a future manifest boundary. It must restore only Context
Diet-managed changes and preserve unrelated user edits.

## Required Simulation Labels

Any generated report, projection, card, badge, leaderboard item or compatibility verdict derived
from synthetic data must carry an explicit synthetic/simulated label. The bridge types include
`EvidenceOrigin` and `labelledSynthetic` to keep that requirement visible in downstream code.

## Safety Invariants To Preserve

- OpenAI and Anthropic wire types stay out of core.
- Unknown provider shapes pass through unchanged.
- Secret-sensitive content is never rendered or persisted.
- Unauthorised retrieval returns no content.
- Current, exact, code, command and action-critical content stays native in Safe mode.
- Savings cannot override safety blocks.
- Future remote sources replace local simulators behind interfaces rather than rewriting core.

## Prompt 11 Readiness

Original Prompt 11 can proceed safely if it preserves the provider-neutral contracts listed above
and continues using fake providers and synthetic data only. The main deferred risk is that later
CLI, dashboard, renderer and benchmark implementations could bypass these interfaces for speed; code
review should reject that shortcut.
