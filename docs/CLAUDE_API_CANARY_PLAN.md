# Claude API Canary: Preparation Only

This is an API-key route plan, not a Claude Code subscription test. It does not send provider
traffic until a separate final confirmation.

## Model And Request

The proposed pinned model is `claude-haiku-4-5-20251001`. It is active but legacy, with retirement
not sooner than October 15, 2026. The request contains one synthetic user message, no tools, images,
files, cache controls or private content:

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 32,
  "messages": [
    {
      "role": "user",
      "content": "SYNTHETIC CANARY ONLY. Reply with exactly: Fixel Recall Claude canary passed."
    }
  ],
  "stream": false
}
```

The intended path is `http://127.0.0.1:4318/v1/messages` to `https://api.anthropic.com/v1/messages`.
Safe mode and the upstream allowlist are mandatory.

## Budget

The total cap is USD 0.10. The proposed ceilings are 200 input tokens and 32 output tokens, with one
attempt and no retries. The reviewed Anthropic price is USD 1 per million input tokens and USD 5 per
million output tokens. The conservative generation bound is USD 0.00036. Cache fields and tools are
deliberately excluded because they introduce additional accounting requirements.

Anthropic documents cache-write and cache-read multipliers and tool overhead. Those features are
unsupported by this tiny canary and must not be added silently.
[Official Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)

The exact provider-reported input count has not been obtained. The local synthetic upper bound is
admission evidence for fake tests only, not real usage evidence.

## Terminal Preparation

From the repository:

```bash
cd "/Users/manojshinde/Documents/Fixel Recall/fixel_recall_build_pack_v2"
pnpm build
node scripts/prepare-claude-api-canary.mjs
```

The dedicated gateway can be prepared without starting it:

```bash
node packages/cli/dist/index.js start --canary --canary-provider anthropic --host 127.0.0.1 --port 4318 --dry-run
```

It allows only the Anthropic origin and deliberately has no trusted budget evidence, so real
generation remains blocked until a later approval step.

The preparation script does not read `ANTHROPIC_API_KEY`, does not open a socket and rejects run
flags. The fake rehearsal is:

```bash
node scripts/rehearse-claude-api-canary.mjs --fake success
```

It creates its own loopback servers, verifies the kill switch, unchanged forwarding, safe logs,
one-attempt reservation and cleanup. It sends no request to Anthropic.

## Stop Conditions

Stop immediately for a non-Safe mode, wrong upstream, missing or excessive output cap,
authentication error, unexpected response, timeout, unknown usage, budget uncertainty or any
suspected secret/body logging. The kill switch for a future dedicated gateway is:

```bash
curl --noproxy '*' -sS -X POST http://127.0.0.1:4318/runtime/kill-switch
```

No user configuration is changed. Close the dedicated gateway after the run; direct Claude routing
remains unchanged.

No real Claude request is authorized by this preparation step. A future final confirmation must list
the exact request, route and total budget.
