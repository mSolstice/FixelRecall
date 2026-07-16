# Context Diet Build Pack: Start Here

## What this folder is

This is the founder-ready build pack for **Context Diet Version 2**.

Context Diet is a local, safety-first context optimiser for AI coding agents. It is designed to work
with:

- OpenAI Codex CLI and IDE
- Anthropic Claude Code CLI and IDE
- OpenAI Responses-shaped requests
- Anthropic Messages-shaped requests

The product reduces waste in long AI coding sessions without treating exact code, paths, IDs,
commands, numbers, secrets, or current instructions as disposable.

## The one rule that matters

Do not ask Codex or Claude Code to build everything in one giant prompt.

Run one numbered prompt at a time from:

`docs/UPDATED_BUILD_PROMPTS_CODEX_AND_CLAUDE.md`

After each prompt:

1. Read the agent's summary.
2. Confirm that tests passed.
3. Save the work with Git.
4. Move to the next prompt only after the current checkpoint works.

## Which files should be placed in the repository

Copy this entire folder into a new Git repository.

The most important files are:

| File                                             | Why it exists                                           |
| ------------------------------------------------ | ------------------------------------------------------- |
| `AGENTS.md`                                      | Permanent project rules for Codex                       |
| `CLAUDE.md`                                      | Loads the shared rules for Claude Code                  |
| `docs/CONTEXT_DIET_BLUEPRINT.md`                 | Full product source of truth                            |
| `docs/ARCHITECTURE.md`                           | Technical boundaries and data flow                      |
| `docs/BUILD_PLAN.md`                             | Build phases and order                                  |
| `docs/ACCEPTANCE_CRITERIA.md`                    | What "done" actually means                              |
| `docs/SECURITY_MODEL.md`                         | What must never leak or be corrupted                    |
| `docs/DECISIONS.md`                              | Important choices that agents must not casually reverse |
| `docs/DUAL_PLATFORM_COMPATIBILITY.md`            | Codex and Claude Code compatibility contract            |
| `docs/BEGINNER_STEP_BY_STEP_GUIDE.md`            | Plain-language setup instructions                       |
| `docs/UPDATED_BUILD_PROMPTS_CODEX_AND_CLAUDE.md` | Copy-paste prompts                                      |
| `skill-source/context-diet/SKILL.md`             | Canonical skill instructions                            |

## Do I upload the blueprint into every chat?

No.

Keep the blueprint in the repository at:

`docs/CONTEXT_DIET_BLUEPRINT.md`

Codex and Claude Code can read it from the project when needed. `AGENTS.md` and `CLAUDE.md` tell
them where it lives.

For major work, explicitly say:

> Read the blueprint and architecture documents before changing code.

For a tiny bug, ask the agent to read only the relevant files. Do not reload the whole blueprint for
every comma-level change.

## Important warning

The skill itself cannot rewrite the same request that invoked the skill.

Actual context transformation requires the local Context Diet proxy or gateway to sit between the
coding agent and the model provider.

The skill is the operator. The proxy is the engine.

## Recommended order

1. Read `docs/BEGINNER_STEP_BY_STEP_GUIDE.md`.
2. Install the prerequisites.
3. Create and open the repository.
4. Run Prompt 0.
5. Run Prompt 1.
6. Continue one prompt at a time.
7. Do not connect real API keys until fake-provider tests pass.
8. Start with Safe mode.
9. Benchmark before making any savings claim.

## Version

Context Diet Build Pack Version 2.0  
Prepared: 14 July 2026
