# Codex Setup

Use this file only for Codex-specific setup troubleshooting.

Codex should route future model calls through the local Context Diet gateway using the currently
supported Codex custom-provider configuration.

Do not write real API keys or provider credentials into the repository.

## Configuration Locations

- User configuration: `~/.codex/config.toml`
- Project instructions: `AGENTS.md`
- Optional project-local metadata: `.codex/` when present
- Generated skill copy: `.agents/skills/context-diet/`

## Custom Provider Dry Run

Use the local setup generator for a safe dry run:

```bash
context-diet setup codex
```

The generator prints the TOML it will manage and does not write user configuration without
confirmation. It must not include provider credentials.

Illustrative provider shape:

```toml
model_provider = "context_diet_local"

[model_providers.context_diet_local]
name = "Context Diet local gateway"
base_url = "http://127.0.0.1:4317"
requires_openai_auth = true
```

`requires_openai_auth = true` lets Codex reuse the Codex auth state the user already signed in with.
API-key users can still use an API-key Codex login; subscription users should stay signed in
normally.

## Skill Discovery and Invocation

Codex discovers the generated skill copy under `.agents/skills/context-diet/`. Invoke it by asking
for Context Diet audits, diagnostics, benchmarks, setup help or exact retrieval.

## MCP Retrieval

Register the local exact-retrieval MCP server without credentials:

```json
{
  "mcpServers": {
    "context-diet-retrieval": {
      "command": "context-diet",
      "args": ["mcp", "retrieval"],
      "env": {}
    }
  }
}
```

Verify:

- Codex loaded `AGENTS.md`
- The Context Diet skill appears
- The custom provider points at loopback
- Local status shows the expected upstream and Safe mode
- A fake-provider test passes before a real canary

## Restore and Uninstall

- Restore direct routing by switching `model_provider` back to the previous direct provider.
- Remove the `context_diet_local` provider block after direct routing works.
- Remove `context-diet-retrieval` from MCP configuration to disable exact retrieval.
- Stop the local Context Diet gateway.
