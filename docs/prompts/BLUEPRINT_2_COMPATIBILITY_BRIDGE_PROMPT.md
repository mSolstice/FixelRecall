# Blueprint 2 Compatibility Bridge Prompt

We have completed the original Fixel Recall prompts through Prompt 10.

We intend to complete original Prompts 11–29 before implementing the Blueprint 2 extension.

Do not implement Blueprint 2 product features yet.

Read:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/FIXEL_RECALL_BLUEPRINT.md`
- `docs/FIXEL_RECALL_BLUEPRINT_2_0_COMPLETION_EXTENSION.md`
- `docs/SYNTHETIC_TEST_DATA_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY_MODEL.md`
- `docs/DECISIONS.md`
- `docs/ACCEPTANCE_CRITERIA.md`

First inspect the existing repository and verify what was actually completed through Prompt 10.

Create:

`docs/BLUEPRINT_2_COMPATIBILITY_BRIDGE.md`

The document must identify the architectural extension points that original Prompts 11–29 must
preserve for:

1. Personal compatibility audit
2. Explicit not-worth-using verdicts
3. Monthly savings projections
4. One-command onboarding
5. Dedicated renderer doctor
6. GitHub benchmark badges
7. Local compatibility leaderboard
8. Per-user adaptive compression
9. Signed model-profile registry
10. Automatic model-change canaries
11. Multilingual glyph profiles
12. Team policy distribution
13. Tamper-evident enterprise audit
14. Editor extension
15. Transactional uninstall and rollback

Inspect the current implementation and either add or confirm provider-neutral interfaces for:

- `ModelProfileSource`
- `PolicySource`
- `UsageHistorySource`
- `BenchmarkEvidenceStore`
- `AuditEventSink`
- `CompatibilityEvaluator`
- `SavingsProjectionEngine`
- `RendererHealthService`

Do not add an interface merely because its name appears here.

For each proposed interface:

- Identify the Blueprint 2 capability that needs it.
- Check whether an equivalent interface already exists.
- Reuse or extend an existing interface where reasonable.
- Avoid duplicate abstractions.
- Keep OpenAI and Anthropic wire types outside the core.
- Keep implementation details out of the interface.
- Add only the smallest structure required to prevent architectural lock-in.

Permanent simulation rules:

- Use fake providers and synthetic data only.
- Do not require or request OpenAI or Anthropic credentials.
- Do not call real provider APIs.
- Do not connect to public registries, leaderboards, telemetry or marketplaces.
- Do not silently modify real user-level Codex or Claude Code settings.
- Generated benchmark, projection, badge and leaderboard outputs must be labelled synthetic.
- Prompt 28 may create a real-provider canary plan, but it must not execute one.

Do not broadly refactor working Prompt 0–10 code.

Do not implement the Blueprint 2 features themselves.

Preserve existing public APIs unless a change is required to prevent a clear architectural problem.

Where a public API must change:

- Explain why.
- Add a compatibility layer or migration.
- Add regression tests.
- Record the decision in `docs/DECISIONS.md`.

Verify that the existing architecture can later support:

- Local and remote model-profile sources
- Local and team policy sources
- Synthetic and future measured usage histories
- Local and future publishable benchmark evidence
- Local and future enterprise audit sinks
- CLI, dashboard and editor-extension clients
- Signed registry verification
- Adaptive policy proposals and rollback

Add or update tests only where minimal interface changes require them.

Run all existing project checks, including whichever of these currently exist:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:compatibility
pnpm check:skills
```

Do not claim a command passed if it does not exist or was not run.

Stop after creating the compatibility bridge document and making only the minimal architectural
changes required.

Report:

1. Files inspected
2. Files changed
3. Existing interfaces reused
4. New interfaces added
5. Interfaces deliberately not added
6. Tests run
7. Exact results
8. Risks deferred to Blueprint 2
9. Confirmation whether original Prompt 11 can proceed safely
