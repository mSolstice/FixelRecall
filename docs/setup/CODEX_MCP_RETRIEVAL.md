# Codex MCP Retrieval Setup

This note describes the intended local setup for the Context Diet exact retrieval MCP server.

## Tool

```text
get_exact_context
```

Inputs:

- `project_id`
- `session_id`
- `block_id`
- `query` or `line_start` plus `line_end`
- `max_chars`

The tool returns only a narrow authorised section from the local vault. It does not accept
filesystem paths and it does not require provider credentials.

## Local Configuration Shape

Add the local Context Diet retrieval MCP server to the Codex MCP configuration using your local
package command once the CLI wrapper is wired:

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

Do not place OpenAI API keys, provider headers or raw repository paths in this MCP configuration.
The retrieval server authorises by opaque Context Diet project/session/block IDs.

## Safety Expectations

- Invalid IDs return no content.
- Wrong project or session returns no content.
- Expired or deleted session content returns no content.
- Returned content is capped by `max_chars`.
- Logs contain safe metadata only, not retrieved exact text.
