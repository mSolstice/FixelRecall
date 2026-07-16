# Codex Setup

Codex should connect through a custom model provider whose `base_url` points at the local Context
Diet gateway.

Use the repository's generated setup command or current official Codex configuration guidance.

Never write a real API key into the repository.

Verify:

- Codex loaded `AGENTS.md`
- The Context Diet skill appears
- The custom provider points at loopback
- `context-diet status` shows the expected upstream
- A fake-provider test passes before a real canary
