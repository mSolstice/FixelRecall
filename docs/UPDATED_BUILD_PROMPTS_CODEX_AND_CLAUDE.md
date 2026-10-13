# Fixel Recall Updated Build Prompts

## Read this first

These prompts are written so you can paste them into either Codex or Claude Code.

Run them in order.

Do not paste the whole document into one chat.

At the end of every prompt, the agent must:

- List files changed
- List commands run
- Report test results
- Report unresolved risks
- Stop at the requested checkpoint

After every successful prompt, make a Git commit.

---

# Prompt 0: Verify the build pack

## Copy and paste

```text
We are starting the Fixel Recall project.

Do not write production code.

1. Inspect the repository.
2. Confirm that you loaded the correct project instructions.
3. Read:
   - AGENTS.md
   - CLAUDE.md
   - 00_START_HERE.md
   - docs/FIXEL_RECALL_BLUEPRINT.md
   - docs/ARCHITECTURE.md
   - docs/DUAL_PLATFORM_COMPATIBILITY.md
   - docs/SECURITY_MODEL.md
   - docs/ACCEPTANCE_CRITERIA.md
   - docs/DECISIONS.md
4. Check whether any files contradict each other.
5. Confirm that Codex and Claude Code are both first-class MVP hosts.
6. Confirm that the skill and local gateway are separate components.
7. Create docs/BUILD_PACK_REVIEW.md containing:
   - documents found
   - contradictions found
   - missing decisions
   - top five build risks
   - recommended first checkpoint
8. Do not change the approved architecture unless you identify a real contradiction.

Stop after the review. Report files changed and no-code status.
```

## You should see

- One review document
- No application code
- Clear mention of both platforms

---

# Prompt 1: Check the computer and tools

## Copy and paste

```text
Read the project instructions.

Create a non-destructive environment checker at scripts/check-environment.mjs.

It must check and clearly report:
- operating system
- Git availability
- Node.js major version
- pnpm major version
- Codex CLI availability
- Claude Code CLI availability
- whether the current folder is a Git repository
- whether AGENTS.md and CLAUDE.md exist
- whether the blueprint exists

Required versions:
- Node.js 24 LTS or Node.js 26
- pnpm 11

Do not install anything automatically.
Do not read or print credentials.
Use simple PASS, WARN and FAIL messages with a suggested next action.

Add a package.json only if needed to run the checker.
Add tests for the checker's pure version-parsing logic.
Run the checker and tests.

Stop after reporting the result.
```

---

# Prompt 2: Scaffold the TypeScript monorepo

## Copy and paste

```text
Read:
- AGENTS.md
- CLAUDE.md
- docs/ARCHITECTURE.md
- docs/BUILD_PLAN.md
- docs/DECISIONS.md

Create the approved TypeScript monorepo using Node.js 24 LTS or Node.js 26 and pnpm 11.

Use the simplest package layout that preserves these boundaries:
- provider-neutral core
- OpenAI provider adapter
- Anthropic provider adapter
- local proxy
- vault
- retrieval MCP server
- renderer interface
- CLI
- metrics and benchmark
- dashboard
- canonical shared skill

Add:
- pnpm workspace
- strict TypeScript
- formatting
- linting
- Vitest
- build scripts
- compatibility test command
- skill drift check command placeholder
- minimal GitHub Actions CI
- package READMEs
- .gitignore
- fake environment example with no real values

Do not add pxpipe yet.
Do not add a database yet.
Do not add real provider calls.

Run install, format check, lint, typecheck, tests and build.
Fix failures.

Report the final file tree and commands.
```

---

# Prompt 3: Prove Codex and Claude Code gateway routing

## Why this prompt comes early

This is the biggest feasibility test.

## Copy and paste

