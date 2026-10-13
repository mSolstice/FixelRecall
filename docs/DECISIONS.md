# Fixel Recall Architecture Decisions

This file records choices that agents must not casually reverse.

## ADR-001: Support Codex and Claude Code from day one

**Status:** Accepted

**Decision:** Both hosts are first-class MVP targets.

**Reason:** Retrofitting a second provider after the core is coupled to the first usually creates
duplicated logic and fragile request transformations.

**Consequence:** Every transport feature needs fixtures and tests for both.

## ADR-002: One provider-neutral core

**Status:** Accepted

**Decision:** Policy, scanning, exactness and vault logic operate on normalised internal types.

**Consequence:** OpenAI and Anthropic wire types stay inside their adapters.

## ADR-003: Blueprint remains a repository document

**Status:** Accepted

**Decision:** Keep the full blueprint under `docs/`. Do not paste it into `AGENTS.md` or
`CLAUDE.md`.

**Reason:** Persistent instruction files should stay concise. Large reference material should be
loaded only when needed.

## ADR-004: CLAUDE.md imports AGENTS.md

**Status:** Accepted

**Decision:** Shared project rules live in `AGENTS.md`. `CLAUDE.md` imports them and adds
Claude-specific rules.

**Reason:** This prevents duplicated instructions from drifting.

## ADR-005: Canonical skill plus generated copies

**Status:** Accepted

**Decision:** Edit `skill-source/fixel-recall/`. Generate `.agents/skills/fixel-recall/` and
`.claude/skills/fixel-recall/`.

**Consequence:** CI must check for drift.

## ADR-006: Skill and gateway are separate

**Status:** Accepted

**Decision:** The skill operates and explains the local service. The gateway transforms provider
requests.

**Reason:** A skill cannot reliably rewrite the request already invoking it.

## ADR-007: Proxy and gateway feasibility comes before compression

**Status:** Accepted

**Decision:** Prove Codex and Claude Code transport paths using fake upstreams before building the
renderer.

**Reason:** Transport compatibility is the largest product-level technical risk.

## ADR-008: Safe mode is default

**Status:** Accepted

**Decision:** Keep current, exact, secret-sensitive and unknown-risk material as native text.

## ADR-009: Unknown means pass through

**Status:** Accepted

**Decision:** Unknown endpoints, fields or content block types remain unchanged.

## ADR-010: Transformation failure sends original content

**Status:** Accepted

**Decision:** Parser, scanner, renderer, profile or vault failure cannot silently remove request
content.

## ADR-011: Retrieval authorisation failure returns nothing

**Status:** Accepted

**Decision:** No broad fallback reads are allowed for an invalid retrieval request.

## ADR-012: Secrets are never rendered or persisted

**Status:** Accepted

**Decision:** Secret-sensitive spans are protected before rendering and vault storage.

## ADR-013: Renderer is an adapter

**Status:** Accepted

**Decision:** pxpipe may be reused, forked or replaced without changing the policy engine.

## ADR-014: Local vault by default

**Status:** Accepted

**Decision:** Raw recoverable blocks remain on the user's machine in MVP.

## ADR-015: MCP for common exact retrieval

**Status:** Accepted

**Decision:** Expose exact retrieval through a common MCP server usable by both hosts, with an
internal API underneath.

## ADR-016: Honest savings only

**Status:** Accepted

**Decision:** No comparable baseline means no percentage claim.

## ADR-017: Node.js 24 LTS and pnpm 11

**Status:** Superseded by ADR-019 for the Node.js version range; accepted for pnpm 11.

**Decision:** Use Node.js 24 LTS and pnpm 11, pinning the package manager in `package.json`.

**Review condition:** Revisit only for a documented compatibility problem.

## ADR-019: Allow Node.js 26 for local development

**Status:** Accepted

**Decision:** Support Node.js 24 LTS and Node.js 26 for the initial build. Keep pnpm 11 pinned
through `package.json`.

**Reason:** The local development environment already provides Node.js 26, and the current Prompt 1
environment checker and early project scripts use stable Node APIs that are compatible with both
Node 24 and Node 26.

**Alternatives considered:** Require switching the machine to Node.js 24 before continuing. This
remains a valid conservative path, but it is not required for the current local build.

**Consequences:** CI and compatibility checks should exercise the declared supported Node range
before release. If Node 26 exposes dependency or runtime incompatibilities later, record the finding
and narrow support deliberately.

## ADR-018: No real credentials until fake tests pass

**Status:** Accepted

**Decision:** Initial integration uses fake upstreams and synthetic fixtures.

## ADR-020: Filesystem JSON vault before SQLite

**Status:** Accepted

**Decision:** Implement the initial local context vault as restricted-permission JSON files under a
fixed vault root, with atomic temp-file writes and integrity hashes. Do not add SQLite yet.

**Reason:** The current requirement is a local, testable vault with project/session isolation,
expiry, delete-session, size limits and corruption detection. A small filesystem store satisfies
that without adding a production database dependency, native install risk or migration surface
before retrieval/query requirements are known.

**Alternatives considered:** SQLite would provide transactions and indexing, but it would require a
new dependency and schema migration decisions before the MVP has demonstrated its exact storage and
retrieval access patterns.

**Consequences:** The store is simple and auditable for the MVP. If future retrieval needs require
querying across many records, add SQLite behind the same vault interface and record a new migration
decision.

## ADR-021: Explicit subscription routes and fail-closed canary admission

**Status:** Accepted for local fake-provider validation; real subscription support remains unproven.

**Decision:** Add opt-in Codex subscription routes under `/backend-api/codex`, with a separately
allowlisted ChatGPT backend and account-header forwarding. Never infer the upstream from token
contents or silently fall back to API billing. Keep provider route logic in the OpenAI adapter.

**Reason:** Forwarding Authorization alone does not implement the documented subscription gateway
contract. The installed CLI's local fake test also showed substantial added context and no output
cap, so a short synthetic prompt does not guarantee the approved budget.

**Decision:** An optional canary gate rejects requests without a supplied output cap and reviewed,
unexpired cost evidence bound to the exact request bytes. Reserve one generation attempt before
forwarding, with no refund after failures. This admission rule does not transform content or weaken
normal Safe-mode policy. It applies to both provider-shaped requests and rejects unknown evidence.

**Consequences:** No automatic Astra profile approval, new paid test, user config write, or release
support claim. CLI canary preparation intentionally remains blocked without verified accounting and
upstream output-limit support. Budgets are process-local; multiple starts are separate reservations.
No production dependency was added. See `docs/ASTRA_CANARY_READINESS.md`.

## ADR template

When adding a decision, use:

```md
## ADR-NNN: Title

**Status:** Proposed | Accepted | Superseded

**Decision:** What we chose.

**Reason:** Why.

**Alternatives considered:** Other options.

**Consequences:** What becomes easier or harder.
```
