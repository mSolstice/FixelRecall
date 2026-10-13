# Fixel Recall Technical Documentation

Status: technical overview for Fixel Recall for macOS CLI

Current scope:

- macOS CLI
- Codex CLI
- Claude Code CLI
- local loopback gateway
- Safe mode default

IDE, Windows native and WSL support are not included in this release. Broad hosted/enterprise
production deployment is not included in this release.

## What Fixel Recall Is

Fixel Recall is a local provider-neutral context safety and efficiency engine for coding agents.

It sits between a coding-agent CLI and the provider API, then decides:

- what context must stay as exact native text
- what old safe context may be transformed
- what secrets must never be rendered or persisted
- what exact original text should be recoverable through the local vault
- whether a transformation is worth doing after sidecar, rendering and image-token costs

The goal is safe context reduction with evidence, not blind compression.

## High-Level Architecture

```text
Codex CLI / Claude Code CLI
        |
        v
Local Fixel Recall Gateway
        |
        v
Provider Adapter
  - OpenAI Responses adapter
  - Anthropic Messages adapter
        |
        v
Provider-Neutral Core
  - normalized requests
  - blocks
  - source categories
  - policy decisions
  - reason records
        |
        v
Exactness Firewall + Policy Engine
        |
        +--> keep native text
        |
        +--> renderer interface -> pxpipe adapter or fake renderer
        |
        +--> local vault -> MCP exact retrieval
        |
        v
Rebuilt Provider Request
        |
        v
OpenAI / Anthropic upstream
```

## Package Layout

```text
packages/core
```

Provider-neutral types, policy records, reason codes and shared decision structures.

```text
packages/firewall
```

Exactness Firewall. Detects protected and secret-sensitive spans such as code, commands, paths,
URLs, IDs, hashes, versions, numbers, dates, API keys, bearer tokens, cookies and private keys.

```text
packages/providers-openai
```

OpenAI Responses adapter. Parses supported request items into normalized blocks and rebuilds valid
Responses-shaped requests while preserving unknown fields and provider continuity metadata.

```text
packages/providers-anthropic
```

Anthropic Messages adapter. Parses supported content blocks into normalized blocks and rebuilds
valid Messages-shaped requests while preserving role order, tool state, images and cache fields.

```text
packages/proxy
```

Local gateway. Provides health/status endpoints and provider-shaped routes:

- `/v1/responses`
- `/v1/messages`

It binds to loopback by default, enforces upstream allowlisting, has a kill switch, timeouts,
request limits and privacy-safe structured metrics.

```text
packages/vault
```

Local context vault. Stores authorised original content with project/session/block IDs, integrity
hashes, expiry and deletion state. It does not store authentication headers or secret-sensitive
spans.

```text
packages/retrieval-mcp
```

Local MCP retrieval service. Initial tool:

```text
get_exact_context
```

It returns only narrow authorised exact context sections and rejects direct filesystem paths,
traversal strings and unauthorised project/session access.

```text
packages/renderer
```

Provider-neutral renderer interface plus deterministic fake renderer and pxpipe-compatible adapter.
The core and policy layers depend only on the renderer interface.

```text
packages/metrics
```

Recommendation, savings, cost and compatibility reporting. Keeps measured, estimated, cached, image
and output token counts separate.

```text
packages/benchmark
```

Synthetic and canary benchmark harnesses. Supports control, Safe compressed and Safe compressed with
exact retrieval variants.

```text
packages/cli
```

CLI entry point and local operator commands:

- `doctor`
- `audit`
- `start`
- `stop`
- `status`
- `explain`
- `benchmark`
- `retrieve`
- `delete-session`
- `setup`
- `rollback`
- `uninstall`

```text
apps/dashboard
```

Local dashboard-ready UI/data surfaces for Context X-ray, Safe savings, Risk ledger, Model health
and Session control.

## Request Flow

1. A Codex CLI or Claude Code CLI request is routed through the local gateway.
2. The gateway validates authentication, request size, allowlisting, timeout and kill-switch rules.
3. Supported live requests are currently forwarded unchanged.
4. The Exactness Firewall, policy engine, renderer and vault are exercised in isolated and synthetic
   flows while live transformation wiring remains in development.
