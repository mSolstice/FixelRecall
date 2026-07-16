# Claude Code MCP Retrieval Setup

This note describes the intended local setup for the Context Diet exact retrieval MCP server in
Claude Code.

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

The tool returns a narrow authorised exact section from the local Context Diet vault. It does not
accept direct filesystem paths and it does not need Anthropic credentials.

## Local Configuration Shape

Register a local MCP server for Claude Code using your local Context Diet command once the CLI
wrapper is wired:

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

Do not place `ANTHROPIC_API_KEY`, provider headers or raw repository paths in this MCP
configuration. The retrieval server uses opaque Context Diet IDs and local vault authorisation.

## Safety Expectations

- Invalid IDs return no content.
- Wrong project or session returns no content.
- Expired or deleted session content returns no content.
- Returned content is capped by `max_chars`.
- Logs contain safe metadata only, not retrieved exact text.
