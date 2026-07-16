@AGENTS.md

# Claude Code-specific instructions

Claude Code must follow the shared project rules imported above.

## Claude-specific integration

- Keep Anthropic Messages parsing and rebuilding inside `packages/providers-anthropic`.
- Preserve `tool_use` and `tool_result` relationships.
- Preserve Anthropic cache-control fields and required beta headers.
- Preserve streaming event order and event types.
- Treat unknown content block types as pass-through.
- Test gateway routing through `ANTHROPIC_BASE_URL` using a fake upstream before any real credential
  is used.
- Use Claude Code hooks only for optional setup, checks or operator convenience. Hooks are not the
  core request-transformation engine.
- Put the installable project skill under `.claude/skills/context-diet/`.
- Keep `SKILL.md` concise. Put detailed procedures in one-level reference files.
- Use `/memory` or equivalent inspection to verify this file loads when diagnosing instruction
  problems.

## Completion check

Do not call a feature complete until its equivalent Codex path is also implemented and tested,
unless the task is explicitly labelled as a provider-specific bug.
