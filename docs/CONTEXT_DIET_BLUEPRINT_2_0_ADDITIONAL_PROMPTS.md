# Context Diet Blueprint 2.0 Additional Vibe-Coding Prompts

## Who this is for

You have already completed the original Context Diet build prompts through **Prompt 10**.

Do not restart.

These prompts add Blueprint 2.0 capabilities and keep the entire project in local simulation mode.

## How to use the prompts

1. Copy `CONTEXT_DIET_BLUEPRINT_2_0_COMPLETION_EXTENSION.md` into `docs/`.
2. Copy `SYNTHETIC_TEST_DATA_SPEC.md` into `docs/`.
3. Copy this prompt file into `docs/`.
4. Commit those documents.
5. Run the prompts below in order.
6. Continue the original Prompts 11–29 when directed.
7. Use one coding agent at a time.
8. Commit after every passing prompt.

## Permanent simulation rule

Every prompt below inherits this rule:

```text
SIMULATION-ONLY RULE

Do not use or request real OpenAI, Anthropic, GitHub, marketplace, telemetry, registry, leaderboard or enterprise-service credentials.

Do not send requests to real model-provider APIs.

Use deterministic fake providers, loopback services, seeded synthetic users and synthetic repositories.

Any report, card, badge, leaderboard or projection generated from test data must be visibly labelled SYNTHETIC or SIMULATED.

Do not modify real user-level Codex or Claude Code configuration without an explicit preview and confirmation. Prefer project-local test configuration.

Do not weaken an existing safety control to make a demo pass.
```

---

# Extension Prompt 10A: Audit the current Prompt 0–10 implementation

```text
Read:
- AGENTS.md
- CLAUDE.md
- all current docs
- docs/CONTEXT_DIET_BLUEPRINT_2_0_COMPLETION_EXTENSION.md
- docs/SYNTHETIC_TEST_DATA_SPEC.md

We have already completed the original prompts through Prompt 10.

Do not rebuild them and do not assume they are correct merely because files exist.

Audit the repository and create:
docs/BLUEPRINT_2_0_GAP_AUDIT.md

For each original Prompt 0–10 requirement, report:
- implemented
- partially implemented
- missing
- implemented differently
- test evidence
- affected files
- safe migration needed

Then map every Blueprint 2.0 P0, P1 and P2 feature to:
- existing reusable code
- new package or module needed
- new test needed
- new command or UI needed
- dependency on original Prompts 11–29

Create a recommended implementation sequence that preserves completed work.

Do not modify production code.
Run only existing non-destructive checks.
Stop after the audit.
```

## Checkpoint

Do not continue if the audit finds a broken security boundary in Prompts 0–10. Fix that first using
Prompt 10B.

---

# Extension Prompt 10B: Repair only critical Prompt 0–10 gaps

```text
Read docs/BLUEPRINT_2_0_GAP_AUDIT.md.

Fix only critical and high-severity gaps in the already-completed Prompt 0–10 work.

Priorities:
1. secret leakage
2. raw body persistence
3. cross-project retrieval
4. path traversal
5. provider wire types in core
6. unknown input mutation
7. missing original-content fallback
8. broken Codex or Claude Code parity

Do not implement later Blueprint 2.0 features yet.
Do not broadly refactor working code.
Add regression tests for every fix.
Update docs/DECISIONS.md only when architecture changes.

Run all existing checks.
Create docs/PROMPT_0_TO_10_REPAIR_REPORT.md.
Stop.
```

---

# Extension Prompt 10C: Install the synthetic test-data foundation

```text
Implement the synthetic test-data package described in:
docs/SYNTHETIC_TEST_DATA_SPEC.md

Create:
- seeded synthetic user factory
- seeded workload factory
- OpenAI-shaped fake provider
- Anthropic-shaped fake provider
- fake error and streaming cases
- fake secret canaries
- synthetic usage-history generator
- fake profile and policy bundles
- multilingual corpus
- audit-event fixtures

Requirements:
- deterministic by seed
- no outbound network
- no real credentials
- every generated artifact records synthetic origin
- fixtures are typed and documented
- provider simulators bind to loopback only
- simulators support clean startup and shutdown
- all test outputs stay in a temporary test directory

Add a network-isolation test that fails on unexpected outbound connections.

Run all checks.
Create docs/SYNTHETIC_DATA_CATALOGUE.md.
Stop.
```

