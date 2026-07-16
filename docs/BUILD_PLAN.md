# Context Diet Build Plan

## How to use this plan

The numbered copy-paste prompts are in:

`docs/UPDATED_BUILD_PROMPTS_CODEX_AND_CLAUDE.md`

This file explains the order and checkpoints.

## Phase 0: Prepare the repository

Goal: create the instruction and planning foundation before writing production code.

Deliverables:

- Root project files
- pnpm workspace
- TypeScript strict configuration
- Test runner
- CI
- Documentation checks
- Shared provider compatibility matrix

Checkpoint:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Phase 1: Prove both transport paths

Goal: remove the biggest uncertainty first.

Build a fake local gateway that can:

- Receive a Codex Responses request
- Receive a Claude Code Messages request
- Forward each to a fake upstream
- Stream a fake response back
- Redact credentials from logs

Do not build compression yet.

Checkpoint:

- Codex routes through the fake gateway
- Claude Code routes through the fake gateway
- Both stream
- No real API keys are needed
- Captured fixtures are sanitised

Stop the project if either host cannot be routed in a documented and supportable way. Do not bury
this risk under weeks of feature work.

## Phase 2: Build the provider-neutral core

Goal: create one internal language for context.

Deliverables:

- Normalised request types
- Block source categories
- Risk categories
- Decision types
- Reason-code catalogue
- Immutable transformation result
- Pass-through representation

Checkpoint:

- OpenAI fixtures normalise correctly
- Anthropic fixtures normalise correctly
- Same semantic content produces equivalent internal blocks

## Phase 3: Exactness Firewall and policy

Goal: protect exact and sensitive values before any renderer exists.

Deliverables:

- Protected pattern scanner
- Secret scanner
- User-defined pattern support
- Safe mode policy
- Profitability placeholder
- Unknown-risk handling

Checkpoint:

- Secrets never become render-eligible
- Code and current instructions remain native
- Unknown input remains native
- Every decision includes a reason code

## Phase 4: Vault and retrieval

Goal: make transformations reversible.

Deliverables:

- Project and session IDs
- Stable block IDs
- Local storage
- Integrity hashes
- Expiry
- Delete-session command
- MCP exact retrieval
- Authorisation and size limits

Checkpoint:

- A valid block can be retrieved narrowly
- Another project cannot retrieve it
- Traversal fails
- Deleted sessions cannot be read
- Raw content is absent from normal logs

## Phase 5: Renderer integration

Goal: add image compression behind a strict interface.

Deliverables:

- Renderer contract
- pxpipe adapter or approved alternative
- Model profiles
- Exact sidecar
- Glyph check
- Golden render tests
- Failure pass-through

Checkpoint:

- Only policy-approved blocks reach the renderer
- Every image maps to a vault block
- A renderer failure sends original text
- Secret test values never appear in generated images

## Phase 6: Complete provider adapters

Goal: rebuild valid provider requests.

Deliverables:

- OpenAI Responses parser and builder
- Anthropic Messages parser and builder
- Tool-pair preservation
- Image content support
- Cache field preservation
- Unknown-shape pass-through

Checkpoint:

- Round-trip fixtures remain equivalent when no transformation is selected
- Tool state remains valid
- Streaming remains valid

## Phase 7: Production local gateway

Goal: replace the feasibility gateway with a safe service.

Deliverables:

- Localhost binding
- Upstream allowlist
- Timeouts
- Cancellation
- Size limits
- Header redaction
- Health endpoint
- Kill switch
- Safe mode default
- Structured metrics

Checkpoint:

- Security and integration suites pass
- Unsupported routes pass through or reject according to documented policy
- No raw bodies or credentials appear in logs

## Phase 8: CLI and operator experience

Goal: make the system usable by a non-expert.

Deliverables:

- doctor
- audit
- start
- stop
- status
- explain
- benchmark
- delete-session
- uninstall

Checkpoint:

- Commands use plain language
- Errors explain the next action
- No command requires manual database editing

## Phase 9: Savings and benchmarking

Goal: prove whether the product works for the user's workload.

Deliverables:

- Provider-aware token accounting
- Cache-aware reporting
- Comparable run rules
- Control and optimised runs
- Test outcome capture
- Model profile expiry
- Report generation

Checkpoint:

- The system can honestly report positive, neutral or negative results
- No baseline means no saving percentage
- Model or price changes invalidate comparisons

## Phase 10: Dashboard

Goal: show what happened without exposing raw context.

Deliverables:

- Context X-ray
- Safe savings
- Risk ledger
- Model health
- Session controls
- Share-card preview

Checkpoint:

- Raw content hidden by default
- Forbidden fields cannot enter share-card output
- Kill switch is obvious

## Phase 11: Shared skill and packaging

Goal: provide one workflow to both agent hosts.

Deliverables:

- Canonical skill
- Sync script
- Drift check
- Codex installation copy
- Claude Code installation copy
- Platform-specific plugin packaging
- MCP setup guidance

Checkpoint:

- Both skills load
- Explicit invocation works
- Trigger descriptions are accurate
- Skill never claims it transformed its own invoking request
- Generated copies match the canonical source

## Phase 12: Security and release

Goal: prepare a trustworthy beta.

Deliverables:

- Security review
- Threat-model update
- Dependency audit
- Crash cleanup tests
- Installer and uninstaller
- Beta checklist
- Known limitations

Checkpoint:

- No open critical or high security issue
- Full compatibility suite passes
- Safe mode is default
- Documentation matches actual commands