```text
Read the architecture, compatibility and security documents.

Build a transport feasibility spike only. Do not add compression.

Create a local fake gateway with:
- a health endpoint
- an OpenAI Responses-compatible test route
- an Anthropic Messages-compatible test route
- a fake upstream for each route
- streaming fake responses
- structured logs that never include request bodies or authentication values
- request IDs
- timeouts
- clean shutdown

Create sanitised fixtures representing:
- one Codex Responses request
- one Claude Code Messages request
- one streaming response for each
- one provider error for each

Create exact, beginner-safe setup notes showing how a developer can point:
- Codex to a local custom provider base URL
- Claude Code to a local ANTHROPIC_BASE_URL

Do not put real credentials in any file.
Use fake header values and test that those exact fake values never appear in logs.

Add smoke-test scripts for both routes.

Run all checks.

Create docs/TRANSPORT_FEASIBILITY_RESULT.md stating:
- what was proven
- what remains unproven
- exact routes used
- streaming result
- authentication handling result
- blockers
- go or no-go recommendation

Stop here. Do not build the core until both fake routes pass or a blocker is clearly documented.
```

---

# Prompt 4: Define the provider-neutral internal model

## Copy and paste

```text
Read:
- docs/ARCHITECTURE.md
- docs/DUAL_PLATFORM_COMPATIBILITY.md
- docs/TRANSPORT_FEASIBILITY_RESULT.md

Implement provider-neutral TypeScript types for:
- normalised request
- message
- block
- source category
- exactness risk
- recoverability
- transformation decision
- reason code
- provider metadata
- original pass-through fragment

Requirements:
- OpenAI and Anthropic wire types must not appear in the policy layer.
- Original order must be preserved.
- Unknown blocks must retain enough raw data for unchanged pass-through.
- Types must make illegal states harder to represent.
- Avoid any unless a comment explains why it cannot be avoided.

Add representative provider-neutral fixtures.
Add unit tests for construction, ordering and pass-through metadata.

Do not implement provider parsing yet.
Run all checks.
```

---

# Prompt 5: Build the reason-code catalogue and decision record

## Copy and paste

```text
Implement a typed reason-code catalogue for every policy decision.

Include reason groups for:
- current context
- exact value
- code or command
- secret-sensitive
- unknown risk
- unsupported format
- unsupported glyphs
- profile disabled or expired
- unprofitable conversion
- renderer failure
- vault unavailable
- user override
- stale duplicate
- eligible gist-safe content

Create a DecisionRecord type that includes:
- block ID
- decision
- reasons
- policy mode
- timestamp
- profile ID when relevant
- whether original content was preserved
- whether recovery is available

Add human-readable explanations suitable for the CLI and dashboard.

Add tests proving every decision has at least one reason and every reason has safe display text.

Run all checks.
```

---

# Prompt 6: Build the Exactness Firewall

## Copy and paste

```text
Read docs/SECURITY_MODEL.md and docs/ACCEPTANCE_CRITERIA.md.

Implement the Exactness Firewall as deterministic, testable modules.

Detect and protect:
- current user and developer instructions
- source code and diffs
- shell commands
- SQL
- file paths
- URLs
- IP addresses
- domains and ports
- dates and timestamps
- versions
- UUIDs and Git hashes
- ticket and database IDs
- numbers with units
- prices and percentages
- JSON keys
- environment variable names
- API keys
- bearer tokens
- passwords
- cookies
- private keys
- high-entropy secret-like values
- user-defined protected regular expressions

Output:
- risk class
- protected spans
- secret-sensitive spans
- reason codes
- render eligibility

Rules:
- Secret-sensitive spans are never render-eligible.
- Unknown-risk content stays native.
- Current and action-critical content stays native in Safe mode.
- The scanner must not modify the source string.

Add extensive unit tests with fake canary values.
Add false-positive tests.
Do not use real credentials.
Run all checks.
```

---

# Prompt 7: Build the policy engine and modes

## Copy and paste

```text
Implement a pure provider-neutral policy engine.

Inputs:
- normalised block
- scanner result
- context age
- source category
- task exactness requirement
- recoverability
- model profile status
- estimated text cost
- estimated image cost
- selected mode

Modes:
- Safe
- Balanced
- Max
- Bypass

Safe mode rules must match the blueprint.
Bypass must preserve the request unchanged.
Unknown input must pass through unchanged.
A transformation may proceed only when the saving remains positive after sidecars and image cost.

Return a DecisionRecord, not just a boolean.

Add table-driven tests for every risk class and mode.
Add tests proving that higher claimed savings cannot override a safety block.
Run all checks.
```

---

