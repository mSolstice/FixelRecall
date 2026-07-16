# Claude Code Setup

Claude Code should connect through the local Context Diet gateway using `ANTHROPIC_BASE_URL` or the current supported gateway configuration.

Use the repository's generated setup command.

Never write a real credential into the repository.

Verify:

- Claude Code loaded `CLAUDE.md`
- `CLAUDE.md` imported `AGENTS.md`
- The Context Diet skill appears
- Claude status shows the expected gateway
- MCP exact retrieval is configured
- A fake-provider test passes before a real canary
