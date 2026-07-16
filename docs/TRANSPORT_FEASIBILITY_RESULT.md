# Transport Feasibility Result

Prepared: 15 July 2026

## Scope

This Prompt 3 spike proves fake local gateway routing only.

It does not add compression, rendering, vault storage, provider parsing, provider request rebuilding
or real upstream model calls.

## What was proven

- A local fake gateway can expose `GET /health`.
- A Codex/OpenAI Responses-shaped request can route through `POST /v1/responses`.
- A Claude Code/Anthropic Messages-shaped request can route through `POST /v1/messages`.
- Both fake provider routes can return streaming server-sent-event style responses.
- Both fake provider routes can return provider-style errors.
- Request IDs are preserved from `x-request-id` when present, otherwise generated locally.
- The fake gateway has request timeout settings and a clean shutdown helper.
- Structured logs include route, method, provider family, status code, request ID, duration and
  redaction flags.
- Structured logs do not include request bodies or authentication values.
- Smoke scripts verify both routes using fake authentication headers only.

## What remains unproven

- Real Codex custom-provider configuration has not been exercised against this gateway.
- Real Claude Code `ANTHROPIC_BASE_URL` routing has not been exercised against this gateway.
- Real OpenAI and Anthropic upstream forwarding is not implemented.
- Provider header preservation is not complete beyond fake route receipt.
- Streaming cancellation, upstream disconnects and production timeout behaviour need deeper tests.
- Unknown endpoint pass-through policy is not final; this spike returns a documented `404`.
- No compression, scanner, Exactness Firewall, vault, renderer or retrieval flow is included.

## Exact routes used

```text
GET  /health
POST /v1/responses
POST /v1/messages
```

## Streaming result

OpenAI route:

- Fixture: `tests/fixtures/openai/streaming-response.sse`
- Smoke command: `pnpm smoke:openai`
- Result: PASS
- Observed stream markers: `response.output_text.delta`, `[DONE]`

Anthropic route:

- Fixture: `tests/fixtures/anthropic/streaming-response.sse`
- Smoke command: `pnpm smoke:anthropic`
- Result: PASS
- Observed stream markers: `message_start`, `content_block_delta`, `message_stop`

## Authentication handling result

The fake smoke and unit tests used fake credential values:

```text
fake-openai-header-value
fake-openai-smoke-key
fake-anthropic-header-value
fake-anthropic-smoke-key
```

The tests assert those values do not appear in structured logs. Tests also assert body canaries do
not appear in structured logs:

```text
BODY_CANARY_OPENAI_DO_NOT_LOG
BODY_CANARY_ANTHROPIC_DO_NOT_LOG
```

No real credentials were added to fixtures, setup notes, source files or logs.

## Setup notes

- Codex fake gateway notes: `docs/setup/CODEX_FAKE_GATEWAY.md`
- Claude Code fake gateway notes: `docs/setup/CLAUDE_CODE_FAKE_GATEWAY.md`

These documents intentionally use fake credentials and loopback URLs only.

## Blockers

No blocker was found for continuing to the next build prompt.

The local Codex sandbox blocks loopback listening unless the command is run with approval. The fake
gateway tests and smoke scripts pass when loopback binding to `127.0.0.1` is allowed. This is a
sandbox permission constraint, not a product transport failure.

## Go or no-go recommendation

GO for the next checkpoint.

Continue to the provider-neutral internal model only after preserving this transport spike and its
fixtures. Do not add compression until both provider paths remain green through future adapter and
proxy changes.