# Prompt 8: Build project and session identity

## Copy and paste

```text
Design and implement safe local project and session identity.

Requirements:
- No raw repository path in public IDs.
- Project IDs must be stable for the same local project but not reveal its name.
- Session IDs must be unique.
- Context block IDs must be unpredictable and scoped.
- IDs must not be accepted as filesystem paths.
- Provide a clear lifecycle for create, resume, expire and delete.

Add tests for stability, uniqueness, invalid values and cross-project separation.

Document the design in docs/IDENTITY_AND_SCOPE.md.
Run all checks.
```

---

# Prompt 9: Build the local context vault

## Copy and paste

```text
Read the security model and identity design.

Implement the local context vault.

Use SQLite or another simple local store only after explaining the choice in docs/DECISIONS.md.

Store:
- project ID
- session ID
- block ID
- source category
- integrity hash
- creation time
- expiry time
- authorised original content
- deletion status

Do not store:
- authentication headers
- secret-sensitive spans
- arbitrary filesystem paths supplied by the model

Requirements:
- atomic writes
- size limits
- project and session isolation
- integrity checking
- expiry
- delete-session
- crash-safe cleanup
- restricted local permissions where supported

Add unit, integration and corruption tests.
Add a test proving canary secrets are not stored.
Run all checks.
```

---

# Prompt 10: Build exact retrieval through MCP

## Copy and paste

```text
Implement a provider-neutral internal retrieval service and expose it through a local MCP server usable by both Codex and Claude Code.

Initial tool:
get_exact_context

Inputs:
- project_id
- session_id
- block_id
- query OR line_start and line_end
- max_chars

Rules:
- verify project and session authority
- never accept a direct filesystem path
- cap search work and returned characters
- return only a narrow matching section
- include source label, integrity status and truncation status
- log safe metadata only
- return nothing on authorisation failure

Add tests for:
- valid retrieval
- missing block
- wrong project
- wrong session
- expired block
- deleted session
- traversal strings
- oversized request
- broad regex abuse
- integrity failure

Create setup references for Codex MCP and Claude Code MCP without credentials.
Run all checks.
```

---

# Prompt 11: Create the renderer interface

## Copy and paste

```text
Create a provider-neutral renderer interface.

Do not integrate pxpipe yet.

The interface must support:
- source text
- protected-span map
- page and dimension limits
- model profile
- stable CTX block label
- exact sidecar input
- rendered image outputs
- glyph coverage report
- timing
- failure reason

Create a deterministic fake renderer for tests.

The core and policy packages must depend only on the interface.
Add tests proving a renderer error causes original text to be selected.
Run all checks.
```

---

# Prompt 12: Evaluate and integrate pxpipe safely

## Copy and paste

```text
Read docs/FIXEL_RECALL_BLUEPRINT.md and docs/SECURITY_MODEL.md.

Inspect the current teamchong/pxpipe repository and its licence before choosing an integration approach.

First create docs/PXPIPE_INTEGRATION_REVIEW.md covering:
- exact upstream version or commit
- licence obligations
- reusable components
- components to wrap
- components to replace
- renderer accuracy risks
- dependency and security risks
- whether to use dependency, fork or copied adapter
- update strategy

Then implement only the approved renderer adapter behind the existing interface.

Requirements:
- preserve required licence notices
- only policy-approved, secret-cleaned blocks reach it
- stable CTX labels
- exact sidecar
- glyph coverage checks
- model-profile checks
- page limits
- golden render tests
- failure returns original text
- no raw content in ordinary logs

Do not copy the entire upstream project blindly.
Run all checks.
```

---

# Prompt 13: Build model profiles and canary tests

## Copy and paste

```text
Implement a versioned model-profile registry.

A profile must include:
- provider
- model family and version
- status
- last tested date
- expiry date
- image dimensions
- glyph density
- language coverage
- image token accounting rule
- gist score
- structure score
- exact-string score
- minimum acceptable thresholds

Add a canary evaluation harness using synthetic:
- prose
- code-like structure
- tables
- paths
- UUIDs
- hashes
- numbers
- mixed punctuation

Rules:
- expired profiles disable imaging
- failed canaries disable imaging
- unknown models disable imaging
- Safe mode must never auto-enable a guessed profile

Add tests and document how a profile is approved.
Run all checks.
```

