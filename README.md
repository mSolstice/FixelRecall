# Context Diet

**Make coding-agent context cheaper, safer and easier to understand.**

Context Diet is a local safety and efficiency layer for coding agents. It helps Codex CLI and Claude
Code CLI carry less wasteful context while protecting the exact details that should never be
compressed, rendered or guessed.

<p align="center">
  <img src="docs/assets/context-diet-overview.png" alt="Context Diet overview showing a local loopback gateway that keeps exact code and secrets protected, shrinks safe old context, uses a local vault, and reports savings honestly." width="900">
</p>

Think of it as a local nutrition label for your agent context:

- What is useful?
- What is old or repetitive?
- What must stay exact?
- What might be unsafe to transform?
- Did the change actually save anything?

## Why Developers Care

Long coding-agent sessions can quietly collect a lot of baggage: old chat, repeated tool output,
logs, file snippets, previous attempts and context that no longer matters. That can make requests
larger, slower, more expensive and harder for the model to reason about.

Context Diet helps by:

- reducing token and context waste where it is safe
- keeping code, commands, paths, IDs, hashes, secrets and active tool state protected
- preserving exact context through local retrieval when recovery is needed
- explaining why something was transformed or left untouched
- benchmarking whether Context Diet is worth using for a setup
- supporting both Codex CLI and Claude Code CLI through one local engine
- providing rollback and uninstall commands for local configuration changes

The goal is not to compress everything. The goal is **safe context reduction with evidence**.

## Shrink The Context. Keep The Details.

Context Diet turns safe old context into images, while exact text stays protected and recoverable.

It is not just compression. Instead of sending every old message, log and repeated note back to the
model as text, Context Diet decides what can safely become a compact visual memory.

- Current instructions, code, commands, paths, IDs, hashes and secrets stay as native text.
- Secrets are never rendered.
- The local vault keeps authorised original text for exact recovery.
- MCP retrieval can fetch a narrow exact section later.
- pxpipe sits behind the renderer interface to create approved images.
- If rendering fails, the original text is preserved.
- Image compression only happens when policy says it is safe and worthwhile.

## What This Adds Around OpenAI And Anthropic

OpenAI and Anthropic provide the models and coding agents. Context Diet adds a local product layer
around them:

- provider-neutral context policy across Codex CLI and Claude Code CLI
- a local gateway for OpenAI Responses-shaped and Anthropic Messages-shaped traffic
- an Exactness Firewall for code, commands, paths, IDs, hashes, versions, numbers, dates, URLs,
  secrets and other exact values
- local vault and MCP retrieval for narrow exact recovery
- reason codes that explain every policy decision
- synthetic and canary benchmark evidence
- local install, rollback and uninstall safeguards
- dashboard-ready metrics and context summaries

Context Diet does not replace OpenAI or Anthropic. It helps developers use coding agents with more
visibility, safety and cost awareness.

## Works With Your Existing CLI Login

Context Diet does not ask you to paste provider keys into the app, the repository or chat.

- Codex CLI uses custom-provider routing with `requires_openai_auth = true`, so Codex can reuse the
  Codex auth state you already signed in with.
- Claude Code CLI routes through `ANTHROPIC_BASE_URL`. If `ANTHROPIC_API_KEY` is unset, Claude Code
  can keep using its normal signed-in subscription auth.
- API keys are optional for users who intentionally want API-key billing.

Context Diet forwards required authentication headers in memory only. It must not print, log, store
or persist provider credentials.

## Current Release Status

**Context Diet for macOS CLI**

Context Diet is available for macOS CLI users of Codex CLI and Claude Code CLI.

Supported now:

- macOS
- Codex CLI
- Claude Code CLI
- local loopback gateway
- Safe mode default
- fake-provider development mode
- local MCP retrieval in tested flows
- dry-run setup, confirmed setup, rollback and uninstall on macOS CLI

Not included in this release:

- Codex IDE
- Claude Code IDE
- Windows native
- WSL
- broad hosted or enterprise production deployment
- proven real-world savings across private repositories
- third-party security review

See [RELEASE_READINESS.md](RELEASE_READINESS.md) and
[docs/MACOS_CLI_RELEASE_CHECKLIST.md](docs/MACOS_CLI_RELEASE_CHECKLIST.md).

## How A Developer Uses It

### 1. Install And Build

Run in Terminal:

```bash
git clone git@github.com:mSolstice/ContextDiet.git
cd ContextDiet
corepack enable
pnpm install
pnpm build
```

### 2. Run Local Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:compatibility
pnpm check:skills
```

### 3. Start The Local Gateway

Start the gateway in Safe mode:

```bash
node packages/cli/dist/index.js start
```

Check it from another Terminal tab:

```bash
curl -sS http://127.0.0.1:4317/health
curl -sS http://127.0.0.1:4317/status
```

Expected health shape:

```json
{ "status": "ok", "gateway": "context-diet-local", "mode": "safe" }
```

### 4. Dry-Run Setup

Dry-run setup writes nothing:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp
```

