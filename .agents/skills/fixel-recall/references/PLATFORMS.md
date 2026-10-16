# Platforms

Use `fixel-recall platform doctor` before changing host configuration.

- Codex CLI and the Codex IDE extension share the user-level `.codex/config.toml`.
- Claude Code CLI and its VS Code integration share Claude Code settings.
- On Windows, local MCP commands started through `npx` require the generated `cmd /c npx` wrapper.
- On WSL, run the gateway and coding host inside the same distribution for the initial canary.
- Cursor is supported only through the Codex IDE extension. Do not claim that Fixel Recall routes
  Cursor's native AI traffic.
- A configured platform is not release-supported until its CI and local canary evidence pass.
- Never request, print or write credentials during platform diagnosis.

Detailed operator guidance lives in `docs/PLATFORM_AND_IDE_SUPPORT.md`.
