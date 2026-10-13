# Codex Setup

Use this file only for Codex-specific setup troubleshooting.

Codex should route future model calls through the local Fixel Recall gateway using the currently
supported Codex custom-provider configuration.

Do not write real API keys or provider credentials into the repository.

## Configuration Locations

- User configuration: `~/.codex/config.toml`
- Project instructions: `AGENTS.md`
- Optional project-local metadata: `.codex/` when present
- Generated skill copy: `.agents/skills/fixel-recall/`

## Custom Provider Dry Run

Use the local setup generator for a safe dry run:

```bash
fixel-recall setup codex
```

The generator prints the TOML it will manage and does not write user configuration without
confirmation. It must not include provider credentials.

Illustrative API-key provider shape:

```toml
model_provider = "fixel_recall_local"

[model_providers.fixel_recall_local]
name = "Fixel Recall local gateway"
base_url = "http://127.0.0.1:4317/v1"
wire_api = "responses"
env_key = "OPENAI_API_KEY"
requires_openai_auth = false
```

For ChatGPT sign-in, `requires_openai_auth = true` reuses Codex authentication, but requires a
subscription-compatible gateway upstream. Do not send a subscription token to the API-key route or
assume that forwarding Authorization establishes subscription support.

The opt-in `start --codex-auth subscription` gateway exposes `/backend-api/codex/responses` and
`/backend-api/codex/models`, forwarding only to the configured ChatGPT backend. The corresponding
custom-provider base URL ends in `/backend-api/codex`, not `/v1`. The general setup generator does
not yet select that new route. Keep experiments isolated until setup and real-host checks pass.

Use `start --codex-auth subscription --canary --dry-run` for a no-traffic readiness plan. The canary
guard blocks generation without a request output cap and reviewed budget evidence. An unknown model
stays native; successful routing does not approve image compression.

## Skill Discovery and Invocation

Codex discovers the generated skill copy under `.agents/skills/fixel-recall/`. Invoke it by asking
for Fixel Recall audits, diagnostics, benchmarks, setup help or exact retrieval.

## MCP Retrieval

Register the local exact-retrieval MCP server without credentials:

```json
{
  "mcpServers": {
    "fixel-recall-retrieval": {
      "command": "fixel-recall",
      "args": ["mcp", "retrieval"],
      "env": {}
    }
  }
}
```

Verify:

- Codex loaded `AGENTS.md`
- The Fixel Recall skill appears
- The custom provider points at loopback
- Local status shows the expected upstream and Safe mode
- A fake-provider test passes before a real canary

## Restore and Uninstall

- Restore direct routing by switching `model_provider` back to the previous direct provider.
- Remove the `fixel_recall_local` provider block after direct routing works.
- Remove `fixel-recall-retrieval` from MCP configuration to disable exact retrieval.
- Stop the local Fixel Recall gateway.
