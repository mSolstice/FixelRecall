# Claude Code Setup

Use this file only for Claude Code-specific setup troubleshooting.

Claude Code should route future Messages requests through the local Context Diet gateway using the
currently supported Claude Code base-URL configuration.

Do not write real API keys or provider credentials into the repository.

## Configuration Locations

- User settings: `~/.claude/settings.json`
- Project settings: `.claude/settings.json` when intentionally used
- Project instructions: `CLAUDE.md`, importing `AGENTS.md`
- Generated skill copy: `.claude/skills/context-diet/`

## Gateway Preview

Use the local setup generator for a safe preview:

```bash
context-diet setup claude-code
```

The generator prints shell/settings snippets and does not overwrite user settings without
confirmation. It must not include provider credentials.

Illustrative shell shape:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:4317"
```

Keep `ANTHROPIC_API_KEY` in the normal secret store, not in repository files.

## Status Verification

Check local status after routing:

- gateway running
- upstream allowlisted
- Safe mode or explicit Bypass
- provider path shown without credentials
- fake-provider test passes before a real canary

## Skill Discovery and Invocation

Claude Code discovers the generated skill copy under `.claude/skills/context-diet/`. Invoke it by
asking for Context Diet audits, diagnostics, benchmarks, setup help or exact retrieval.

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

## Optional SessionStart Doctor Hook

Hooks are optional. Do not require them for Context Diet operation.

Non-destructive example:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "command": "context-diet status --no-credentials",
        "description": "Preview-only local Context Diet status check"
      }
    ]
  }
}
```

Verify:

- Claude Code loaded `CLAUDE.md`
- `CLAUDE.md` imported `AGENTS.md`
- The Context Diet skill appears
- Local status shows the expected gateway and Safe mode
- MCP exact retrieval is configured
- A fake-provider test passes before a real canary

## Restore and Uninstall

- Restore direct routing by unsetting `ANTHROPIC_BASE_URL`.
- Remove Context Diet base-URL settings from shell profiles or Claude Code settings.
- Remove optional SessionStart hooks if added.
- Remove `context-diet-retrieval` from MCP configuration to disable exact retrieval.
- Stop the local Context Diet gateway.
