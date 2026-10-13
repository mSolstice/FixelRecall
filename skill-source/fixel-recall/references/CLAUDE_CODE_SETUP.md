# Claude Code Setup

Use this file only for Claude Code-specific setup troubleshooting.

Claude Code should route future Messages requests through the local Fixel Recall gateway using the
currently supported Claude Code base-URL configuration.

Do not write real API keys or provider credentials into the repository.

## Configuration Locations

- User settings: `~/.claude/settings.json`
- Project settings: `.claude/settings.json` when intentionally used
- Project instructions: `CLAUDE.md`, importing `AGENTS.md`
- Generated skill copy: `.claude/skills/fixel-recall/`

## Gateway Preview

Use the local setup generator for a safe preview:

```bash
fixel-recall setup claude-code
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

Claude Code discovers the generated skill copy under `.claude/skills/fixel-recall/`. Invoke it by
asking for Fixel Recall audits, diagnostics, benchmarks, setup help or exact retrieval.

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

## Optional SessionStart Doctor Hook

Hooks are optional. Do not require them for Fixel Recall operation.

Non-destructive example:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "command": "fixel-recall status --no-credentials",
        "description": "Local Fixel Recall status check"
      }
    ]
  }
}
```

Verify:

- Claude Code loaded `CLAUDE.md`
- `CLAUDE.md` imported `AGENTS.md`
- The Fixel Recall skill appears
- Local status shows the expected gateway and Safe mode
- MCP exact retrieval is configured
- A fake-provider test passes before a real canary

## Restore and Uninstall

- Restore direct routing by unsetting `ANTHROPIC_BASE_URL`.
- Remove Fixel Recall base-URL settings from shell profiles or Claude Code settings.
- Remove optional SessionStart hooks if added.
- Remove `fixel-recall-retrieval` from MCP configuration to disable exact retrieval.
- Stop the local Fixel Recall gateway.
