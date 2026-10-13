# Astra API Canary: Preparation Only

Step 8 does not send provider traffic, read credentials or change user configuration. This is an
API-key route test, not a Codex subscription, image-compression or savings test.

## Exact Terminal Command

Run this in Terminal to display the plan only:

```bash
cd "/Users/manojshinde/Documents/Fixel Recall/fixel_recall_build_pack_v2"
node scripts/prepare-astra-api-canary.mjs
```

The script lives in the repository, not a temporary folder. It cannot execute a provider request. It
rejects execution flags. No API key is needed for preparation.

## Proposed Request

```json
{
  "model": "gpt-6-astra",
  "input": "SYNTHETIC CANARY ONLY. Reply with exactly: Fixel Recall real-provider canary passed.",
  "max_output_tokens": 50,
  "reasoning": { "effort": "low" },
  "service_tier": "default",
  "store": false
}
```

Proposed generation path: local `http://127.0.0.1:4318/v1/responses` to
`https://api.openai.com/v1/responses`. Use a dedicated Safe-mode gateway with only the OpenAI origin
allowed. Do not change the existing service on port 4317.

No tools, files, images, repository content, private prompts or history are included. One generation
attempt maximum, no retries. A truncated or unexpected answer is a failed canary. Keep
authentication in memory; record only status, usage, timing and exact-answer match.

## Budget Gate

Maximum total: USD 0.10. Proposed input ceiling: 200 tokens. Output ceiling: 50 tokens, including
reasoning tokens. Do not infer input tokens from character count.

The published standard rates reviewed on 2026-10-13 are USD 10 per million input tokens and USD 50
per million output tokens. Using USD 12.50 for input as a conservative cache-write rate, 200 input
plus 50 output tokens would reserve USD 0.005 for generation. This is conditional arithmetic, not
proof of a total billing cap or actual usage. Reverify rates before execution.

The documented `/v1/responses/input_tokens` endpoint can count the complete request, but calling it
is itself provider traffic. Its billing bound has not been verified here. Do not call it, assume it
is free, or fill the gateway's trusted evidence with guessed token counts.

Execution remains blocked until exact input-count evidence, all request billing bounds, fresh
prices, and output-cap support are established. A future runner must bind that evidence to the exact
request hash and reserve one attempt before forwarding. A timeout is not a billing cap.

## Stop And Restore

Before an approved real run, exercise the dedicated gateway's kill switch locally and confirm status
before resuming it. During a run, the emergency command is:

```bash
curl --noproxy '*' -sS -X POST http://127.0.0.1:4318/runtime/kill-switch
```

Stop on invalid evidence, wrong mode/origin, authentication error, unexpected response, timeout,
usage outside the approved envelope or suspected disclosure. No automatic retries. Abort in-flight
work and close the dedicated gateway. Cancellation cannot undo provider usage already incurred. No
host configuration will be installed, so no normal routing restoration should be necessary.

## Step 9 Result

The local execution rehearsal is implemented, but real execution is still blocked. The official
sources were rechecked on 2026-10-13: standard generation prices and the output-token limit are
documented. The reviewed token-counting documentation does not establish the counting endpoint's
price. Its absence is not evidence that the endpoint is free. The exact input count also remains
unmeasured. Therefore this step did not resolve the full budget gate.

To repeat the fake-only rehearsal in Terminal:

```bash
cd "/Users/manojshinde/Documents/Fixel Recall/fixel_recall_build_pack_v2"
pnpm build
node scripts/rehearse-astra-api-canary.mjs --fake success
```

The runner creates its own loopback fake upstream and Safe gateway on temporary ports, exercises the
kill switch, forwards an unchanged synthetic request, checks the exact answer, verifies a second
generation is blocked and closes both servers. It does not touch port 4317 or 4318, user settings or
real credentials. It does not accept an external endpoint or a real-execution flag. Reports contain
safe metadata only and are labelled SYNTHETIC TEST DATA. The synthetic token allowance must never be
copied into real admission evidence.

Regression cases cover success, provider error, redirect rejection, incorrect answer, expired
evidence and rejection of real-execution arguments. Failure does not refund the generation
reservation. These are local gateway tests, not real Astra, Codex CLI or subscription evidence.

The next real-execution prerequisite is authoritative billing information for token counting (or
another verified input-token bound). Do not repeatedly approve identical preparation steps or raise
the budget to hide missing evidence. No Terminal key setup is needed while this is blocked. A
separate final confirmation must list every provider request and its total budget before real
execution is enabled.

## Sources

- [Astra model rates](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [Input counting and output limits](https://developers.openai.com/api/docs/guides/token-counting)

No new model profile is approved. Astra context remains native.