---

# Extension Prompt 10D: Prove no raw 4xx body persistence

```text
Implement an explicit raw-request-body persistence test suite for these local gateway statuses:

400, 401, 403, 404, 409, 413, 415, 422 and 429.

For each status and both provider-shaped routes:
- send a synthetic body containing a unique fake canary sentence
- trigger the expected error
- inspect logs, traces, metrics, snapshots, temp files, vault, audit events and generated artifacts
- prove the raw body and canary were not persisted
- allow only safe metadata such as request ID, byte count, route, status, error code and timing

Add a repository-wide test-output canary scanner.

Do not enable raw body logging, even for tests.
Do not delete evidence before the scanner checks it.

Create docs/NO_RAW_4XX_BODY_EVIDENCE.md summarising test coverage without including request bodies.
Run all checks.
Stop.
```

---

# Continue original Prompts 11–16

Now complete the original:

- Prompt 11: Renderer interface
- Prompt 12: pxpipe integration
- Prompt 13: Model profiles and canaries
- Prompt 14: OpenAI adapter
- Prompt 15: Anthropic adapter
- Prompt 16: Production local gateway

Apply the simulation-only rule.

Do not run real-provider canaries.

After Prompt 16, run the next extension prompts.

---

# Extension Prompt 16A: Build the renderer and pxpipe doctor

```text
Build:

context-diet renderer doctor

It must diagnose the renderer through its public interface, not by reaching into private internals.

Check:
- adapter installed
- upstream pxpipe version or pinned commit
- licence notice
- required native dependencies
- temp directory write and cleanup
- font availability
- deterministic golden render
- supported image dimensions
- glyph coverage
- exact-sidecar output
- protected-span exclusion
- fake secret-canary absence
- model-profile compatibility
- simulated image-token cost
- renderer timeout
- crash cleanup

Statuses:
- HEALTHY
- DEGRADED
- UNSAFE
- UNSUPPORTED

Seed tests that produce all four statuses.

Add plain-language next actions.
Do not install missing dependencies automatically.
Run all checks.
```

---

# Extension Prompt 16B: Add product-wide fallback invariants

```text
Create an end-to-end fallback-invariant test suite.

For each of these failures:
- unknown provider block
- malformed tool state
- renderer timeout
- renderer crash
- missing font
- unsupported glyph
- expired model profile
- revoked model profile
- invalid registry signature
- vault unavailable
- policy conflict
- adaptive engine low confidence
- simulated provider version change
- secret scanner uncertainty

Prove:
- original native content remains in correct order
- no protected value is rendered
- no content is silently dropped
- provider request remains valid
- both OpenAI-shaped and Anthropic-shaped routes behave equivalently
- a safe reason code is recorded

Generate no real provider traffic.
Run all checks.
```

---

# Extension Prompt 16C: Build the personal compatibility audit

```text
Implement:

context-diet compatibility-audit

Use only seeded synthetic users and local model profiles.

Collect or accept:
- host
- model simulator profile
- workload type
- language and script
- average request and session size
- cache intensity
- exactness sensitivity
- tool-use frequency
- latency sensitivity
- risk preference

Return:
- compatibility score
- expected-benefit band
- accuracy-risk band
- latency band
- recommended preset
- unsupported capabilities
- required canaries
- verdict
- reasons

Allowed verdicts:
RECOMMENDED
RECOMMENDED_WITH_RESTRICTIONS
AUDIT_ONLY
NOT_WORTH_USING
UNSUPPORTED
RETEST_REQUIRED

Requirements:
- deterministic for the same fixture
- no single blended score may hide a failed exactness or safety threshold
- reasons must be understandable to a non-technical user
- output must say SYNTHETIC TEST DATA
- JSON and Markdown reports
- tests for every verdict
- Codex, Claude Code and both-host cases

Add dashboard-ready API output.
Run all checks.
```

---

# Extension Prompt 16D: Build the not-worth-using recommendation engine

