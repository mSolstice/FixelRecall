# Context Diet Website Design And Content Source

This is the content source for adding Context Diet to the Fixel website.

## Product Positioning

Context Diet is a local safety and efficiency layer for coding agents.

It helps Codex CLI and Claude Code CLI carry less wasteful context while protecting the exact
details that should never be compressed, rendered or guessed.

One-line description:

```text
Context Diet helps coding agents stop sending yesterday's mess into today's task.
```

Primary headline:

```text
Shrink The Context. Keep The Details.
```

Primary subheadline:

```text
Context Diet turns safe old context into images, while exact text stays protected and recoverable.
```

## Why Developers Care

Long coding-agent sessions collect old chat, repeated tool output, logs, stale notes and context
that no longer matters. That can mean more tokens, more cost, more noise and more chances to miss
exact details.

Context Diet helps by:

- reducing repeated or stale context where it is safe
- keeping code, commands, paths, IDs, hashes, secrets and active tool state protected
- preserving exact context through local retrieval
- explaining why something changed or stayed native
- benchmarking whether it is actually worth enabling
- supporting both Codex CLI and Claude Code CLI through one local engine
- providing dry-run setup, rollback and uninstall commands

## The Big Idea

Context Diet is not just compression.

Instead of sending every old message, log and repeated note back to the model as text, Context Diet
decides what can safely become compact visual memory.

Simple mental model:

```text
Image = gist
Vault = exact original
MCP retrieval = narrow exact recovery
```

Key safety rules:

- Current instructions stay native.
- Code and commands stay native.
- Paths, IDs, hashes and exact values stay native.
- Secrets are never rendered.
- Safe old context can become image memory.
- Original text stays recoverable through the local vault.
- MCP retrieval can fetch a narrow exact section later.
- If rendering fails, original content is preserved.
- Image compression only happens when policy says it is safe and worthwhile.

## What It Adds Around OpenAI And Anthropic

OpenAI and Anthropic provide the models and coding agents. Context Diet adds a local product layer
around them:

- provider-neutral context policy across Codex CLI and Claude Code CLI
- local gateway for OpenAI Responses-shaped and Anthropic Messages-shaped traffic
- Exactness Firewall for code, commands, paths, IDs, hashes, versions, numbers, dates, URLs and
  secrets
- local vault and MCP retrieval for narrow exact recovery
- reason codes for every policy decision
- benchmark evidence
- install, rollback and uninstall safeguards
- dashboard-ready metrics and context summaries

Do not position Context Diet as replacing OpenAI or Anthropic. It is a local safety and efficiency
layer around coding-agent traffic.

## Three Core Benefits

### Less Waste

Reduce repeated, stale or low-value context when policy says it is safe and worthwhile.

### More Safety

Keep current instructions, code, commands, secrets, exact values and active tool state protected as
native text.

### Clear Evidence

See why a block changed, why it stayed native, whether exact recovery is available and whether a
benchmark result is positive, neutral or negative.

## Short Narrative For Video Or Hero

Your coding agent is carrying yesterday's mess into today's task: old logs, repeated notes, stale
chat and thousands of wasted tokens.

Context Diet runs locally, sorts the clutter and protects what matters. Code stays exact. Secrets
stay locked. Safe old context becomes visual memory. The original text stays recoverable in the
vault.

So instead of sending everything again, your agent gets the signal without losing the details.

## Suggested Visual Experience

Open with chaos. End with relief.

Animation sequence:

1. Context blocks flood the screen like clutter.
2. Token counter shoots up.
3. A "Stop sending everything again" moment appears.
4. Context Diet sorts blocks into clean lanes.
5. Secrets snap shut behind locks.
6. Code and commands stay untouched.
7. Safe old context compresses into a clean image card.
8. Exact text slides into a local vault.
9. A tiny retrieval beam pulls back one needed detail.
10. Before/after token bars drop.
11. Final screen feels calm, clean and in control.

Emotional reaction to aim for:

```text
Oh no, my agent is wasting context.
Wait, this cleans it up safely.
I want that.
```

## Supported Scope

Current supported release scope:

- macOS only
- Codex CLI
- Claude Code CLI
- local loopback gateway
- Safe mode default
- fake-provider development mode
- local MCP retrieval in tested flows
- dry-run setup, confirmed setup, rollback and uninstall on macOS CLI

## Not Claimed

Do not claim:

- Codex IDE support
- Claude Code IDE support
- Windows native support
- WSL support
- broad hosted/enterprise production deployment
- hosted or multi-user deployment
- savings guarantees
- proven real-world savings across private repositories
- approved real model profiles
- third-party security review
- published package availability

## Evidence Summary

Current evidence includes:

- local checks passing
- fake-provider validation passing
- OpenAI/Codex and Anthropic/Claude Code route canaries passing with explicit user consent
- generated toy-project real-provider benchmark canary passing
- real macOS user-level setup, rollback and uninstall canary passing
- GitHub Actions green according to user report for release commits

This evidence supports Context Diet for macOS CLI. It does not prove broad hosted/enterprise
production deployment.

## CTAs

Use these CTAs:

- Explore Context Diet
- Watch demo
- Read setup docs
- View GitHub
- Try Context Diet for macOS CLI

Avoid:

- Start free
- Production deploy
- Install package
- Guaranteed savings
