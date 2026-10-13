# Fixel Recall Architecture

## Purpose

This document defines the boundaries that keep Fixel Recall safe, testable and compatible with both
Codex and Claude Code.

## Core design

```text
Host configuration
    |
    +-- Codex custom provider
    +-- Claude Code gateway
    |
    v
Local gateway
    |
    v
Provider adapter
    |
    v
Normalised request
    |
    +-- Scanner
    +-- Exactness Firewall
    +-- Policy engine
    +-- Renderer
    +-- Vault
    |
    v
Provider request rebuild
    |
    v
Upstream model provider
```

The response takes the reverse path and is streamed without semantic rewriting.

## Monorepo layout

```text
fixel-recall/
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── docs/
├── packages/
│   ├── core/
│   ├── scanner/
│   ├── firewall/
│   ├── policy/
│   ├── renderer/
│   ├── renderer-pxpipe/
│   ├── vault/
│   ├── retrieval-mcp/
│   ├── providers-openai/
│   ├── providers-anthropic/
│   ├── proxy/
│   ├── metrics/
│   ├── benchmark/
│   └── cli/
├── apps/
│   └── dashboard/
├── skill-source/
│   └── fixel-recall/
├── .agents/
│   └── skills/fixel-recall/
├── .claude/
│   └── skills/fixel-recall/
├── scripts/
├── tests/
│   ├── fixtures/
│   ├── compatibility/
│   ├── security/
│   └── e2e/
└── .github/workflows/
```

The agent may propose a smaller initial layout. It must preserve the boundaries, even if several
packages begin as folders inside one package.

## Dependency direction

Allowed:

```text
adapters -> core types
proxy -> adapters and core pipeline
policy -> core types
renderer adapters -> renderer interface
CLI -> public service APIs
dashboard -> local read-only API
```

Forbidden:

```text
core -> OpenAI wire types
core -> Anthropic wire types
policy -> HTTP server
renderer -> authentication
dashboard -> raw vault files
skill -> private provider credentials
```

## Normalised request model

The normalised model must retain enough metadata to rebuild the provider request exactly where no
transformation occurred.

Important properties:

- Stable internal IDs
- Original order
- Role
- Block kind
- Source category
- Age or turn position
- Exactness risk
- Secret sensitivity
- Recoverability
- Provider metadata bag
- Original raw fragment for safe pass-through
- Transformation decision and reason codes

## Decisions

Possible block decisions:

- `KEEP_NATIVE`
- `REDACT_AND_KEEP`
- `REDACT_AND_RENDER`
- `RENDER_RECOVERABLE`
- `REFERENCE_ONLY`
- `DEDUPLICATE`
- `DROP_STALE`
- `PASS_THROUGH_UNKNOWN`

Safe mode should use only the conservative subset.

## Gateway endpoints

Suggested local service:

```text
GET  /health
GET  /status
POST /v1/responses
POST /v1/messages
POST /admin/kill-switch
POST /admin/mode
```

The exact upstream path handling must be discovered and tested during the feasibility phase. Do not
assume every client sends only one endpoint.

## Codex transport

Codex uses a custom provider entry in its configuration with:

- A unique provider ID
- Local Fixel Recall base URL
- Responses protocol
- API key environment variable
- Optional provider headers

Never commit a real personal Codex configuration or key.

## Claude Code transport

Claude Code points at the Fixel Recall gateway using `ANTHROPIC_BASE_URL`.

The gateway must preserve all required headers, beta capabilities and request fields. Verify
behaviour with `/status` and a fake upstream before using a real account.

## Authentication handling

- Read authentication headers into memory only.
- Forward only to the configured allowlisted upstream.
- Never write credentials to logs, traces, exceptions, snapshots or fixtures.
- Redact headers before diagnostic output.
- Do not expose authentication values to the dashboard.

## Streaming

The proxy must:

- Forward status and relevant headers
- Avoid buffering the complete response
- Preserve chunk or event order
- Handle upstream disconnects
- Handle client cancellation
- Apply timeout limits
- Avoid rewriting model output

## Failures

### Transformation failures

Examples:

- Parser error
- Unknown shape
- Renderer error
- Profile expired
- Vault unavailable
- Negative saving

Action: pass original content unchanged.

### Authorisation failures

Examples:

- Wrong project
- Wrong session
- Invalid block ID
- Path traversal
- Oversized retrieval request

Action: return no context.

## Context vault

Recommended initial implementation:

- SQLite metadata
- Content files or SQLite blobs
- Project-scoped namespace
- Session-scoped authorisation
- SHA-256 integrity hashes
- Atomic transactions
- Expiry and deletion
- No arbitrary path lookup

## Exact retrieval through MCP

Expose a common MCP server so both Codex and Claude Code can use the same retrieval operation.

Initial tool:

```text
get_exact_context
```

Inputs:

- `project_id`
- `session_id`
- `block_id`
- `query` or `line_start` and `line_end`
- `max_chars`

Outputs:

- Narrow exact text
- Source label
- Truncation status
- Integrity status

Never return a host filesystem path unless policy explicitly permits it.

## Renderer interface

The core must not import pxpipe directly.

The renderer interface should support:

- Text input
- Protected-span map
- Model profile
- Page limits
- Stable block labels
- Output images
- Exact sidecar
- Health and glyph report
- Failure reason

## Metrics

Store counts and decisions, not raw context.

Examples:

- Original character and token estimates
- Number of blocks by class
- Number kept, redacted, imaged and retrieved
- Image dimensions
- Model profile
- Timing
- Error and reason codes
- Benchmark outcome

## Dashboard API

The dashboard should read through a local API, not open database files directly.

Raw context endpoints should not exist in the MVP.

## Configuration

Use layered configuration:

1. Safe built-in defaults
2. User configuration outside the repository
3. Project policy without credentials
4. Runtime command-line overrides

Secrets belong in environment variables or secure host credential systems.

## Testing strategy

- Pure core unit tests
- Adapter golden fixtures
- Property tests for pass-through stability
- Security regression tests
- Fake-upstream gateway tests
- Streaming tests
- MCP authorisation tests
- Cross-platform skill sync tests
- End-to-end Codex and Claude smoke tests
