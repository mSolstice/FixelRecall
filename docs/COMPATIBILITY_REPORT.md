# Codex and Claude Code Compatibility Report

Review date: 2026-07-21

Scope:

- Codex CLI path: OpenAI Responses-compatible fake-provider route, `.agents/skills/context-diet`,
  `AGENTS.md`
- Codex IDE path: not release-tested; no support claim is made in this report
- Claude Code CLI path: Anthropic Messages-compatible fake-provider route,
  `.claude/skills/context-diet`, `CLAUDE.md`
- Claude Code IDE path: not release-tested; no support claim is made in this report
- Shared engine: provider-neutral core, local gateway, MCP retrieval, CLI, dashboard, benchmark and
  generated skill synchronisation

## Compatibility Matrix

| Area                        | Codex                                                                                               | Claude Code                                                                         | Parity status                         | Evidence                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Host surface                | Codex CLI is fake-provider tested; Codex IDE is not release-tested                                  | Claude Code CLI is fake-provider tested; Claude Code IDE is not release-tested      | Equivalent release scope              | README and `RELEASE_READINESS.md`                                                                                  |
| Installation                | Preview-only local setup generator for Codex custom provider; no credential writes                  | Preview-only setup generator for `ANTHROPIC_BASE_URL`; optional hook preview only   | Equivalent                            | `packages/cli/src/index.ts`, `packages/cli/src/index.test.ts`                                                      |
| Persistent instructions     | `AGENTS.md` is the shared project rule source                                                       | `CLAUDE.md` imports `AGENTS.md` and adds Claude-specific constraints                | Equivalent                            | `AGENTS.md`, `CLAUDE.md`                                                                                           |
| Skill discovery             | Generated skill at `.agents/skills/context-diet/`                                                   | Generated skill at `.claude/skills/context-diet/`                                   | Equivalent                            | `scripts/check-skill-sync.ts`, `tests/skills/sync-skills.test.ts`                                                  |
| Gateway route               | `/v1/responses`                                                                                     | `/v1/messages`                                                                      | Equivalent host-specific routes       | `packages/proxy/src/index.ts`, `scripts/smoke/openai-fake-gateway.mjs`, `scripts/smoke/anthropic-fake-gateway.mjs` |
| Request parsing             | OpenAI Responses parser in `packages/providers-openai`                                              | Anthropic Messages parser in `packages/providers-anthropic`                         | Equivalent                            | Provider adapter tests plus `tests/compatibility/platforms.test.ts`                                                |
| Tool state                  | Preserves `function_call` and `function_call_output`; blocks transforms on active/malformed state   | Preserves `tool_use` and `tool_result`; blocks transforms on active/malformed state | Equivalent                            | `packages/providers-openai/src/index.test.ts`, `packages/providers-anthropic/src/index.test.ts`                    |
| Image blocks                | Preserves `input_image` / image-shaped content                                                      | Preserves Anthropic `image` content blocks                                          | Equivalent                            | Provider image tests                                                                                               |
| Cache fields                | Preserves continuity fields such as `previous_response_id`, `prompt_cache_key`, item cache metadata | Preserves metadata/context fields and `cache_control`                               | Equivalent provider-specific handling | Provider cache tests                                                                                               |
| Streaming                   | Fake gateway streams OpenAI-compatible SSE                                                          | Fake gateway streams Anthropic-compatible SSE in event order                        | Equivalent                            | Smoke scripts and provider streaming tests                                                                         |
| Provider errors             | OpenAI-shaped fake/provider errors return safe structured errors                                    | Anthropic-shaped fake/provider errors return safe structured errors                 | Equivalent                            | `packages/proxy/src/index.test.ts`                                                                                 |
| Cancellation                | Gateway uses request abort and timeout handling for both provider routes                            | Same gateway cancellation path for `/v1/messages`                                   | Equivalent                            | `packages/proxy/src/index.ts`                                                                                      |
| Exact retrieval through MCP | Uses shared `get_exact_context` MCP tool                                                            | Uses shared `get_exact_context` MCP tool                                            | Equivalent                            | `packages/retrieval-mcp/src/index.ts`, `packages/retrieval-mcp/src/index.test.ts`                                  |
| Benchmark                   | CLI benchmark and compatibility audit accept Codex host fixtures                                    | CLI benchmark and compatibility audit accept Claude Code host fixtures              | Equivalent                            | `packages/cli/src/index.test.ts`                                                                                   |
| Status and doctor           | CLI status/doctor show route, Safe mode and restore guidance without credentials                    | Same commands and renderer doctor apply                                             | Equivalent                            | `packages/cli/src/index.ts`, CLI snapshots                                                                         |
| Route restoration           | Setup preview explains restoring direct Codex routing                                               | Setup preview explains unsetting `ANTHROPIC_BASE_URL` and removing optional hook    | Equivalent                            | `skill-source/context-diet/references/CODEX_SETUP.md`, `skill-source/context-diet/references/CLAUDE_CODE_SETUP.md` |
| Uninstall                   | Preview-only uninstall instructions remove Codex provider/MCP entries                               | Preview-only uninstall instructions remove Claude Code base URL/MCP/hook entries    | Equivalent                            | CLI setup preview tests and skill references                                                                       |

## Fake-Provider End-to-End Results

Both fake-provider routes were run with loopback binding and fake credentials only:

- `pnpm smoke:openai`: PASS, exercised `http://127.0.0.1:<port>/v1/responses`
- `pnpm smoke:anthropic`: PASS, exercised `http://127.0.0.1:<port>/v1/messages`

The smoke scripts assert the fake credential values and full request bodies do not appear in
structured logs.

## Parity Review Findings

### Fixed: Compatibility scaffold was too shallow

**Severity:** High for release confidence, low direct runtime risk.

**Evidence:** `tests/compatibility/platforms.test.ts` previously only asserted that the two adapter
factory functions returned provider names.

**Impact:** A future provider-specific regression in request parsing, cache flags, tool state, image
block handling or pass-through rebuilds could pass the compatibility suite even if one host became
weaker than the other.

**Fix:** The compatibility suite now parses equivalent Codex/OpenAI and Claude/Anthropic requests
covering streaming, cache fields, images, completed tool state and no-change rebuilds. It also
checks that provider wire names do not appear in the core package source.

### No critical provider TODOs found

`TODO` review did not find a current provider marked as future-only or one host intentionally left
behind. Remaining blueprint TODO-like material is planning documentation, not active adapter code.

### No provider-specific wire-type leak found in core

The strengthened compatibility test rejects `OpenAI`, `Anthropic`, `Responses`, `Messages`,
`function_call`, `tool_use` and `cache_control` in `packages/core/src/index.ts`. The current core
source passes this guard.

### No shared-skill platform-only instruction gap found

The shared `SKILL.md` stays platform-neutral. Platform-only commands and setup details are kept in
one-level references:

- `references/CODEX_SETUP.md`
- `references/CLAUDE_CODE_SETUP.md`

### No generated skill drift found

`pnpm check:skills` verifies the generated `.agents` and `.claude` skill targets against the
canonical `skill-source/context-diet/` source.

## Remaining Risks

- Installation and uninstall are intentionally preview-only. True write-enabled installation still
  needs transactional manifests and rollback before it should be considered complete.
- Codex IDE and Claude Code IDE are not release-tested and are not supported by this release scope.
- Cancellation is implemented in the shared gateway path, but there is not yet a dedicated
  host-labelled cancellation smoke for each platform.
- The fake-provider suite proves local protocol compatibility only. Real Codex and Claude Code host
  configuration should remain fake/synthetic until explicitly approved.