```text
Create a dedicated recommendation engine that decides whether Context Diet is worthwhile.

Inputs:
- eligible context
- cache intensity
- text and image cost assumptions
- added latency
- retrieval frequency
- accuracy-risk level
- user risk tolerance
- projected usage
- optional local compute cost

Outputs:
- verdict
- net weekly, monthly and annual projection
- break-even usage
- top reasons
- recommended operating mode
- re-test condition

It must be able to say clearly:

Context Diet is not worth enabling for this simulated setup.

Create tests for:
- strong positive value
- small positive but high risk
- highly cached workload
- code-heavy workload
- negative net saving
- missing evidence
- unsupported model
- expired profile

Never change a protected-content rule to improve the verdict.
Label all current results as synthetic.
Run all checks.
```

---

# Continue original Prompts 17–21

Complete:

- Prompt 17: Honest savings calculator
- Prompt 18: Benchmark harness
- Prompt 19: CLI
- Prompt 20: Dashboard
- Prompt 21: Share card

Apply the simulation-only rule.

Then run the following enhancement prompts.

---

# Extension Prompt 21A: Build monthly saving projections

```text
Extend the savings engine with weekly, monthly and annual projections.

Use synthetic usage histories generated from a fixed seed.

Show:
- conservative
- expected
- high-usage scenarios
- original input cost
- image cost
- cache effect
- local processing cost
- retrieval overhead
- net saving
- added latency
- break-even point
- confidence
- evidence origin

Rules:
- simulated and measured data cannot be mixed silently
- missing baseline means no percentage claim
- negative savings remain visible
- all dashboard and report outputs must say SYNTHETIC DATA in this phase

Add tests for 30-day and 90-day histories.
Run all checks.
```

---

# Extension Prompt 21B: Strengthen Context X-ray

```text
Upgrade Context X-ray using existing metrics and decision records.

Add:
- request composition
- current versus old context
- exact versus semantic
- code and command content
- secret-sensitive counts
- completed versus active tool state
- repeated content
- cache-sensitive content
- recovery availability
- renderer candidates
- fallback events
- exact retrieval events
- policy reasons
- before and after comparison
- session trend
- provider comparison

Requirements:
- raw context hidden by default
- no raw-content API
- synthetic demo data switch
- accessible descriptions
- clear reason-code explanations
- no misleading combined score

Add dashboard tests and a seeded demo story for U1, U2 and U3.
Run all checks.
```

---

# Extension Prompt 21C: Add human-readable policy presets

```text
Implement product-facing policy presets:

1. Observe Only
2. Protect First
3. Save More
4. Lab Mode

Map them to existing internal modes without duplicating the policy engine.

Each preset defines:
- eligible sources
- block-age threshold
- minimum saving
- recovery requirement
- allowed profile status
- language support
- maximum added latency
- adaptation permission

Rules:
- Protect First is default
- Lab Mode works only in synthetic or explicitly experimental sessions
- organisation policy may forbid a preset later
- preset selection never weakens the built-in safety floor

Add:
- CLI selector
- dashboard selector
- compatibility-audit recommendation
- explain output
- tests for preset mapping and forbidden transitions

Run all checks.
```

---

# Extension Prompt 21D: Build a GitHub Actions synthetic benchmark badge

```text
Create a GitHub Actions workflow that runs the deterministic synthetic benchmark without provider credentials.

Generate:
- JSON evidence artifact
- Markdown job summary
- static SVG badge
- optional pull-request comment text saved as an artifact
- README embed instructions

Badge variants:
- benchmark passing
- synthetic input reduction
- protected values imaged
- compatibility status

Requirements:
- display SYNTHETIC when a numeric result uses test data
- no private repository content in artifacts
- no API key secrets
- no network dependency except normal package installation unless dependencies are already cached
- stable result for a fixed seed
- badge generation through an allowlist template
- tests for forbidden fields

Do not publish to an external badge service.
Run the workflow locally where possible and unit-test the generator.
```

---

# Extension Prompt 21E: Build the local compatibility leaderboard simulator

