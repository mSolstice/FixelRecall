---
name: context-diet
description: Audit, operate, benchmark and troubleshoot the local Context Diet gateway for Codex or Claude Code. Use for coding-agent context waste, token reduction, exact-context recovery, compression decisions, gateway health, model-profile checks and privacy-safe benchmark reports.
---

# Context Diet

Use this skill to operate and explain the local Context Diet engine.

## Boundaries

- The local gateway transforms future provider requests.
- This skill cannot compress the same request that invoked it.
- Safe mode is the default.
- Exact, current, secret-sensitive and unknown-risk content stays protected.
- A benchmark may show positive, neutral or negative savings.

## Workflow

1. Identify the user's goal: doctor, audit, start, stop, status, explain, benchmark, retrieve or troubleshoot.
2. Check that the project is the intended repository.
3. Use the local CLI or deterministic scripts.
4. Never request or print a provider credential.
5. Explain decisions using reason codes.
6. Stop on security or authorisation failure.
7. Report what was measured versus estimated.

## References

Read only the relevant file:

- `references/OPERATIONS.md`
- `references/SAFETY.md`
- `references/BENCHMARKING.md`
- `references/TROUBLESHOOTING.md`
- `references/CODEX_SETUP.md`
- `references/CLAUDE_CODE_SETUP.md`
