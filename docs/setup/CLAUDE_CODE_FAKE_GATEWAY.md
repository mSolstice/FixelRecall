# Claude Code Fake Gateway Setup

These notes are for the Prompt 3 transport feasibility spike only. They use fake routing and fake
credentials.

1. Start the local Context Diet fake gateway with the smoke script or a future CLI wrapper.
2. Note the loopback base URL, for example `http://127.0.0.1:4317`.
3. Point Claude Code at the local gateway for Anthropic Messages traffic:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:4317"
export ANTHROPIC_API_KEY="fake-anthropic-key-for-local-routing-only"
```

Verify route status with the gateway health endpoint:

```bash
curl http://127.0.0.1:4317/health
```

Do not commit shell profiles containing real keys. Restore direct routing by unsetting
`ANTHROPIC_BASE_URL`:

```bash
unset ANTHROPIC_BASE_URL
```