```text
Build a local-only compatibility leaderboard service and dashboard page.

It must ingest signed synthetic benchmark evidence only.

Rank separate dimensions:
- gist accuracy
- structural accuracy
- exact-string accuracy
- token efficiency
- latency
- multilingual coverage
- retrieval dependency
- Safe-mode recommendation

Evidence includes:
- profile ID
- provider simulator
- model simulator version
- renderer version
- font profile
- corpus version
- run date
- expiry
- reproducibility status
- signature

Requirements:
- verify signatures
- reject modified evidence
- reject expired evidence from current ranking
- never combine dimensions into one misleading winner score
- support local seeded submissions
- clearly label LOCAL SIMULATOR and SYNTHETIC RESULTS
- no public network endpoint

Add tests and seeded leaderboard data.
Run all checks.
```

---

# Extension Prompt 21F: Make shareable evidence simulation-safe

```text
Review the existing share-card implementation.

Add:
- verification ID
- evidence-origin label
- compatibility verdict
- monthly projection range
- benchmark profile
- test status
- synthetic watermark

Use a strict field allowlist.

Prove that repository name, path, branch, prompts, code, user identity, session IDs, credentials and raw audit events cannot appear.

Generate:
- PNG
- SVG
- JSON proof object

No upload or share action.
Run all checks.
```

---

# Continue original Prompts 22–29

Complete the original prompts for:

- Shared skill
- Skill synchronisation
- Platform setup
- Security review
- Compatibility review
- Fake beta
- Real-provider canary plan only
- Release review

Do not execute a real-provider canary.

After Prompt 29, run P2 completion prompts.

---

# Extension Prompt 30: Build per-user adaptive compression in shadow mode

```text
Implement a local per-user adaptive policy engine in SHADOW MODE.

It may observe:
- workload mix
- retrieval frequency by block type
- fallback events
- user overrides
- cache intensity
- benchmark outcome
- latency
- language profile
- renderer and canary failures

It may propose bounded changes to:
- minimum block age
- minimum block size
- eligible low-risk source categories
- renderer density within approved limits
- sidecar strength
- recovery requirement
- recommended preset

It may never change:
- secret handling
- current-instruction protection
- code and command protection in Protect First
- unknown-risk fallback
- vault authorisation
- team mandatory policy

Requirements:
- minimum evidence count
- confidence level
- explanation
- before and proposed policy diff
- no automatic application
- approve, reject, reset and rollback actions
- one profile per synthetic user
- no cross-user learning

Add tests for useful recommendation, low confidence, dangerous recommendation rejection and reset.
Run all checks.
```

---

# Extension Prompt 31: Add approved adaptive application and rollback

```text
Extend the adaptive engine so a user can explicitly approve a safe proposal.

Requirements:
- preserve previous policy version
- store approval receipt
- bounded change only
- automatic rollback when safety or benchmark thresholds worsen
- manual rollback
- show cause and evidence
- adaptation cannot bypass team mandatory policy
- adaptation cannot enable an unsupported model or language
- audit every proposal, approval, rejection and rollback without raw context

Use synthetic users only.
Add end-to-end tests.
Run all checks.
```

---

# Extension Prompt 32: Build the local signed profile registry simulator

```text
Build a loopback-only signed profile registry simulator and client.

Use test signing keys.

Support:
- valid profile
- expired profile
- revoked profile
- unknown key
- modified payload
- old-version rollback attempt
- minimum-client mismatch
- renderer mismatch
- multilingual profile
- replacement profile after canary

Client requirements:
- signature verification
- expiry verification
- revocation
- monotonic version protection
- last trusted cache
- offline operation with unexpired cache
- text fallback with no trusted profile
- safe status and reason code

Never use production keys.
Never call a remote service.
Add security tests.
Run all checks.
```

---

# Extension Prompt 33: Automate canary quarantine after simulated changes

```text
Create a change-detection and canary controller.

Detect synthetic changes in:
- provider
- model version
- provider route
- renderer
- font profile
- image-token accounting rule
- Context Diet client
- registry profile
- test corpus

On change:
1. mark the profile RETEST_REQUIRED
2. disable image conversion
3. keep text fallback active
4. run deterministic canaries
5. compare thresholds
6. re-enable only on pass
7. create evidence and audit events
8. notify CLI, dashboard and editor API

Test:
- passing change
- exactness regression
- multilingual regression
- token-cost regression
- signature failure
- offline registry
- repeated change during canary

Run all checks.
```