5. When live wiring is enabled, supported content will be parsed into provider-neutral blocks,
   scanned, policy-evaluated, stored for recovery when authorised, rendered when eligible and
   rebuilt into the provider request.
6. Unknown shapes and any failed transformation pass through unchanged.

## Safety Model

Safe mode is default.

These stay native in Safe mode:

- current user/developer instructions
- source code and diffs
- shell commands
- SQL
- file paths
- URLs
- IP addresses, domains and ports
- dates and timestamps
- versions
- UUIDs and Git hashes
- ticket and database IDs
- numbers with units
- prices and percentages
- JSON keys
- environment variable names
- API keys
- bearer tokens
- passwords
- cookies
- private keys
- high-entropy secret-like values
- active or malformed tool state
- unknown-risk content

Secret-sensitive spans are never render-eligible.

If parsing, scanning, rendering, vault storage, profile validation or request rebuilding fails,
Fixel Recall sends the original content unchanged and records a safe reason code.

## Image Compression And pxpipe

Fixel Recall is designed to use image rendering only for old, safe, recoverable context. The live
gateway does not currently claim to perform this conversion on ordinary provider traffic.

Simple model:

```text
Image = gist
Vault = exact original
MCP retrieval = narrow exact recovery
```

pxpipe is used behind the renderer interface. It is not called directly from the policy layer.

The policy engine decides whether rendering is allowed. The renderer only receives policy-approved,
secret-cleaned blocks.

If rendering fails, times out, has incompatible glyphs or violates profile/page limits, the original
text is preserved.

## Vault And Retrieval

The vault stores authorised original content locally with:

- project ID
- session ID
- block ID
- source category
- integrity hash
- creation time
- expiry time
- deletion status

It does not store:

- authentication headers
- secret-sensitive spans
- arbitrary filesystem paths supplied by the model

Retrieval uses MCP and requires project/session/block authority. It returns only narrow matching
sections and includes source label, integrity status and truncation status.

## Gateway Routes

Health:

```text
GET /health
```

Status:

```text
GET /status
```

OpenAI Responses-compatible route:

```text
POST /v1/responses
```

Anthropic Messages-compatible route:

```text
POST /v1/messages
```

The gateway:

- binds to loopback by default
- requires explicit upstream allowlist
- keeps auth headers in memory only
- avoids raw request-body persistence
- streams without complete buffering where supported
- exposes privacy-safe metrics
- supports runtime bypass and kill switch

## CLI Setup Commands

Build first:

```bash
pnpm install
pnpm build
```

Dry-run setup:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp
```

Confirmed setup after dry-run review:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp --confirm --replace-existing-manifest
```

Rollback:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js rollback --confirm
```

Uninstall:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js uninstall --confirm
```

Provider credentials are not written by setup.

## Required Checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:compatibility
pnpm check:skills
FIXEL_RECALL_TEST_CANARIES='[]' pnpm scan:test-canaries -- .
pnpm smoke:openai
pnpm smoke:anthropic
```

## Current Evidence

Current release evidence includes:

- local checks passing
- fake-provider validation passing
- OpenAI/Codex route canary passing with explicit user consent
- Anthropic/Claude Code route canary passing with explicit user consent
- generated toy-project real-provider benchmark canary passing
- real macOS user-level setup, rollback and uninstall canary passing
- GitHub Actions green according to user report for release commits

This evidence supports Fixel Recall for macOS CLI. Broad hosted/enterprise production deployment is
not included in this release.

## Important Limitations

Not included in this release:

- Codex IDE support
- Claude Code IDE support
- Windows native support
- WSL support
- hosted or enterprise production deployment
- broad real-world savings
- savings guarantees
- approved real model profiles
- third-party security review
- published package availability

## Source Documents

Primary project documents:

- `README.md`
- `RELEASE_READINESS.md`
- `docs/MACOS_CLI_RELEASE_CHECKLIST.md`
- `docs/MACOS_CLI_PRIVATE_USAGE.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY_MODEL.md`
- `docs/ACCEPTANCE_CRITERIA.md`
- `docs/DECISIONS.md`
- `docs/PXPIPE_INTEGRATION_REVIEW.md`
- `docs/REAL_PROVIDER_CANARY_PLAN.md`