The dry run shows the Codex, Claude Code and MCP files that would be touched. Provider credentials
are not written.

Setup places the Codex `model_provider` key at the TOML root before any table headers, adds the
Codex MCP entry inside the managed Codex block, writes Claude Code `ANTHROPIC_BASE_URL` as a
settings environment value, and registers Claude MCP in the user Claude configuration.

Subscription users do not need to add provider API keys just to route through Context Diet. Codex
uses `requires_openai_auth = true` so Codex can reuse its own signed-in auth state. Claude Code uses
`ANTHROPIC_BASE_URL`; keep `ANTHROPIC_API_KEY` unset if you want Claude Code to keep using your
subscription instead of API billing.

### 5. Confirm Setup

Only after reviewing the dry-run output:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp --confirm --replace-existing-manifest
```

This records a local manifest and backups.

### 6. Use Codex CLI Or Claude Code CLI Normally

After configuration, normal coding prompts can continue as normal. Developers do not need to add
“use Context Diet” to every prompt for gateway behavior.

The skill is for Context Diet-specific operations, such as:

- diagnose Context Diet
- run a benchmark
- explain a policy decision
- retrieve exact context
- start or stop the local service
- troubleshoot Codex or Claude Code setup

Simple rule:

```text
Gateway = automatic once configured.
Skill = invoked for Context Diet-specific questions or commands.
```

## What Developers See

Gateway health:

```json
{ "status": "ok", "gateway": "context-diet-local", "mode": "safe" }
```

Setup:

```text
Confirmed: local configuration was written and backups were recorded.
Provider credentials are not stored, printed or generated.
```

Rollback:

```text
Rollback complete: backed-up files were restored from the install manifest.
Credentials: not displayed
```

Uninstall:

```text
Uninstall complete: only Context Diet managed entries were removed.
```

Policy explanations are plain-language:

```text
This block stayed native because it contained source code and exact file paths.
Safe mode keeps that content unchanged.
```

## Fake-Provider Validation

Fake-provider checks use synthetic prompts, fake credentials, loopback servers and temporary local
state. They do not require provider API keys. Run the repository fake-provider validation commands
listed in [RELEASE_READINESS.md](RELEASE_READINESS.md).

```bash
pnpm smoke:openai
pnpm smoke:anthropic
```

## Real-Provider Canaries

Real-provider canaries require explicit consent and a small provider budget. Do not paste provider
keys into chat and do not commit them to the repository.

Read first:

```text
docs/REAL_PROVIDER_CANARY_PLAN.md
```

Canaries must use Safe mode, synthetic prompts only, strict cost limits and no private source code.

## Rollback And Uninstall

Rollback:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js rollback --confirm
```

Uninstall:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js uninstall --confirm
```

## Privacy And Safety Defaults

Safe mode is default.

Safe mode keeps these as native text:

- current instructions
- active code and diffs
- shell commands and SQL
- paths, URLs, IDs and hashes
- numbers, versions, dates and ports
- secrets and authentication material
- open or incomplete tool calls
- unknown or incompatible content

Context Diet must not log authentication headers or raw request bodies. Secret-sensitive values are
not render-eligible and must not be stored in the vault.

If parsing, scanning, rendering, vault storage, profile validation or rebuilding fails, the original
provider content is preserved.

## Evidence

Current macOS CLI evidence includes:

- local checks passing
- fake-provider validation passing
- OpenAI/Codex and Anthropic/Claude Code route canaries passing with explicit user consent
- generated toy-project real-provider benchmark canary passing
- real macOS user-level setup, rollback and uninstall canary passing
- GitHub Actions green according to user report for the release commits

See:

- [RELEASE_READINESS.md](RELEASE_READINESS.md)
- [docs/MACOS_CLI_RELEASE_CHECKLIST.md](docs/MACOS_CLI_RELEASE_CHECKLIST.md)
- [docs/MACOS_CLI_PRIVATE_USAGE.md](docs/MACOS_CLI_PRIVATE_USAGE.md)

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

## What Not To Claim

Do not claim:

- broad hosted/enterprise deployment
- Codex IDE support
- Claude Code IDE support
- Windows native support
- WSL support
- hosted or multi-user deployment support
- proven real-world savings across private repositories
- approved real model profiles
- third-party security review
- published package availability

The honest current claim is:

```text
Context Diet is available for macOS CLI users of Codex CLI and Claude Code CLI.
IDE, Windows native, WSL, and broad hosted/enterprise production deployment are not included in this release.
```
