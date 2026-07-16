# Context Diet Build Pack Review

Prepared: 14 July 2026

## Documents found

- `AGENTS.md`
- `CLAUDE.md`
- `00_START_HERE.md`
- `README.md`
- `PACK_MANIFEST.json`
- `docs/ACCEPTANCE_CRITERIA.md`
- `docs/ARCHITECTURE.md`
- `docs/BEGINNER_STEP_BY_STEP_GUIDE.md`
- `docs/BUILD_PLAN.md`
- `docs/CONTEXT_DIET_BLUEPRINT.md`
- `docs/DECISIONS.md`
- `docs/DUAL_PLATFORM_COMPATIBILITY.md`
- `docs/FILE_PLACEMENT_MAP.md`
- `docs/SECURITY_MODEL.md`
- `docs/UPDATED_BUILD_PROMPTS_CODEX_AND_CLAUDE.md`
- `skill-source/context-diet/SKILL.md`
- `skill-source/context-diet/references/BENCHMARKING.md`
- `skill-source/context-diet/references/CLAUDE_CODE_SETUP.md`
- `skill-source/context-diet/references/CODEX_SETUP.md`
- `skill-source/context-diet/references/OPERATIONS.md`
- `skill-source/context-diet/references/SAFETY.md`
- `skill-source/context-diet/references/TROUBLESHOOTING.md`

## Project instruction loading

- Codex project rules are present in `AGENTS.md`.
- Claude Code rules are present in `CLAUDE.md`, which imports the shared `AGENTS.md` rules with
  `@AGENTS.md`.
- Both files are concise and point major work back to the repository documents instead of
  duplicating the full blueprint.

## Contradictions found

No architecture contradiction was found in the reviewed documents.

The core product direction is consistent across the blueprint, architecture, compatibility contract,
security model, acceptance criteria and decisions:

- Codex and Claude Code are both first-class MVP hosts.
- OpenAI Responses logic belongs in the OpenAI adapter.
- Anthropic Messages logic belongs in the Anthropic adapter.
- The core engine and policy layer must remain provider-neutral.
- The skill and local gateway are separate components.
- Unknown input must pass through unchanged.
- Safe mode is the default.
- Fake-provider transport proof comes before compression or renderer work.

## Missing decisions

- The repository has not been initialised with Git in this working folder. The beginner guide
  expects `git init` and an initial build-pack commit before numbered implementation work continues.
- The exact supported Codex custom provider configuration is intentionally deferred until the
  transport feasibility spike.
- The exact storage implementation details for the vault remain recommended rather than final. The
  architecture currently recommends SQLite metadata with content files or SQLite blobs.
- The renderer implementation choice is intentionally adapter-based. pxpipe is expected to be
  compatible, but the final integration must preserve the renderer boundary.

## Top five build risks

1. Transport compatibility: Codex custom-provider routing and Claude Code `ANTHROPIC_BASE_URL`
   routing must both work with fake upstreams before the core is built.
2. Provider leakage: OpenAI or Anthropic wire shapes could accidentally leak into the
   provider-neutral core or policy layer.
3. Secret exposure: request bodies, authentication headers, secrets, tool output or rendered images
   could be logged or persisted.
4. Exactness corruption: compressed or rendered content could cause the model to misread paths,
   commands, IDs, versions, numbers or code.
5. Skill drift: the canonical skill in `skill-source/context-diet/` could diverge from generated
   Codex and Claude Code copies unless sync and drift checks are enforced.

## Recommended first checkpoint

Complete Prompt 1 next: create the non-destructive environment checker.

Before starting Prompt 1, initialise Git and save the build pack if the user approves:

```bash
git init
git add .
git commit -m "Add Context Diet build pack"
```

Prompt 1 should not install tools automatically. It should report the local operating system, Git,
Node.js 24 LTS or Node.js 26, pnpm 11, Codex CLI, Claude Code CLI, repository status and required
project files using clear `PASS`, `WARN` and `FAIL` output.

## No-code status

Prompt 0 created this review document only. No production application code was added.
