# Context Diet Agent Instructions

## Source of truth

Before major planning or implementation, read:

1. `docs/CONTEXT_DIET_BLUEPRINT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DUAL_PLATFORM_COMPATIBILITY.md`
4. `docs/SECURITY_MODEL.md`
5. `docs/ACCEPTANCE_CRITERIA.md`
6. `docs/DECISIONS.md`

For a small task, read only the relevant documents and code.

## Product rule

Context Diet must support both OpenAI Codex and Anthropic Claude Code.

Treat both as first-class hosts. Do not build for one and leave the other as a future adapter.

## Architecture rules

- Keep the core engine provider-neutral.
- Put OpenAI Responses logic only in the OpenAI adapter.
- Put Anthropic Messages logic only in the Anthropic adapter.
- Use one normalised internal request and block model.
- Preserve provider-specific fields required for caching, tools, streaming and authentication.
- Unknown endpoints, content blocks or request shapes must pass through unchanged.
- The skill operates the engine. The skill alone does not transform its own invoking request.
- Keep the canonical skill in `skill-source/context-diet/`.
- Generate platform copies under `.agents/skills/` and `.claude/skills/`.
- Fail CI when generated skill copies drift from the canonical source.

## Safety rules

- Default to Safe mode.
- Current instructions, code, diffs, commands, exact values and active tool state stay as native
  text.
- Never render or persist secrets.
- Never log authentication headers or raw request bodies.
- Every transformation must have a reason code.
- Every recoverable image block must map to an authorised local source block.
- If parsing, scanning, rendering, storage, profile validation or rebuilding fails, send the
  original content unchanged.
- Never claim savings without a valid comparable baseline.
- Never weaken a safety rule merely to improve the displayed saving.

## Technology rules

- TypeScript with strict mode.
- Node.js 24 LTS or Node.js 26.
- pnpm 11 workspaces.
- Small packages with explicit interfaces.
- Pure deterministic functions for policy decisions where possible.
- No `any` without a written reason.
- Validate untrusted input at boundaries.
- Pin important dependency versions through the lockfile.
- Do not add a production dependency without explaining why it is needed.

## Required checks

Before marking a task complete, run the relevant commands:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:compatibility
pnpm check:skills
```

If a command does not exist yet, state that clearly. Do not pretend it passed.

## Testing rules

For every transport or message transformation feature, add:

- Provider-neutral unit tests
- OpenAI Responses fixtures
- Anthropic Messages fixtures
- Pass-through tests for unsupported input
- Tool-call pairing tests
- Streaming tests where relevant
- Secret-redaction and raw-log absence tests
- Failure-path tests

Use fake providers and fake keys in tests. Never use a real user request or secret as fixture data.

## Working style

- Inspect existing files before editing.
- Make the smallest coherent change.
- Explain the plan before broad refactors.
- Do not silently reverse an architecture decision.
- Record meaningful new decisions in `docs/DECISIONS.md`.
- Report files changed, commands run, test results, risks and next step.
