# Codex and Claude Code Compatibility Contract

## Goal

A Fixel Recall release is not complete when it merely has two folders named after two platforms.

Both hosts must be able to route requests, use the operator skill, call exact retrieval and complete
the same benchmark flow.

## Shared capabilities

| Capability                      |                            Codex |                       Claude Code |
| ------------------------------- | -------------------------------: | --------------------------------: |
| Persistent project instructions |                      `AGENTS.md` | `CLAUDE.md` importing `AGENTS.md` |
| Project skill                   |                `.agents/skills/` |                 `.claude/skills/` |
| Shared Agent Skills format      |                              Yes |                               Yes |
| Local gateway routing           | Custom model provider `base_url` |              `ANTHROPIC_BASE_URL` |
| Common exact retrieval          |                              MCP |                               MCP |
| Provider request format         |                 OpenAI Responses |                Anthropic Messages |
| Streaming support               |                         Required |                          Required |
| Tool state preservation         |       Function calls and outputs |      `tool_use` and `tool_result` |
| Optional platform automation    |    Codex configuration or plugin |            Claude hooks or plugin |

## Shared skill policy

Canonical source:

`skill-source/fixel-recall/`

Generated copies:

- `.agents/skills/fixel-recall/`
- `.claude/skills/fixel-recall/`

The shared `SKILL.md` should contain only features available on both platforms.

Platform-specific setup belongs in references such as:

- `references/CODEX_SETUP.md`
- `references/CLAUDE_CODE_SETUP.md`

## Codex configuration concept

A developer should be able to configure a project or user profile that points Codex at a Context
Diet custom provider.

Illustrative only:

```toml
model = "YOUR_SUPPORTED_MODEL"
model_provider = "fixel_recall"

[model_providers.fixel_recall]
name = "Fixel Recall local gateway"
base_url = "http://127.0.0.1:YOUR_PORT"
requires_openai_auth = false
env_key = "OPENAI_API_KEY"
```

The generated Codex configuration keeps `model_provider` at the TOML root and uses API-key
authentication. Subscription-session reuse through the gateway is not supported or claimed.

Never commit real user-level configuration or API keys.

## Claude Code configuration concept

A developer should be able to route Claude Code through the local gateway using an environment
variable:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:YOUR_PORT"
```

Credential handling depends on the gateway setup. The installer must not guess or overwrite a user's
authentication method without confirmation.

Verify the active route through Claude Code status information.

## Adapter equivalence

For equivalent semantic input, both adapters should produce comparable normalised blocks.

Example:

| Semantic element | OpenAI                   | Anthropic               |
| ---------------- | ------------------------ | ----------------------- |
| User text        | Input message item       | User message text block |
| Tool request     | Function call            | `tool_use`              |
| Tool result      | Function call output     | `tool_result`           |
| Image            | Image input item         | Image content block     |
| Cached content   | Provider-specific fields | Cache-control fields    |

Do not force both providers into identical wire output. Equivalence belongs in the internal model
and policy result.

## Required compatibility fixtures

For each provider:

1. Small text request
2. Long old history
3. Completed tool call
4. Active tool call
5. Image input
6. Cached content
7. Unknown content block
8. Malformed tool pair
9. Streaming response
10. Provider error
11. Cancellation
12. Oversized body
13. Secret canary
14. Recoverable compressed block
15. Kill-switch pass-through

## Cross-platform test matrix

Every relevant pull request should report:

```text
Core unit tests: PASS/FAIL
OpenAI adapter: PASS/FAIL
Anthropic adapter: PASS/FAIL
Codex fake-gateway smoke: PASS/FAIL
Claude fake-gateway smoke: PASS/FAIL
Codex skill load: PASS/FAIL
Claude skill load: PASS/FAIL
MCP retrieval from Codex: PASS/FAIL
MCP retrieval from Claude: PASS/FAIL
Skill drift check: PASS/FAIL
```

## Platform-specific features

Platform-only features are allowed when:

- They do not change the core safety policy.
- They are isolated in a platform package.
- The equivalent essential workflow remains available on the other host.
- Documentation clearly labels the difference.

Example:

Claude hooks may run `fixel-recall doctor` at session start. Codex may use a different setup
mechanism. The core product must still work without either convenience feature.

## Compatibility release gate

Do not publish a release as dual-compatible unless both hosts pass:

- Installation
- Gateway route
- One normal conversation
- One tool-use conversation
- Streaming
- Exact retrieval
- Benchmark
- Uninstall or route restoration
