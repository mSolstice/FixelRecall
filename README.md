# Context Diet

**Reduce waste. Protect facts. Prove the result.**

Context Diet is a local context optimisation layer for coding agents. It is designed to audit large
requests, protect exact and sensitive information, transform only suitable older context, keep
recoverable local references, and measure whether the result is actually worthwhile.

## Current Status

Context Diet is currently at **local fake-provider beta** status.

What is proven now:

- OpenAI Responses-shaped fake traffic can pass through the local gateway.
- Anthropic Messages-shaped fake traffic can pass through the local gateway.
- The gateway, adapters, firewall, vault, MCP retrieval, renderer interface, CLI, dashboard and
  benchmark flows are covered by local synthetic tests.
- The complete fake beta flow is available as `pnpm beta:fake`.

What is not proven yet:

- Real OpenAI provider traffic.
- Real Anthropic provider traffic.
- Real user configuration writes.
- Production release readiness.

Do not claim real-provider support from this repository state.

## Supported Hosts

Current surface status:

- Codex CLI: fake-provider tested through an OpenAI Responses-compatible local route.
- Codex IDE: not release-tested.
- Claude Code CLI: fake-provider tested through an Anthropic Messages-compatible local route.
- Claude Code IDE: not release-tested.

## Supported Operating Systems

Current evidence:

- macOS: locally tested on Darwin arm64 with Node.js 26 and pnpm 11.
- Linux: GitHub Actions is configured for Ubuntu with Node.js 24 and Node.js 26, but current support
  should be treated as CI-targeted until a clean remote run is reviewed.
- Windows native: unsupported for this release.
- WSL: unsupported for this release.

See `docs/OS_SUPPORT.md` for path, permission, temp directory, symlink and loopback details.

## How It Connects

### Codex CLI

Codex can be pointed to a custom model provider with a local `base_url`. Context Diet exposes an
OpenAI Responses-compatible gateway endpoint:

```text
http://127.0.0.1:<gateway-port>/v1/responses
```

### Claude Code CLI

Claude Code can be pointed to the local gateway with `ANTHROPIC_BASE_URL`. Context Diet exposes an
Anthropic Messages-compatible gateway endpoint:

```text
http://127.0.0.1:<gateway-port>/v1/messages
```

## Fake-Provider Setup

Use fake-provider checks before any real canary:

```bash
pnpm install
pnpm build
pnpm check:environment
pnpm smoke:openai
pnpm smoke:anthropic
pnpm beta:fake
```

The fake beta uses synthetic prompts, fake credentials, loopback servers and temporary local state.
It does not require provider API keys.

## Real-Provider Canary

Real-provider testing requires explicit consent and a separate plan.

Read:

```text
docs/REAL_PROVIDER_CANARY_PLAN.md
```

Do not run real-provider traffic unless the user explicitly consents in the same session. The canary
must use Safe mode only, a minimal synthetic prompt, strict token/cost limits and no private source
code.

## Install Preview

Current install behavior is preview-only.

Codex preview:

```bash
context-diet setup codex
```

Claude Code preview:

```bash
context-diet setup claude-code
```

These commands are expected to print safe configuration previews. They must not write user
configuration or include provider credentials without explicit confirmation.

## Uninstall Preview

Current uninstall behavior is preview-only.

```bash
context-diet uninstall
```

Manual restoration guidance:

- Codex: switch back to the previous direct provider and remove the Context Diet custom-provider
  entry when no longer needed.
- Claude Code: unset `ANTHROPIC_BASE_URL` and remove any optional local hook or MCP entry created
  for testing.
- Stop the local gateway.
- Delete temporary Context Diet sessions only after confirming the target session.

Transactional install, rollback and uninstall are not release-proven yet.

## Privacy And Safety Defaults

Safe mode is the default.

Safe mode keeps these as native text:

- Current instructions
- Active code and diffs
- Shell commands and SQL
- Paths, URLs, IDs and hashes
- Numbers, versions, dates and ports
- Secrets and authentication material
- Open or incomplete tool calls
- Unknown or unsupported content

Context Diet must not log authentication headers or raw request bodies. Secret-sensitive values are
not render-eligible and must not be stored in the vault.

If parsing, scanning, rendering, vault storage, profile validation or rebuilding fails, the original
provider content is preserved.

## Benchmark Evidence

Current benchmark evidence is **synthetic only**.

The personal benchmark harness compares:

- uncompressed control
- Safe compressed
- Safe compressed with exact retrieval

The current synthetic benchmark is useful for repeatable local regression checks. It must not be
presented as real provider cost savings or real workload quality evidence.

## Canonical Skill

The editable skill source lives at:

```text
skill-source/context-diet/
```

Generated installation targets:

- `.agents/skills/context-diet/`
- `.claude/skills/context-diet/`

Use:

```bash
pnpm sync:skills
pnpm check:skills
```

Do not manually maintain three different skill versions.

## Repository Instructions

Codex reads `AGENTS.md`.

Claude Code reads `CLAUDE.md`, which imports the shared `AGENTS.md` rules and adds Claude-specific
guidance.

The full blueprint is in:

```text
docs/CONTEXT_DIET_BLUEPRINT.md
```

## Known Limitations

- Real OpenAI and Anthropic provider canaries have not been run.
- Codex IDE and Claude Code IDE are not release-tested.
- Windows native and WSL are unsupported for this release.
- Install, uninstall and rollback are preview-only.
- The dashboard is local/static in this package; no production dashboard server is release-proven.
- Model profiles and benchmark evidence are synthetic.
- Highly cached, code-heavy or exactness-sensitive workloads may show neutral or negative value.
- No production database is included.
- This repository is not ready for a real-provider release until the release readiness report
  reaches a go decision.

## Release Readiness

See:

```text
RELEASE_READINESS.md
```

A no-go result is acceptable and should not be hidden.