---

# Prompt 14: Build the OpenAI Responses adapter

## Copy and paste

```text
Implement the OpenAI Responses provider adapter in its own package.

Responsibilities:
- parse supported request items into normalised blocks
- preserve original item order
- preserve developer, user, assistant and tool-related state
- preserve function-call and function-call-output relationships
- preserve images
- preserve provider metadata needed for continuity and caching
- rebuild a valid request after policy decisions
- pass unknown items and fields through unchanged
- avoid changing active or malformed tool state
- do not alter model output

Use sanitised fixtures from the transport spike plus additional edge cases.

Add:
- round-trip no-change tests
- transformed old-history test
- active tool-call test
- malformed pair test
- unknown item test
- cached-content test
- image test
- streaming gateway test

Run all checks.
```

---

# Prompt 15: Build the Anthropic Messages adapter

## Copy and paste

```text
Implement the Anthropic Messages provider adapter in its own package.

Responsibilities:
- parse supported Messages content blocks into normalised blocks
- preserve role and order
- preserve tool_use and tool_result relationships
- preserve active or incomplete tool state
- preserve images
- preserve cache-control fields
- preserve required provider headers and beta capabilities in the gateway layer
- rebuild a valid Messages request
- pass unknown block types and fields through unchanged
- do not alter model output

Add:
- round-trip no-change tests
- transformed old-history test
- active tool-use test
- malformed pair test
- unknown block test
- cached-content test
- image test
- streaming event-order test

Run all checks.
```

---

# Prompt 16: Build the production local gateway

## Copy and paste

```text
Replace the feasibility gateway with the production local gateway while retaining all fake-provider tests.

Requirements:
- bind to loopback by default
- explicit upstream allowlist
- OpenAI Responses route
- Anthropic Messages route
- health and status endpoints
- Safe mode default
- runtime bypass
- runtime kill switch
- request-size limits
- timeouts
- cancellation
- clean shutdown
- streaming without complete buffering
- authentication headers kept in memory only
- no raw request-body persistence
- privacy-safe structured metrics
- unknown transformation shapes pass through unchanged
- clear provider errors

Add security and integration tests for both provider paths.

Create docs/GATEWAY_SETUP.md with beginner instructions for:
- starting
- checking health
- connecting Codex
- connecting Claude Code
- confirming active route
- restoring direct routing
- stopping
- troubleshooting

Run all checks.
```

---

# Prompt 17: Build the honest savings calculator

## Copy and paste

```text
Implement provider-aware savings and cost reporting.

Separate:
- measured input tokens
- estimated input tokens
- cached input tokens
- image tokens
- output tokens
- price source and date
- added latency
- total estimated cost
- confidence and availability

Rules:
- no comparable baseline means no savings percentage
- different model versions invalidate comparison unless explicitly normalised
- different cache treatment must be shown
- failed runs cannot be used as successful comparisons
- stale prices must be labelled
- a negative result must be displayed honestly

Add tests for:
- profitable
- unprofitable
- highly cached
- missing baseline
- changed model
- changed price
- failed run
- unavailable token counts

Run all checks.
```

---

# Prompt 18: Build the benchmark harness

## Copy and paste

```text
Implement the personal benchmark harness.

For one safe task, support:
1. uncompressed control
2. Safe compressed
3. Safe compressed with exact retrieval

Capture:
- provider and model profile
- input and output usage
- cache usage
- latency
- tool actions
- files changed
- test commands and results
- output agreement
- retrieval calls
- protected values imaged count
- errors

Use synthetic repositories and fake providers first.
Do not require private source code.
Do not claim quality from text similarity alone. Prefer task tests and deterministic checks.

Generate a local Markdown and JSON report.

Add tests proving incomparable runs are rejected.
Run all checks.
```

---

# Prompt 19: Build the CLI

## Copy and paste

```text
Build the Fixel Recall CLI.

Commands:
- doctor
- audit
- start
- stop
- status
- explain
- benchmark
- retrieve
- delete-session
- uninstall

Requirements:
- plain language
- helpful exit codes
- dry-run where destructive action is possible
- confirmation before deleting or changing host configuration
- never print credentials
- show the current upstream and safety mode
- show how to restore direct routing
- support fake-provider development mode

Add command tests and snapshot only safe output.
Run all checks.
```

