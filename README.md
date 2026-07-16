# Context Diet

**Reduce waste. Protect facts. Prove the result.**

Context Diet is a local context optimisation layer for AI coding agents. It audits large requests,
protects exact and sensitive information, compresses only suitable blocks, stores reversible local
references, and measures whether the change actually saves tokens and cost without reducing task
quality.

## Supported hosts

The project must support both from the first release:

- OpenAI Codex CLI and IDE
- Anthropic Claude Code CLI and IDE

## How it connects

### Codex

Codex can be pointed to a custom model provider with a local `base_url`. Context Diet exposes an
OpenAI Responses-compatible gateway endpoint.

### Claude Code

Claude Code can be pointed to a gateway with `ANTHROPIC_BASE_URL`. Context Diet exposes an Anthropic
Messages-compatible gateway endpoint.

## Core product

```text
Codex or Claude Code
        |
        v
Context Diet local gateway
        |
        +-- Provider adapter
        +-- Context scanner
        +-- Exactness Firewall
        +-- Policy engine
        +-- Renderer adapter
        +-- Local context vault
        +-- Exact retrieval tool
        +-- Metrics and benchmark engine
        |
        v
OpenAI or Anthropic
```

## What stays native text in Safe mode

- Current instructions
- Active code and diffs
- Shell commands and SQL
- Paths, URLs, IDs and hashes
- Numbers, versions, dates and ports
- Secrets and authentication material
- Open or incomplete tool calls
- Unknown or unsupported content

## What may be compressed

- Old explanatory prose
- Repetitive history
- Completed, low-risk tool output
- Large logs after protected values are removed
- Documentation that can be recovered from the local vault

## Repository instructions

Codex reads `AGENTS.md`.

Claude Code reads `CLAUDE.md`, which imports the shared `AGENTS.md` rules and adds Claude-specific
guidance.

The full blueprint is in `docs/CONTEXT_DIET_BLUEPRINT.md`.

## Canonical skill

The editable skill source lives at:

`skill-source/context-diet/`

Generated installation targets:

- `.agents/skills/context-diet/`
- `.claude/skills/context-diet/`

Do not manually maintain three different skill versions. The build prompts create a sync and
drift-check script.

## Build guide

Start with:

`docs/BEGINNER_STEP_BY_STEP_GUIDE.md`

Then run:

`docs/UPDATED_BUILD_PROMPTS_CODEX_AND_CLAUDE.md`

one prompt at a time.

## Status

This repository pack contains product, architecture, security, compatibility and build instructions.
Production code is intentionally not included yet.
