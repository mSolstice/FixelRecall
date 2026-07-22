# Fake-Provider Beta Report

Run date: 2026-07-21

Scope: complete local fake-provider beta using synthetic inputs, fake credentials, loopback servers
and temporary local state only.

No real credentials were used. No private repository content was sent to a provider. The beta
harness uses synthetic request bodies and temporary test configuration under the OS temp directory,
then removes that temporary configuration during uninstall.

## Command Ledger

| Step                          | Command                  | Result                                                                                                                                    |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Install dependencies       | `pnpm install`           | PASS. Dependencies were already up to date. pnpm exited `0`; it printed a non-fatal registry metadata warning for its own update check.   |
| 2. Build                      | `pnpm build`             | PASS. TypeScript project build completed.                                                                                                 |
| 3. Run environment doctor     | `pnpm check:environment` | PASS. Detected Darwin, Git, Node.js 26, pnpm 11, Codex CLI, Claude Code CLI, Git repository, `AGENTS.md`, `CLAUDE.md` and blueprint docs. |
| 4-16. Complete fake beta flow | `pnpm beta:fake`         | PASS. Full loopback fake-provider beta completed.                                                                                         |

## Beta Flow Results

| Step                                                      | Result | Evidence                                                                                                                                 |
| --------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 4. Start local gateway                                    | PASS   | Local production gateway started on loopback in Safe mode with a loopback fake upstream.                                                 |
| 5. Connect fake Codex client                              | PASS   | Fake Codex client used provider family `openai` and route `/v1/responses`.                                                               |
| 6. Complete one text and one tool-call flow               | PASS   | Codex text request returned `200`; completed function-call/function-call-output flow returned `200`.                                     |
| 7. Connect fake Claude Code client                        | PASS   | Fake Claude Code client used provider family `anthropic` and route `/v1/messages`.                                                       |
| 8. Complete one text and one tool-use flow                | PASS   | Claude Code text request returned `200`; completed `tool_use`/`tool_result` flow returned `200`.                                         |
| 9. Transform one safe recoverable block                   | PASS   | Policy decision was `RENDER_RECOVERABLE`; deterministic fake renderer produced one image.                                                |
| 10. Retrieve one exact section through MCP from each host | PASS   | Shared `get_exact_context` MCP returned the same narrow synthetic section to Codex and Claude Code callers; each returned 48 characters. |
| 11. Run benchmark                                         | PASS   | Synthetic benchmark produced three comparable runs with `dataOrigin: synthetic`.                                                         |
| 12. Open dashboard smoke test                             | PASS   | Dashboard smoke verified Context X-ray, Safe savings, Risk ledger, Model health, Session control and Compatibility leaderboard cards.    |
| 13. Trigger kill switch                                   | PASS   | Gateway returned `503` for a provider request after the runtime kill switch was enabled.                                                 |
| 14. Restore direct fake routing                           | PASS   | Direct fake Codex and Claude Code routes bypassed the gateway and returned `200` from the fake upstream.                                 |
| 15. Delete session                                        | PASS   | After deleting the local vault session, MCP retrieval returned an empty result.                                                          |
| 16. Uninstall local test configuration                    | PASS   | Temporary fake Codex and Claude Code config previews were removed. No user configuration was written.                                    |

## Final `pnpm beta:fake` Result

```text
PASS
4. start local gateway: PASS
5. connect fake Codex client: PASS
6. complete one text and one tool-call flow: PASS
7. connect fake Claude Code client: PASS
8. complete one text and one tool-use flow: PASS
9. transform one safe recoverable block: PASS
10. retrieve one exact section through MCP from each host: PASS
11. run benchmark: PASS
12. open dashboard smoke test: PASS
13. trigger kill switch: PASS
14. restore direct fake routing: PASS
15. delete session: PASS
16. uninstall local test configuration: PASS
```

## Privacy Result

- Provider credentials were fake values only.
- The harness checks structured gateway logs for fake credential values.
- No raw private repository content is used by the harness.
- Temporary fake host configuration is written only under a temporary test directory and removed
  before completion.
- Exact retrieval content is synthetic and stored in a temporary local vault.

## Notes

- This is a fake-provider beta. It proves local protocol behavior and safety invariants against
  deterministic fake providers, not real OpenAI or Anthropic accounts.
- The beta runs with loopback servers, so sandboxed environments may require local loopback
  permission.
