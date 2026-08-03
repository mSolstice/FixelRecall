# Context Diet Landing Page Copy Draft

Status: draft copy only

Do not publish this as a live website without a final release and claims review.

## Hero Headline

Shrink your coding agent's context without losing the details.

## Hero Subheadline

Context Diet helps Codex CLI and Claude Code CLI carry less wasteful context while protecting code,
commands, secrets, paths, IDs and exact facts.

## One-Sentence Explanation

Context Diet is a local safety and efficiency layer that decides what old context can safely shrink,
what must stay exact and whether the result is actually worth using.

## Three Core Benefits

### Less Waste

Reduce repeated, stale or low-value context when policy says it is safe and worthwhile.

### More Safety

Keep current instructions, code, commands, secrets, exact values and active tool state protected as
native text.

### Clear Evidence

See why a block changed, why it stayed native, whether exact recovery is available and whether the
benchmark result is positive, neutral or negative.

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

## How It Works

1. A Codex CLI or Claude Code CLI request goes through the local Context Diet gateway.
2. The Exactness Firewall identifies content that must stay native, such as code, commands, paths,
   IDs, hashes, secrets and active tool state.
3. The policy engine decides whether old, safe, recoverable context is eligible to shrink.
4. Approved context can be rendered through the renderer interface, while the original authorised
   text remains recoverable through the local vault and MCP retrieval.
5. If anything is unsafe, unknown or fails, Context Diet preserves the original provider content.

## Supported Scope

Current release scope:

- macOS only.
- Codex CLI.
- Claude Code CLI.
- Local loopback gateway.
- Safe mode default.
- Fake-provider development mode.
- Local MCP retrieval in tested flows.
- Dry-run setup, confirmed setup, rollback and uninstall on macOS CLI.

## What Is Not Claimed Yet

Context Diet does not currently claim:

- Codex IDE support.
- Claude Code IDE support.
- Windows native support.
- WSL support.
- Broad hosted/enterprise production deployment.
- Hosted or multi-user deployment support.
- Proven real-world savings across private repositories.
- Approved real model profiles.
- Third-party security review.
- Published package availability.

## Developer Workflow

1. Clone the repository and build with pnpm.
2. Run local checks and fake-provider tests.
3. Start the local gateway in Safe mode.
4. Run dry-run setup before changing Codex or Claude Code config.
5. Confirm setup only after reviewing the files to be touched.
6. Use Codex CLI or Claude Code CLI normally.
7. Ask Context Diet-specific questions when you want diagnostics, benchmarks, explanations or exact
   retrieval.
8. Roll back or uninstall using the recorded local manifest.

## Privacy And Safety Defaults

- Safe mode is default.
- Provider credentials are not stored by Context Diet setup.
- Raw request bodies and authentication values must not be logged or persisted.
- Secret-sensitive content is never render-eligible.
- Exact, current, action-critical and incompatible content stays native.
- Unknown or unsafe transformation shapes pass through unchanged.
- Benchmarks may be positive, neutral or negative.

## Evidence Summary

Current evidence includes:

- local checks passing
- fake-provider validation passing
- OpenAI/Codex and Anthropic/Claude Code route canaries passing with explicit user consent
- generated toy-project real-provider benchmark canary passing
- real macOS user-level setup, rollback and uninstall canary passing
- GitHub Actions green according to user report for the current macOS CLI release

This evidence supports Context Diet for macOS CLI. It does not prove broad hosted/enterprise
production deployment.

## Call To Action

Try Context Diet for macOS CLI with Codex CLI or Claude Code CLI.

Start with fake-provider validation, review every dry-run setup change, keep credentials out of the
repository and treat real-provider canaries as explicit-consent tests only.