---

# Prompt 20: Build the dashboard

## Copy and paste

```text
Build a local dashboard with the five main cards:
- Context X-ray
- Safe savings
- Risk ledger
- Model health
- Session control

Requirements:
- raw context hidden by default
- no raw-context API in MVP
- clear measured versus estimated labels
- obvious Safe mode and kill switch
- provider path shown without credentials
- accessible keyboard navigation
- responsive local layout
- empty and error states
- no remote analytics by default

Add component tests and one local smoke test.

Run all checks.
```

---

# Prompt 21: Build the privacy-safe share card

## Copy and paste

```text
Add an optional share-card generator.

Allowed fields only:
- percentage input reduction when valid
- estimated total saving
- tests passed
- protected values imaged count
- model family
- benchmark date

Forbidden:
- repository name
- project hash
- branch
- paths
- prompts
- code
- user identity
- session IDs
- provider credentials

Use an explicit allowlist.
Show a preview.
Require explicit confirmation before export.
Generate PNG and JSON proof metadata.
Share nothing automatically.

Add tests proving every forbidden field is blocked.
Run all checks.
```

---

# Prompt 22: Build the canonical shared skill

## Copy and paste

```text
Read the current official Codex and Claude Code Agent Skills documentation before implementation.

Create the canonical Fixel Recall skill at:
skill-source/fixel-recall/

Keep SKILL.md concise and action-focused.

The skill should help when a user asks to:
- audit coding-agent context
- reduce token or context waste
- diagnose Fixel Recall
- start or stop the service
- explain a policy decision
- run a benchmark
- retrieve exact context
- troubleshoot Codex or Claude Code setup

The skill must clearly say:
- it operates a local engine
- it cannot compress the request already invoking it
- Safe mode is default
- exact and secret-sensitive material is protected
- benchmark results may be positive, neutral or negative

Put detailed content in one-level reference files:
- OPERATIONS.md
- SAFETY.md
- BENCHMARKING.md
- TROUBLESHOOTING.md
- CODEX_SETUP.md
- CLAUDE_CODE_SETUP.md

Do not put platform-only commands in the shared core instructions.

Validate skill metadata and test explicit and implicit trigger examples.
Run all checks.
```

---

# Prompt 23: Generate Codex and Claude skill copies

## Copy and paste

```text
Implement deterministic skill synchronisation.

Canonical source:
skill-source/fixel-recall/

Generated targets:
- .agents/skills/fixel-recall/
- .claude/skills/fixel-recall/

Create:
- scripts/sync-skills.ts
- scripts/check-skill-sync.ts
- pnpm sync:skills
- pnpm check:skills

Requirements:
- copy the canonical shared files
- add only minimal platform-specific generated files when required
- never edit canonical source during a check
- fail when a generated target differs
- remove stale generated files safely
- work on macOS, Linux and Windows without requiring symlinks
- CI runs check:skills

Add tests.
Run sync and all checks.
```

---

# Prompt 24: Add platform-specific operator setup

## Copy and paste

```text
Add platform-specific operator setup without changing the shared safety engine.

For Codex:
- document custom provider configuration
- document project and user configuration locations
- document skill discovery and invocation
- document MCP retrieval setup
- add a safe config generator that prints a preview and never writes user config without confirmation

For Claude Code:
- document ANTHROPIC_BASE_URL gateway setup
- document status verification
- document skill discovery and invocation
- document MCP retrieval setup
- optionally add a non-destructive SessionStart doctor hook example
- do not make hooks mandatory
- add a safe setup generator that prints a preview and never overwrites settings without confirmation

Never store provider credentials.
Add uninstall and restore instructions for both.
Add tests for config generation.
Run all checks.
```

---

# Prompt 25: Run the security review

## Copy and paste

