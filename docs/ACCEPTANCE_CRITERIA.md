# Context Diet Acceptance Criteria

## Rule

A feature is not complete because the screen looks right or one happy-path test passes.

It is complete only when its behaviour, failure mode, security and dual-platform compatibility are
demonstrated.

# 1. Repository foundation

- [ ] Node.js 24 LTS or Node.js 26, and pnpm 11, are declared.
- [ ] TypeScript strict mode is enabled.
- [ ] Lint, format, typecheck, test and build commands exist.
- [ ] CI runs the same commands.
- [ ] No real secret exists in the repository.
- [ ] `AGENTS.md` and `CLAUDE.md` are concise and load correctly.

# 2. Dual-platform transport

- [ ] Codex can route a Responses request through the local gateway.
- [ ] Claude Code can route a Messages request through the local gateway.
- [ ] Both paths work against fake upstreams.
- [ ] Both preserve streaming.
- [ ] Both forward authentication only in memory.
- [ ] Authentication is redacted from logs and errors.
- [ ] Setup instructions explain how to restore the original provider route.

# 3. Normalised model

- [ ] OpenAI and Anthropic requests can be represented using common internal types.
- [ ] Original order is retained.
- [ ] Provider-only metadata is retained for rebuilding.
- [ ] Unknown blocks retain their original raw fragment.
- [ ] Core policy code imports no provider wire types.

# 4. Exactness Firewall

- [ ] Current instructions stay native.
- [ ] Code, diffs, commands and SQL stay native in Safe mode.
- [ ] Paths, IDs, hashes, versions and numbers stay native.
- [ ] Secret-sensitive values are never render-eligible.
- [ ] Unsupported languages or glyphs remain native.
- [ ] Unknown-risk content remains native.
- [ ] Every decision has one or more reason codes.
- [ ] User-defined protected patterns work.

# 5. Vault

- [ ] Every recoverable block has a stable ID.
- [ ] Content has an integrity hash.
- [ ] Projects and sessions are isolated.
- [ ] Expiry works.
- [ ] Delete-session removes associated content.
- [ ] Interrupted writes do not expose partial blocks.
- [ ] The dashboard cannot read raw vault files directly.

# 6. Retrieval

- [ ] The MCP tool returns only an authorised block.
- [ ] Searches and line ranges are size-limited.
- [ ] Path traversal fails.
- [ ] Cross-project access fails.
- [ ] Cross-session access fails unless explicitly allowed.
- [ ] Deleted or expired content cannot be returned.
- [ ] Raw retrieved text is not placed in ordinary metrics logs.

# 7. Renderer

- [ ] Renderer is behind an interface.
- [ ] pxpipe-specific code is isolated.
- [ ] Licence notices are preserved when required.
- [ ] Protected values are removed before rendering.
- [ ] Golden image tests are deterministic within documented tolerance.
- [ ] Glyph coverage is checked.
- [ ] Unsupported model profiles disable imaging.
- [ ] Renderer failure returns original text.
- [ ] Vault failure disables recoverable rendering.

# 8. OpenAI adapter

- [ ] Responses items parse and rebuild.
- [ ] Function calls and outputs remain paired.
- [ ] Active or incomplete calls are not compressed.
- [ ] Image inputs remain valid.
- [ ] Cache-sensitive fields are preserved.
- [ ] Unknown request items pass through unchanged.
- [ ] Streaming response order is preserved.

# 9. Anthropic adapter

- [ ] Message content blocks parse and rebuild.
- [ ] `tool_use` and `tool_result` remain paired.
- [ ] Active tool state is preserved.
- [ ] Image blocks remain valid.
- [ ] Cache-control and required headers are preserved.
- [ ] Unknown block types pass through unchanged.
- [ ] Streaming event order is preserved.

# 10. Proxy

- [ ] Binds to loopback by default.
- [ ] Has upstream allowlisting.
- [ ] Has request-size limits.
- [ ] Has timeouts and cancellation.
- [ ] Has health and status endpoints.
- [ ] Has a runtime kill switch.
- [ ] Safe mode is the default.
- [ ] Raw bodies are not stored.
- [ ] Authentication headers are not logged.
- [ ] Unsupported transformations pass original content.

# 11. Metrics and savings

- [ ] Measured and estimated numbers are labelled separately.
- [ ] Cached tokens are shown separately.
- [ ] No baseline means no saving percentage.
- [ ] Failed runs are not compared as successes.
- [ ] Different models or prices invalidate the comparison unless normalised.
- [ ] Added latency is reported.
- [ ] Retrieval calls are reported.
- [ ] Protected-value image count is reported and must be zero for release.

# 12. Dashboard

- [ ] Context X-ray works.
- [ ] Risk ledger works.
- [ ] Model profile status is visible.
- [ ] Kill switch and current mode are visible.
- [ ] Raw content is hidden by default.
- [ ] Share-card fields use an allowlist.
- [ ] Export requires explicit confirmation.

# 13. Skills

- [ ] Canonical skill exists under `skill-source/context-diet`.
- [ ] Codex copy exists under `.agents/skills/context-diet`.
- [ ] Claude Code copy exists under `.claude/skills/context-diet`.
- [ ] Sync script creates both.
- [ ] Drift check fails CI when copies differ.
- [ ] Codex can invoke the skill.
- [ ] Claude Code can invoke the skill.
- [ ] Skill references load only when needed.
- [ ] Skill accurately explains its boundary.

# 14. End-to-end release gate

- [ ] All checks pass on macOS.
- [ ] All checks pass on Linux.
- [ ] Windows or WSL support is either tested or clearly marked unsupported.
- [ ] Fake-provider smoke tests pass.
- [ ] Codex real-provider canary passes with explicit consent.
- [ ] Claude Code real-provider canary passes with explicit consent.
- [ ] No critical or high security finding remains open.
- [ ] Uninstall restores configuration safely.
- [ ] Known limitations are written in the README.
