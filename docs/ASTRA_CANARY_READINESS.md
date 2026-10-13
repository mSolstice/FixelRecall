# Astra Canary Readiness

Status: local fake-provider testing only. Real Astra traffic is still blocked.

## What Was Observed

The installed Codex CLI completed a local fake-provider run through a temporary Safe-mode gateway.
It sent one streaming Responses request for `gpt-6-astra`: 49,724 request bytes, 7 input items, and
28,731 input-text characters. `max_output_tokens` was absent. These are observations from one local
CLI build, not token counts or provider usage. The fake response's usage values must not be treated
as measurements.

The test used an empty generated project, isolated Codex state, a fake key and a macOS sandbox that
blocked non-loopback network access and reads of the real home directory. It did not validate
subscription authentication, account access, image compression or savings.

## Explicit Subscription Routing

API-key traffic continues to use `/v1/responses` and `https://api.openai.com/v1/responses`.
Subscription mode instead exposes these routes:

| Method | Local path                     | Upstream                                          |
| ------ | ------------------------------ | ------------------------------------------------- |
| POST   | `/backend-api/codex/responses` | `https://chatgpt.com/backend-api/codex/responses` |
| GET    | `/backend-api/codex/models`    | `https://chatgpt.com/backend-api/codex/models`    |

The optional models `client_version` query is validated and forwarded. Other query parameters are
rejected. Subscription mode forwards the bearer header and `ChatGPT-Account-ID` in memory; it does
not log them, inspect tokens to guess an upstream, forward cookies, or follow redirects. The account
header is not forwarded to the API-key or Anthropic routes. Request bodies and streamed provider
output remain unchanged. Unknown subscription paths are rejected locally.

This is a local implementation of the documented routing contract. It does not establish that a
particular personal subscription is entitled to use Astra through a custom gateway. Current official
gateway guidance describes managed workspace configuration; personal-account access remains to be
verified explicitly. No fallback to API billing is performed.

## Terminal: Preparation Only

From the Fixel Recall repository, build and show the plan without starting a server:

```bash
pnpm build
node packages/cli/dist/index.js start --codex-auth subscription --canary --dry-run
```

The following starts a separate guarded gateway, but should only be run at the approved startup
step. It does not change host configuration or make requests on startup:

```bash
node packages/cli/dist/index.js start --codex-auth subscription --canary --host 127.0.0.1 --port 4318
```

It allows at most one models lookup and blocks generation unless the full request passes canary
admission. CLI `--canary` deliberately supplies no invented cost evidence, so it cannot currently
admit a real generation. It is a readiness guard, not an operational real-canary runner.

An isolated Codex provider would use `http://127.0.0.1:4318/backend-api/codex` as its base URL,
`wire_api = "responses"`, `requires_openai_auth = true`, and `supports_websockets = false`. Do not
install this into normal user configuration yet. The existing general setup installer does not
select this new subscription route. This step changes no real user settings.

## Enforceable Limits And Remaining Budget Gap

The opt-in gateway admission guard enforces:

- Safe mode and an exact provider/model match.
- A maximum request body of 65,536 bytes in the CLI preparation preset.
- A positive output cap of at most 50 tokens, present in the request already. No cap is injected.
- Exactly one generation attempt per gateway lifetime, reserved before the upstream call.
- No automatic refund after failure, cancellation, kill-switch activation or resume.
- A cost ceiling no higher than USD 0.10 using explicitly reviewed evidence.

The trusted `CanaryLimits.evidence` supplied through the local service API must bind the exact
request bytes by SHA-256 to a verified input-token upper bound, input/output prices, an expiry, and
evidence that the specific upstream actually enforces the output cap. The request hash also binds
model, service tier, tools and other billing-sensitive fields. The reviewer must include all
billable input, framing, reasoning, caching and tool costs or declare the request unsupported. Do
not approve hosted tools, images, external context references, extra charges or pricing modes that
the two-rate calculation cannot bound. Evidence is trusted operator configuration, not provider
certification and not a field accepted from a client request.

Missing, expired or mismatched evidence blocks forwarding. Concurrent requests cannot exceed the
reservation. Restarting creates a new reservation scope; never restart to bypass a used budget.
Cross-process/cumulative accounting across multiple gateways is not implemented.

The previous 200-input-token allowance cannot be assumed sufficient for Codex's full request. At the
published standard Astra API rates of USD 10 per million input tokens and USD 50 per million output
tokens, a 50-token output allowance reserves USD 0.0025. A USD 0.10 total then leaves room for at
most 9,750 input tokens under those assumptions. These rates are API reference prices, not a claim
about personal subscription billing. Fast mode, tool fees or other charges invalidate this
calculation.

The observed 28,731 text characters do not establish that input bound. The installed CLI also did
not emit an output cap, and subscription-backend cap support is unverified. Consequently, the
realistic next budget is still **not approved for execution**: measure or conservatively bound the
entire request, establish upstream cap support, and present any change to the earlier token
allowance for user approval. Never silently raise the cost limit or trim protected context.

The related Sign in with ChatGPT plan-usage API documentation explicitly lists `max_output_tokens`
as unsupported. That is a separate integration from the managed Codex gateway, but reinforces that
API-key output-limit support cannot be assumed for subscription traffic. Do not add the field
blindly or treat a timeout as a billing cap.

## Local Checks

```bash
pnpm exec vitest run packages/proxy/src/subscription.test.ts packages/proxy/src/canary.test.ts packages/cli/src/gateway-config.test.ts
```

All fixtures use fake authentication and loopback servers. They cover account-header isolation,
model discovery, streaming order, tool-state pass-through, rejected queries, authentication,
allowlisting, redirects, timeout, in-flight kill-switch cancellation, and budget admission for both
OpenAI-shaped and Anthropic-shaped requests. These do not constitute a real-host pass.

Validation on 2026-10-13: formatting, lint, typecheck, build and skill sync passed; the full suite
passed 325 tests in 20 files, compatibility passed 3 tests, both smoke tests passed, and the full
fake beta passed. Thirty tests cover the new routing and admission work.

An additional installed-CLI test used the new subscription path with an isolated fake key and
external networking blocked. It completed one fake response. With the canary guard enabled, the CLI
exited with a blocked request (HTTP 409) and zero upstream calls, as intended. Each run scanned 78
temporary artifacts: no synthetic-prompt or fake-key matches. The first guarded harness assertion
expected the CLI to display the structured error code; it does not. The final assertion uses the
actual gateway status and upstream call count, while unit tests verify the error code directly. No
real account was used.

## Stop And Restore

For an approved guarded gateway on port 4318:

```bash
curl --noproxy '*' -sS -X POST http://127.0.0.1:4318/runtime/kill-switch
```

The kill switch stops new forwarding and aborts in-flight upstream requests. This cannot undo usage
already incurred at a provider. Stop the foreground process with Ctrl-C. Temporary CLI overrides end
with that process; since no user configuration is installed, there is nothing to roll back in normal
Codex settings. Do not alter the separately running gateway on port 4317.

## Official Sources

- [Sign in with ChatGPT through a gateway](https://learn.chatgpt.com/docs/enterprise/sign-in-with-chatgpt-through-a-gateway)
- [Codex authentication](https://learn.chatgpt.com/docs/auth)
- [GPT-6 Astra model and pricing](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [ChatGPT plan-usage API limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

Reviewed on 2026-10-13. Recheck pricing and provider requirements before approving real traffic.