---

# Extension Prompt 34: Build multilingual font and glyph profiles

```text
Implement multilingual rendering and model-profile support using permitted local system fonts or test fonts already available in the development environment.

Do not bundle or distribute font binaries unless their licence has been reviewed and allows it.

Initial script profiles:
- Latin
- Devanagari
- Arabic
- Simplified Chinese
- Traditional Chinese
- Japanese
- Korean
- Thai
- Cyrillic
- mixed code and prose
- emoji and technical symbols

Test:
- Unicode coverage
- shaping
- bidirectional text
- line breaking
- normalisation
- glyph density
- exact-string preservation score
- fallback on missing glyph
- mixed-script content

Create docs/MULTILINGUAL_PROFILE_REPORT.md.

If a script cannot be safely rendered, mark it unsupported and preserve text.
Run all checks.
```

---

# Extension Prompt 35: Build local team policy distribution

```text
Build a local signed team-policy distributor and client.

Hierarchy:
- built-in safety floor
- organisation mandatory policy
- team policy
- repository policy
- user preference
- adaptive proposal

A lower layer cannot weaken a mandatory higher layer.

Policy fields:
- ID and version
- signature and key ID
- issue and expiry
- required preset
- forbidden presets
- approved model profiles
- approved language profiles
- minimum saving
- retention
- export restrictions
- override permissions

Build:
- local simulator
- offline cache
- conflict resolver
- plain-language explanation
- invalid signature handling
- expiry handling
- rollback protection

Use synthetic organisations and users only.
Add tests for all conflicts.
Run all checks.
```

---

# Extension Prompt 36: Build the enterprise audit trail locally

```text
Implement a local append-only, tamper-evident audit trail.

Do not store raw requests, raw retrieved content or secrets.

Event fields:
- event ID
- previous-event hash
- timestamp
- installation ID
- synthetic actor pseudonym
- project and session pseudonyms
- policy version
- model profile
- decision
- reason codes
- protected counts
- retrieval count
- outcome
- evidence hash

Add:
- hash-chain verification command
- tamper detection
- retention
- deletion receipt
- JSONL export
- CSV summary
- synthetic SIEM adapter writing to a local file
- role-filtered reports simulated locally

Add adversarial tests.
Run all checks.
```

---

# Extension Prompt 37: Build the development editor extension

```text
Build a development-only VS Code-compatible extension for Context Diet.

It must use local Context Diet APIs and must not duplicate policy or safety logic.

Views and actions:
- gateway health
- fake provider status
- current preset
- context budget meter
- Context X-ray
- protected-value count
- fallback events
- exact retrieval
- benchmark
- compatibility verdict
- monthly projection
- model-profile status
- canary status
- start
- stop
- kill switch
- uninstall guidance

Requirements:
- no credentials
- no provider network call
- no raw prompt display by default
- clear synthetic-data labels
- accessible commands and views
- extension-host tests
- local packaging only
- no marketplace publishing

Run all checks.
```

---

# Extension Prompt 38: Build one-command simulation onboarding

```text
Implement one-command local onboarding:

pnpm context-diet setup --simulation

Later packaging may expose:
npx context-diet setup --simulation

The command must:
1. run environment doctor
2. detect Codex and Claude Code
3. detect existing Context Diet state
4. ask which hosts to prepare
5. preview every change
6. create backups
7. create an installation manifest
8. start fake providers
9. start the local gateway
10. prepare project-local host test configuration after confirmation
11. configure local MCP test setup after confirmation
12. seed synthetic users and workloads
13. run compatibility audit
14. run smoke tests
15. show dashboard and editor-extension instructions
16. show uninstall command

No real user-level config overwrite.
No real credentials.
Idempotent repeated setup.
Add tests for fresh install, existing install, cancelled install and partial failure.
Run all checks.
```

---

# Extension Prompt 39: Build transactional uninstall and rollback

