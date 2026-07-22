# Real Provider Canary Plan

Status: plan only. Do not run yet.

This plan describes the first real-provider canary after fake-provider beta success. It must use
Safe mode only, synthetic prompts only and explicit user consent. It must not use private source
code, private prompts, repository contents or real customer data.

## Consent Gate

Do not start until the user explicitly confirms all of the following in the same session:

1. "I consent to run the real-provider canary."
2. The provider account or workspace to use.
3. The maximum token and cost budget.
4. Confirmation that only the synthetic prompt below may be sent.
5. Confirmation that Safe mode and the kill switch are available.

If any consent item is missing, stop.

## Safety Mode

- Required mode: Safe only.
- Bypass, Balanced, Max and Lab Mode are not allowed for this canary.
- No private source code, file paths, repository names, prompts, diffs, commands, credentials or
  customer data may be included.
- Exact and secret-sensitive content must remain native and must not be rendered.

## Minimal Synthetic Prompt

Use this exact prompt for both hosts:

```text
SYNTHETIC CANARY ONLY. Reply with exactly: Context Diet real-provider canary passed.
```

Expected answer:

```text
Context Diet real-provider canary passed.
```

If the model returns extra text, treat the route as reachable but the canary as not strictly passed.

## Expected Request Paths

Codex real-provider canary:

- Host route into Context Diet: `http://127.0.0.1:<gateway-port>/v1/responses`
- Gateway upstream: allowlisted OpenAI-compatible Responses origin
- Provider protocol: OpenAI Responses-shaped request

Claude Code real-provider canary:

- Host route into Context Diet: `http://127.0.0.1:<gateway-port>/v1/messages`
- Gateway upstream: allowlisted Anthropic Messages origin
- Provider protocol: Anthropic Messages-shaped request

The gateway must bind to loopback only.

## Credential Handling

- Do not place credentials in the repository, fixtures, docs, shell history examples, MCP config,
  skill files, dashboard state, logs or reports.
- Codex credentials must remain in the normal Codex/provider secret mechanism, such as an
  environment-variable reference like `OPENAI_API_KEY`, not a literal value.
- Claude Code credentials must remain in the normal Claude Code/provider secret mechanism, such as
  `ANTHROPIC_API_KEY`, not a literal value.
- The gateway may forward authentication headers in memory only.
- The gateway must never log authentication values.
- Evidence must refer to credentials only as "credential present" or "credential omitted"; never
  record header values.

## Maximum Budget

Set a hard pre-run budget before starting:

- Maximum requests: 2 total, one Codex and one Claude Code.
- Maximum input tokens: 200 per request.
- Maximum output tokens: 50 per request.
- Maximum total cost: USD 0.10 or a lower user-approved amount.
- Maximum wall-clock time: 2 minutes per request.

If the user-approved budget is lower than these values, the lower budget wins. If any budget value
cannot be enforced or estimated, stop before sending a real-provider request.

## Preflight Checklist

This repository includes a no-traffic preflight command. It validates local canary readiness from
explicit environment values and repository evidence, then exits before any provider request can be
sent.

Example:

```bash
CONTEXT_DIET_CANARY_MODE=Safe \
CONTEXT_DIET_GATEWAY_BASE_URL=http://127.0.0.1:<gateway-port> \
CONTEXT_DIET_UPSTREAM_ALLOWLIST=https://api.openai.example,https://api.anthropic.example \
CONTEXT_DIET_KILL_SWITCH_READY=true \
CONTEXT_DIET_FAKE_BETA_PASSED=true \
CONTEXT_DIET_RAW_BODY_LOGGING=false \
CONTEXT_DIET_CANARY_MAX_REQUESTS=2 \
CONTEXT_DIET_CANARY_MAX_INPUT_TOKENS=200 \
CONTEXT_DIET_CANARY_MAX_OUTPUT_TOKENS=50 \
CONTEXT_DIET_CANARY_MAX_COST_USD=0.10 \
pnpm canary:preflight
```

The example origins above are placeholders. Replace them with the exact intended provider origins
only after the user has identified the provider account or workspace. Do not include paths, query
strings, usernames, passwords or API keys in the allowlist.

The preflight verifies:

- Safe mode only.
- Gateway base URL is loopback.
- Upstream allowlist is set to exact origins.
- Kill switch has been manually verified as reachable.
- Fake beta has passed.
- Raw-body logging is explicitly disabled.
- No credential-like values are present in repository files scanned by the preflight.
- Request, token and cost budgets are configured within this plan's limits.

The preflight does not:

- send provider traffic
- send the synthetic prompt
- read provider credentials
- write host configuration
- prove real-provider support

Run fake checks first:

```bash
pnpm beta:fake
pnpm check:environment
pnpm check:skills
pnpm canary:preflight
```

Confirm:

- Fake beta passes.
- Safe mode is active.
- Gateway status shows loopback binding.
- Upstream allowlist contains only the intended real provider origin.
- Kill switch endpoint is reachable.
- No raw body logging is enabled.
- No real credentials appear in repo files or generated local evidence.

## Codex Test

Purpose: verify Codex custom-provider routing through the local gateway with one synthetic
Responses-shaped request.

Procedure:

1. Confirm explicit consent.
2. Start the gateway in Safe mode.
3. Configure Codex custom provider base URL to the loopback gateway.
4. Use the minimal synthetic prompt exactly.
5. Set maximum output tokens to 50 or less.
6. Send one request only.
7. Capture status, request ID, route, provider family, token usage if available, latency and whether
   the expected text was returned.

Immediate pass criteria:

- Route recorded as `/v1/responses`.
- Gateway status increments the OpenAI provider request count.
- No credential or raw request body appears in logs, traces, metrics, snapshots, temp files,
  dashboard output or generated evidence.
- Response is successful and within budget.

## Claude Code Test

Purpose: verify Claude Code `ANTHROPIC_BASE_URL` routing through the local gateway with one
synthetic Messages-shaped request.

Procedure:

1. Confirm explicit consent.
2. Start the gateway in Safe mode.
3. Set `ANTHROPIC_BASE_URL` to the loopback gateway for this test session only.
4. Use the minimal synthetic prompt exactly.
5. Set maximum output tokens to 50 or less.
6. Send one request only.
7. Capture status, request ID, route, provider family, token usage if available, latency and whether
   the expected text was returned.

Immediate pass criteria:

- Route recorded as `/v1/messages`.
- Gateway status increments the Anthropic provider request count.
- No credential or raw request body appears in logs, traces, metrics, snapshots, temp files,
  dashboard output or generated evidence.
- Response is successful and within budget.

## Confirm Gateway Route

Before and after each request:

```bash
context-diet status --no-credentials
```

Confirm:

- `bindHost` is `127.0.0.1` or `::1`.
- Mode is Safe.
- Kill switch is off before the request.
- Provider request counters change for the expected provider only.
- Current upstream is displayed without credentials.
- No unknown route receives traffic.

## Confirm No Credential Or Raw Body Was Logged

Inspect only safe metadata stores:

- Gateway structured logs
- Metrics/status output
- Traces or snapshots, if enabled
- Temp test directory
- Dashboard output
- Generated evidence report
- Vault records
- Audit events

Search for:

- Literal synthetic prompt text
- Any credential-like value supplied by the host
- `Authorization`
- `x-api-key`
- `OPENAI_API_KEY=`
- `ANTHROPIC_API_KEY=`
- Bearer token-like strings

Allowed evidence:

- Request ID
- Route
- Provider family
- HTTP status
- Byte count
- Timing
- Safe error code
- Token usage if provider returns it

If raw body text or credential material appears anywhere, trigger the kill switch and stop.

## Kill-Switch Procedure

Use immediately on any safety, cost, route or logging concern:

```bash
curl -X POST http://127.0.0.1:<gateway-port>/runtime/kill-switch
context-diet status --no-credentials
```

Expected result:

- Kill switch is active.
- Further gateway provider requests return a disabled/blocked response.
- No additional provider requests are sent.

## Route Restoration

Codex:

- Restore the previous direct provider configuration.
- Remove or disable the Context Diet custom provider entry for the test session.
- Confirm Codex no longer points at the loopback gateway.

Claude Code:

- Unset `ANTHROPIC_BASE_URL` for the test session.
- Remove any temporary shell/session setting used for the canary.
- Confirm Claude Code no longer points at the loopback gateway.

Do not remove normal provider credentials from the user's secret store.

## Rollback

If anything fails or the user asks to stop:

1. Trigger the kill switch.
2. Stop the local gateway.
3. Restore direct routing for Codex and Claude Code.
4. Remove temporary MCP or host routing entries created for the test.
5. Delete temporary Context Diet session/vault data created for the canary.
6. Keep only safe metadata evidence.
7. Do not retry until the failure is documented and explicitly approved.

## Evidence To Capture

Capture only safe metadata:

- User consent text or reference to explicit consent, without credentials.
- Timestamp.
- Host: Codex or Claude Code.
- Gateway route: `/v1/responses` or `/v1/messages`.
- Request ID.
- Gateway mode: Safe.
- Upstream origin, with credentials stripped.
- HTTP status.
- Token usage if available.
- Cost estimate and actual billed usage if available.
- Latency.
- Provider request counter before and after.
- Kill switch status before and after.
- Route restoration confirmation.
- Log/body/credential absence scan result.

Do not capture:

- Raw request body beyond the approved synthetic prompt reference.
- Raw provider credentials.
- Private repository path, branch, code, diffs or prompts.
- User identity or account identifiers unless the user explicitly approves a non-secret label.

## Immediate Stop Conditions

Stop immediately and do not send further real-provider requests if any condition occurs:

- Missing explicit user consent.
- Mode is not Safe.
- Gateway is not bound to loopback.
- Upstream origin is missing, unexpected or not allowlisted.
- Any credential appears in logs, status, dashboard, reports, temp files or evidence.
- Raw request body persistence is detected.
- The prompt differs from the approved synthetic prompt.
- A private repository file, path, branch, code fragment, prompt or diff is about to be sent.
- Token, cost or time budget cannot be enforced.
- Provider request count changes for the wrong provider.
- Unknown route receives traffic.
- Kill switch fails to activate.
- Route restoration cannot be confirmed.
- Any real-provider error suggests authentication, quota, account or policy risk.

## Final Gate

After the plan is reviewed, the next step must be a separate user message with explicit approval to
run the canary. Until then, do not run a real-provider test.