```text
Act as a strict application-security reviewer.

Read:
- AGENTS.md
- CLAUDE.md
- docs/SECURITY_MODEL.md
- docs/ARCHITECTURE.md
- docs/ACCEPTANCE_CRITERIA.md
- docs/DECISIONS.md

Review:
- authentication header handling
- raw body logging
- secret scanning
- secret rendering
- vault storage
- project and session isolation
- path traversal
- MCP retrieval
- local dashboard exposure
- upstream allowlisting
- redirects
- request size and denial of service
- temporary images
- crash leftovers
- dependency risk
- prompt injection
- installer and uninstaller
- Codex configuration
- Claude Code configuration and hooks

Create SECURITY_REVIEW.md with:
- severity
- evidence
- exploit path
- affected files
- recommended fix

List findings before changing code.
Fix critical and high findings.
Add regression tests.
Do not weaken safety defaults.

Run the full suite and report remaining risks.
```

---

# Prompt 26: Run the dual-platform compatibility review

## Copy and paste

```text
Review the repository specifically for Codex and Claude Code parity.

Create a compatibility matrix covering:
- installation
- persistent instructions
- skill discovery
- gateway route
- request parsing
- tool state
- image blocks
- cache fields
- streaming
- provider errors
- cancellation
- exact retrieval through MCP
- benchmark
- status and doctor
- route restoration
- uninstall

Run the fake-provider end-to-end suite for both.

Find any place where:
- one provider is marked TODO
- one adapter has weaker tests
- provider-specific types leaked into core
- documentation describes only one host
- shared skill contains platform-only instructions
- generated skills drifted

Create docs/COMPATIBILITY_REPORT.md.
Fix critical parity gaps.
Run all checks.
```

---

# Prompt 27: Run an end-to-end fake beta

## Copy and paste

```text
Run a complete fake-provider beta from a clean checkout.

Steps:
1. install dependencies
2. build
3. run environment doctor
4. start local gateway
5. connect fake Codex client
6. complete one text and one tool-call flow
7. connect fake Claude Code client
8. complete one text and one tool-use flow
9. transform one safe recoverable block
10. retrieve one exact section through MCP from each host
11. run benchmark
12. open dashboard smoke test
13. trigger kill switch
14. restore direct fake routing
15. delete session
16. uninstall local test configuration

Record every command and result in docs/FAKE_BETA_REPORT.md.
No real credentials.
No private repository content.

Fix failures and repeat until the full flow passes.
Run all checks.
```

---

# Prompt 28: Prepare the real-provider canary plan

## Copy and paste

```text
Do not run a real-provider test yet.

Create docs/REAL_PROVIDER_CANARY_PLAN.md.

The plan must include:
- explicit user consent
- minimal synthetic prompt
- exact expected request path
- credential handling
- maximum token and cost budget
- one Codex test
- one Claude Code test
- how to confirm the gateway route
- how to confirm no credential or raw body was logged
- kill-switch procedure
- route restoration
- rollback
- evidence to capture
- conditions that stop the test immediately

The plan must use Safe mode only.
It must not use private source code.
Stop after the plan.
```

---

# Prompt 29: Final release review

## Copy and paste

```text
Review the full repository against all acceptance criteria.

Do not assume earlier reports are still correct.
Run the current commands.

Create RELEASE_READINESS.md with:
- version
- commit
- supported operating systems
- supported Codex surfaces
- supported Claude Code surfaces
- provider and model profiles
- test totals
- security findings
- known limitations
- privacy statement
- install steps
- uninstall steps
- rollback steps
- measured benchmark evidence
- go or no-go decision

A no-go result is acceptable.
Do not hide failures.
Do not publish anything.
```

---

# Universal recovery prompt

Use this whenever a build prompt fails:

```text
Do not continue to the next feature.

Explain the failure in plain language.
Identify the smallest root cause.
Show which acceptance criterion is affected.
Make the smallest safe fix.
Do not weaken tests or safety rules.
Rerun every command required by the current prompt.
Report exact PASS, FAIL or NOT RUN status.
```

# Universal checkpoint prompt

Use this before committing:

```text
Before I save this checkpoint:
1. list every changed file
2. explain each change in one sentence
3. list every command run
4. report exact test results
5. identify unfinished work
6. confirm no credential, secret or private prompt entered the repository
7. confirm whether both Codex and Claude Code are still supported
Do not make more changes.
```