```text
Implement full uninstall and rollback using the installation manifest.

Commands:
- context-diet uninstall --dry-run
- context-diet uninstall
- context-diet rollback
- context-diet installation receipt

Requirements:
- preview actions
- restore backups only when safe
- detect user edits after installation
- never overwrite unrelated later edits
- report conflicts
- stop services
- remove project-local test configuration
- remove local MCP test entry
- optionally remove synthetic data after confirmation
- optionally keep a privacy-safe receipt
- support interrupted uninstall resume
- prove idempotency

Add end-to-end tests with synthetic Codex and Claude config files.
Run all checks.
```

---

# Extension Prompt 40: Create the complete synthetic founder demo

```text
Create a guided local demo command:

context-diet demo --simulation

The demo must tell a clear story using synthetic users:

1. U1 log-heavy user: Recommended
2. U2 code-heavy user: Audit Only
3. U3 high-cache user: Not Worth Using
4. U4 multilingual user: fallback then approved profile
5. U6 team-policy conflict
6. U7 provider change and canary quarantine
7. U8 secret canary protection

Show:
- compatibility audit
- preset
- A/B benchmark
- Context X-ray
- monthly projection
- share card
- badge
- local leaderboard
- exact retrieval
- adaptation proposal
- audit verification
- rollback

Requirements:
- no internet
- deterministic seed
- under a documented maximum runtime
- plain-language narration
- no hidden failures
- final PASS/FAIL report
- all outputs visibly synthetic

Add a non-interactive CI mode.
Run all checks.
```

---

# Extension Prompt 41: Run complete Blueprint 2.0 user acceptance testing

```text
Run the full Blueprint 2.0 UAT using synthetic data only.

Test all eight seeded users across:
- Codex fake host
- Claude Code fake host
- both-host installation where relevant

Cover:
- onboarding
- doctor
- compatibility audit
- not-worth-using outcome
- policy presets
- gateway
- Exactness Firewall
- secret protection
- 4xx no-body persistence
- renderer doctor
- fallback
- exact retrieval
- benchmark
- Context X-ray
- monthly projection
- share card
- badge
- leaderboard
- adaptation
- registry
- canary quarantine
- multilingual profiles
- team policy
- audit trail
- editor extension
- uninstall and rollback

Create:
docs/BLUEPRINT_2_0_UAT_REPORT.md

For every capability report:
PASS, FAIL, BLOCKED or NOT RUN.

Do not hide failures.
Do not use real APIs.
Fix critical failures and rerun.
```

---

# Extension Prompt 42: Final simulation-mode release readiness

```text
Review the current repository from scratch against:
- original acceptance criteria
- Blueprint 2.0 completion extension
- synthetic test-data specification
- Blueprint 2.0 UAT report
- security model
- dual-platform compatibility requirements

Run:
- format
- lint
- typecheck
- unit tests
- compatibility tests
- security tests
- network-isolation tests
- synthetic end-to-end tests
- skill drift check
- extension tests
- build
- audit-chain verification
- uninstall dry-run

Create:
docs/BLUEPRINT_2_0_SIMULATION_RELEASE_READINESS.md

Include:
- exact commit
- completed capabilities
- incomplete capabilities
- test counts
- security status
- synthetic user verdicts
- Codex fake-host status
- Claude Code fake-host status
- known limitations
- proof that no real API was used
- proof that outputs are labelled synthetic
- go or no-go decision for a closed local user test

A no-go result is acceptable.
Do not publish.
Do not create real-provider configuration.
Stop after the report.
```

---

# Universal checkpoint prompt

```text
Before I commit this checkpoint:

1. List every changed file.
2. Explain each change in simple language.
3. List every command run.
4. Report PASS, FAIL or NOT RUN for every required check.
5. Confirm that no real provider API was called.
6. Confirm that no real credential entered code, logs, fixtures or Git history.
7. Confirm that synthetic outputs are labelled.
8. Confirm that Codex and Claude Code paths remain supported.
9. Confirm that original Prompt 0–10 tests still pass.
10. List unfinished work.

Do not make further changes.
```

# Universal recovery prompt

```text
Stop the next feature.

Explain the failure in plain language.
Identify the smallest root cause.
Show the affected acceptance criterion.
Do not weaken tests, secret handling, exactness protection, fallback, authorisation or synthetic-only boundaries.
Make the smallest safe fix.
Rerun the current prompt's checks and the affected Prompt 0–10 regression tests.
Report exact results.
```
