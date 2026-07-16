# Gateway Setup

Context Diet runs as a local loopback gateway. By default it binds to `127.0.0.1`, starts in Safe
mode, and only forwards to explicitly allowlisted upstream provider URLs.

## Starting

Build the workspace first:

```bash
pnpm build
```

Start the gateway from the CLI package once a launcher is added, or from a small local script that
calls `createLocalGateway` with:

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
{ "status": "ok", "gateway": "context-diet-local", "mode": "safe" }
```

For route and metric status:

```bash
curl http://127.0.0.1:PORT/status
```

## Connecting Codex

Point Codex at the local OpenAI-compatible route:

```text
OPENAI_BASE_URL=http://127.0.0.1:PORT/v1
```

Requests to `/v1/responses` will go through Context Diet and then to the allowlisted OpenAI
upstream.

## Connecting Claude Code

Point Claude Code at the local Anthropic-compatible route:

```text
ANTHROPIC_BASE_URL=http://127.0.0.1:PORT
```

Requests to `/v1/messages` will go through Context Diet and then to the allowlisted Anthropic
upstream.

## Confirming Active Route

Check `/status` and confirm:

- `mode` is `safe` unless bypass was intentionally enabled
- `killSwitchActive` is `false`
- provider request counts increase when Codex or Claude Code sends traffic
- `rawBodiesPersisted` is `false`
- `authValuesRetained` is `false`

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

To bypass Context Diet completely, restore the provider base URL in the host tool:

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
