# Gateway Setup

Fixel Recall runs as a local loopback gateway. By default it binds to `127.0.0.1`, starts in Safe
mode, and only forwards to explicitly allowlisted upstream provider URLs.

## Starting

Build the workspace first:

```bash
pnpm build
```

Start the API gateway in a Terminal and leave that Terminal open:

```bash
node packages/cli/dist/index.js start --host 127.0.0.1 --port 4317
```

Library callers can instead call `createLocalGateway` with:

- `upstreams.openai`
- `upstreams.anthropic`
- `upstreamAllowlist`

Use fake credentials only in examples. Real provider credentials should be supplied by your host
tool and are kept in memory only while a request is forwarded.

## Checking Health

```bash
curl http://127.0.0.1:PORT/health
```

Expected response:

```json
{ "status": "ok", "gateway": "fixel-recall-local", "mode": "safe" }
```

For route and metric status:

```bash
curl http://127.0.0.1:PORT/status
```

## Connecting Codex

For API-key routing, use a Codex custom provider with `wire_api = "responses"`,
`env_key = "OPENAI_API_KEY"`, `requires_openai_auth = false`, and this base URL:

```text
base_url = "http://127.0.0.1:PORT/v1"
```

Requests to `/v1/responses` will go through Fixel Recall and then to the allowlisted OpenAI
upstream.

ChatGPT subscription routing is not supported or claimed by the default setup. The gateway's
documented authentication path is an API key kept in the normal provider secret store. No real
subscription test has been performed.

## Connecting Claude Code

Point Claude Code at the local Anthropic-compatible route:

```text
ANTHROPIC_BASE_URL=http://127.0.0.1:PORT
```

Requests to `/v1/messages` will go through Fixel Recall and then to the allowlisted Anthropic
upstream.

## Confirming Active Route

Check `/status` and confirm:

- `mode` is `safe` unless bypass was intentionally enabled
- `killSwitchActive` is `false`
- provider request counts increase when Codex or Claude Code sends traffic
- `metrics.rawBodiesPersisted` is `false`
- `metrics.authValuesRetained` is `false`

These two safety fields are nested under `metrics`, not at the top level of the `/status` response.

## Runtime Controls

Enable runtime bypass:

```bash
curl -X POST http://127.0.0.1:PORT/runtime/bypass
```

Return to Safe mode:

```bash
curl -X POST http://127.0.0.1:PORT/runtime/safe
```

Activate the kill switch:

```bash
curl -X POST http://127.0.0.1:PORT/runtime/kill-switch
```

Resume forwarding:

```bash
curl -X POST http://127.0.0.1:PORT/runtime/resume
```

## Restoring Direct Routing

To bypass Fixel Recall completely, restore the provider base URL in the host tool:

```text
OPENAI_BASE_URL=https://api.openai.com/v1
ANTHROPIC_BASE_URL=https://api.anthropic.com
```

Remove any temporary local gateway environment variables from your shell profile or project
configuration.

## Stopping

Stop the process with `Ctrl-C`, or call the gateway `close()` method from the launcher. Shutdown
closes the HTTP server cleanly.

## Troubleshooting

- `upstream_not_allowed`: add the exact upstream origin to `upstreamAllowlist`.
- `kill_switch_active`: call `/runtime/resume` or restart the gateway.
- `request_too_large`: reduce request size or raise the configured request-size limit.
- `provider_error`: the allowlisted upstream returned an error; check provider status and
  credentials.
- No route activity: confirm Codex or Claude Code is pointing at the local base URL and not the
  direct provider URL.
