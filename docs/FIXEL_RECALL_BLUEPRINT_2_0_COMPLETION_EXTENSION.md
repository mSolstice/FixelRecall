# Fixel Recall Blueprint 2.0 Completion Extension

## Status

This document is an **additive product and engineering extension** for a Fixel Recall repository
that has already completed the original build prompts through **Prompt 10: Exact Retrieval through
MCP**.

It does not instruct the coding agent to restart the project, throw away completed code, rename
working packages without cause, or connect to real model-provider APIs.

## Development boundary

Until the founder explicitly approves otherwise:

- Use synthetic users.
- Use synthetic repositories.
- Use fake OpenAI-compatible and Anthropic-compatible providers.
- Use deterministic streaming fixtures.
- Use local HTTP simulators.
- Use fake prices and usage histories labelled as synthetic.
- Use local signed registries.
- Use local leaderboard data.
- Do not require an OpenAI key.
- Do not require an Anthropic key.
- Do not send private code or prompts over the network.
- Do not change real Codex or Claude Code user configuration automatically.
- Do not publish badges, profiles, policies or benchmark results publicly.
- Do not claim real-world savings from simulated results.

The goal is to finish the **entire product architecture and user experience in simulation mode**, so
real integrations can be added later behind already-tested interfaces.

---

# 1. Why this extension exists

The original build pack correctly prioritised:

- Exactness Firewall
- Secret protection
- Provider-neutral request modelling
- Local vault
- MCP exact retrieval
- Codex and Claude Code compatibility
- Renderer isolation
- Honest benchmarking
- Local dashboard
- Shared skills

The remaining product gaps sit in three layers:

## P0: Trust completion

- Explicit 4xx body-persistence protection
- Personal compatibility audit
- A clear "not worth using" verdict
- Transactional installation, uninstall and rollback
- Product-wide fallback validation

## P1: Distribution and virality

- One-command onboarding
- Strong Context X-ray
- Monthly saving projection
- GitHub Actions benchmark badge
- Public compatibility leaderboard architecture
- Dedicated renderer and pxpipe doctor
- Human-readable policy presets
- Shareable proof without data leakage

## P2: Defensibility

- Per-user adaptive compression
- Signed remote-profile architecture
- Automatic canary quarantine after model or provider changes
- Multilingual font and glyph profiles
- Team policy distribution
- Enterprise audit trail
- Editor extension
- Cross-feature evidence graph

---

# 2. Product completion goal

When this extension is complete, a user should be able to run a fully local demo that behaves like
the finished product:

```text
Install in simulation mode
        |
        v
Detect Codex and Claude Code safely
        |
        v
Run a personal compatibility audit
        |
        +-- Worth using
        +-- Audit only
        +-- Not worth using
        |
        v
Select a policy preset
        |
        v
Run synthetic A/B benchmark
        |
        v
Inspect Context X-ray
        |
        v
See monthly projection
        |
        v
Create privacy-safe proof card and badge
        |
        v
Test exact retrieval
        |
        v
Test model-change quarantine
        |
        v
Test multilingual and team policies
        |
        v
Operate through CLI and editor extension
        |
        v
Uninstall and restore every changed setting
```

No step needs a real provider API.

---

# 3. Completion principles

## 3.1 Do not rebuild completed work

Prompts 0–10 are treated as implemented checkpoints.

The coding agent must:

1. Inspect current code.
2. Identify what is complete.
3. Reuse public interfaces.
4. Add migrations only where required.
5. Avoid breaking existing tests.
6. Record deviations from the original blueprint.
7. Never assume the implementation matches the prompt merely because a file exists.

## 3.2 Simulation-first architecture

Every network-facing capability gets an interface and a local implementation.

| Future real service        | Current implementation                     |
| -------------------------- | ------------------------------------------ |
| OpenAI provider            | Deterministic OpenAI Responses simulator   |
| Anthropic provider         | Deterministic Anthropic Messages simulator |
| Remote profile registry    | Local signed-registry HTTP simulator       |
| Public leaderboard         | Local leaderboard API and seeded database  |
| Team policy server         | Local signed-policy distributor            |
| Usage analytics            | Seeded local activity generator            |
| GitHub badge endpoint      | Local/static SVG generator                 |
| Editor marketplace package | Locally installable development extension  |

## 3.3 Evidence before automation

No system should automatically change compression policy until it has:

- Enough eligible observations
- A minimum confidence level
- A reversible prior configuration
- An explanation
- A safe maximum change
- A rollback path

## 3.4 Honest outcomes

Fixel Recall must be allowed to conclude:

- Recommended
- Recommended with restrictions
- Audit only
- Not worth using
- Unsupported
- Re-test required

"Not worth using" is a product success when the evidence supports it.

---

# 4. P0 trust-completion blueprint

## 4.1 Exactness Firewall

Already structured and partially built before this extension.

Completion work:

- Add whole-product integration tests.
- Verify every future feature consumes firewall decisions.
- Prevent badge, projection, adaptation and policy systems from overriding a protected decision.
- Add a protected-value lineage record showing where a value was detected and why it stayed native.
- Make protected-value rendering count a release-blocking metric.

## 4.2 Secret detection

Completion work:

- Test secrets in user messages, tool outputs, files, logs, errors and sidecars.
- Test common and high-entropy fake credentials.
- Test partial secrets split across chunks.
- Test masking without storing the original secret.
- Test generated screenshots and fixture artifacts.
- Add a repository scan that fails if seeded canary secrets leak into output folders.

## 4.3 No raw 4xx request-body persistence

Explicit requirement:

For the following local gateway outcomes, the raw request body must not be written to disk, metrics,
traces, snapshots or error logs:

- 400
- 401
- 403
- 404
- 409
- 413
- 415
- 422
- 429

Safe metadata may include:

- Request ID
- Route name
- Body byte count
- Provider family
- Error code
- Status
- Timestamp
- Redacted header names
- Processing duration

Add a test-only canary sentence to each failing body and scan all output locations to prove it was
not persisted.

## 4.4 Personal compatibility audit

New command:

```bash
fixel-recall compatibility-audit
```

Inputs:

- Host: Codex, Claude Code or both
- Simulated model profile
- Primary work type
- Language and script
- Average session size
- Cache intensity
- Exactness sensitivity
- Tool-use frequency
- User risk preference

Outputs:

- Compatibility score
- Expected benefit band
- Accuracy-risk band
- Added-latency band
- Recommended preset
- Unsupported features
- Required canaries
- Verdict
- Plain-language reason

Verdicts:

```text
RECOMMENDED
RECOMMENDED_WITH_RESTRICTIONS
AUDIT_ONLY
NOT_WORTH_USING
UNSUPPORTED
RETEST_REQUIRED
```

The audit must use seeded synthetic profiles in this phase.

## 4.5 A/B benchmark

The benchmark must support synthetic user workloads representing:

- Long prose-heavy history
- Repetitive logs
- Code-heavy exact workload
- High provider caching
- Secret-heavy logs
- Multilingual documentation
- Tool-call-heavy agent session

The benchmark must compare:

1. Original
2. Safe optimisation
3. Safe optimisation plus exact retrieval

The report must separate simulation from measured production evidence.

## 4.6 Automatic fallback to text

Add system-wide invariant tests:

- Unsupported model
- Expired profile
- Failed renderer
- Missing font
- Bad glyph coverage
- Secret uncertainty
- Vault unavailable
- Registry signature failure
- Policy conflict
- Adaptive-policy uncertainty
- Unknown request block
- Simulated provider version change

Expected result: original native content survives unchanged.

## 4.7 Transactional installation and rollback

Every setup action must be recorded in a local installation manifest.

Manifest records:

- Fixel Recall version
- Installation ID
- Timestamp
- Files created
- Files modified
- Before-state hashes
- Backup locations
- Environment instructions shown
- Codex config change proposed or applied
- Claude config change proposed or applied
- MCP entries proposed or applied
- Services installed
- Ports reserved
- Extension installed
- Current rollback status

Uninstall must:

1. Read the manifest.
2. Show what will be changed.
3. Support dry-run.
4. Restore only Fixel Recall-managed changes.
5. Preserve unrelated user changes.
6. Report conflicts rather than overwrite blindly.
7. Remove local synthetic data only after confirmation.
8. Leave an optional audit receipt with no private content.

## 4.8 Not-worth-using outcome

The recommendation engine must explicitly calculate whether the product is worthwhile.

Inputs:

- Estimated or simulated monthly requests
- Average eligible context
- Cache intensity
- Image cost
- Added latency
- Retrieval frequency
- Accuracy risk
- User risk tolerance
- Subscription or infrastructure cost assumptions

Example output:

```text
Verdict: NOT WORTH USING

Reason:
Your simulated workload is code-heavy and 82% cached.
Estimated monthly saving: $3.40
Added processing time: 9.2 minutes per month
Exactness risk: Moderate

Recommended action:
Keep Fixel Recall in Audit Only mode.
```

---

# 5. P1 virality blueprint

## 5.1 One-command onboarding

Target developer experience:

```bash
pnpm fixel-recall setup --simulation
```

or, after packaging:

```bash
npx fixel-recall setup --simulation
```

The command must:

1. Run doctor.
2. Detect Codex and Claude Code.
3. Detect existing Fixel Recall state.
4. Ask which hosts to prepare.
5. Preview configuration changes.
6. Create backups.
7. Start local fake providers and gateway.
8. Configure project-local test settings only after confirmation.
9. Configure local MCP test entry.
10. Seed synthetic users and workloads.
11. Run compatibility audit.
12. Run smoke tests.
13. Show dashboard URL.
14. Show uninstall command.

No real user-level configuration is silently modified.

## 5.2 Context X-ray

The X-ray should show:

- Total request composition
- Current versus old context
- Exact versus semantic content
- Secrets detected
- Code and command content
- Tool calls and results
- Repetition
- Cache-sensitive content
- Recoverable blocks
- Image candidates
- Text fallback events
- Retrieval events
- Policy decisions
- Reason codes

Views:

- Request view
- Session trend
- User profile trend
- Provider comparison
- Before and after
- Safety ledger

## 5.3 Shareable benchmark card

The card remains allowlist-based.

Add:

- Verification ID
- Synthetic or production evidence label
- Benchmark profile
- Tests passed
- Safety result
- Compatibility verdict
- Monthly projection range
- QR or URL only when a future public proof endpoint exists

Simulation cards must display:

```text
SIMULATED TEST DATA
```

prominently.

## 5.4 Monthly saving projection

Projection periods:

- Weekly
- Monthly
- Annual

Scenarios:

- Conservative
- Expected
- High usage

Include:

- Input-token saving
- Image-token cost
- Cache effect
- Added local compute cost
- Added latency
- Retrieval overhead
- Net saving
- Confidence
- Break-even point

The projection must never silently mix fake and real data.

## 5.5 GitHub Actions benchmark badge

Simulation-mode badge examples:

```text
Fixel Recall: benchmark passing
Fixel Recall: 38% synthetic input reduction
Fixel Recall: protected values imaged 0
```

Build:

- Deterministic synthetic workflow
- JSON evidence artifact
- Static SVG badge
- README embed example
- Pull-request comment summary
- No provider key requirement
- No private repository-content upload

## 5.6 Public model compatibility leaderboard

In this phase, create a **local leaderboard simulator**, not a public service.

Rank by separate dimensions:

- Gist accuracy
- Structural accuracy
- Exact-string accuracy
- Token efficiency
- Latency
- Multilingual coverage
- Retrieval dependency
- Overall Safe-mode recommendation

Do not collapse everything into one misleading score.

Add:

- Evidence signature
- Profile version
- Renderer version
- Test corpus version
- Run date
- Expiry
- Reproducibility status

## 5.7 pxpipe and renderer doctor

New command:

```bash
fixel-recall renderer doctor
```

Checks:

- Adapter installed
- Upstream version or commit
- Licence notices
- Native dependencies
- Font availability
- Temporary directory
- Deterministic render
- Golden-image comparison
- Glyph coverage
- Page dimensions
- Exact-sidecar creation
- Secret-cleaning boundary
- Model-profile support
- Simulated image-token cost
- Cleanup after crash

Results:

- Healthy
- Degraded
- Unsafe
- Unsupported

## 5.8 Policy presets

Product-facing presets:

| Friendly name | Internal mode | Purpose                                    |
| ------------- | ------------- | ------------------------------------------ |
| Observe Only  | Bypass/Audit  | Understand waste without changing requests |
| Protect First | Safe          | Recommended default                        |
| Save More     | Balanced      | More compression with stronger recovery    |
| Lab Mode      | Max           | Experimental synthetic testing only        |

Presets can define:

- Eligible sources
- Minimum block age
- Minimum saving
- Allowed languages
- Profile threshold
- Page density
- Recovery requirement
- Maximum added latency
- Adaptation permission

---

# 6. P2 defensibility blueprint

## 6.1 Exact-context retrieval

Already built by Prompt 10.

Completion work:

- Track which compressed block caused retrieval.
- Track whether retrieval corrected an uncertain answer.
- Use retrieval dependence as an adaptation signal.
- Expose retrieval in the editor extension.
- Add audit receipts without logging raw retrieved text.

## 6.2 Per-user adaptive compression

Local-only adaptive engine.

It may learn from:

- Block types repeatedly retrieved
- User overrides
- Renderer failures
- Accuracy canary failures
- Workload composition
- Cache intensity
- Languages and scripts
- Average context size
- Latency sensitivity
- Successful and failed benchmarks

It may adapt:

- Minimum block age
- Minimum block size
- Eligible source categories
- Renderer density
- Sidecar strength
- Recovery requirement
- Preset recommendation

It may not adapt:

- Secret handling
- Current-instruction protection
- Code and command protection in Safe mode
- Unknown-risk fallback
- Authorisation controls

Safety mechanisms:

- Shadow recommendation first
- Minimum evidence count
- Bounded changes
- Explainable proposed change
- User approval
- Rollback
- Reset profile
- No cross-user learning in this phase

## 6.3 Signed profile registry

Build a local signed-registry simulator.

Profile bundle includes:

- Profile ID
- Provider family
- Model family
- Claimed model version
- Renderer and font profile
- Test corpus version
- Scores
- Issue and expiry dates
- Minimum client version
- Revocation status
- Signature
- Key ID

Client behaviour:

- Verify signature
- Verify expiry
- Verify client compatibility
- Cache last trusted version
- Reject rollback attacks
- Reject unknown key
- Quarantine revoked profile
- Work offline with last trusted unexpired profile
- Fall back to text when no trusted profile exists

## 6.4 Automatic canaries after change

Create a synthetic provider-change event system.

Changes to monitor:

- Model version
- Provider family
- Provider route
- Renderer version
- Font pack
- Token-accounting rule
- Client version
- Registry profile
- Test corpus version

When a change occurs:

1. Mark profile `RETEST_REQUIRED`.
2. Disable image conversion.
3. Run canaries.
4. Compare against prior thresholds.
5. Re-enable only after pass.
6. Record evidence.
7. Notify through CLI, dashboard and extension.

## 6.5 Multilingual font and glyph profiles

Initial scripts:

- Latin
- Devanagari
- Arabic
- Simplified Chinese
- Traditional Chinese
- Japanese
- Korean
- Thai
- Cyrillic
- Mixed code and prose
- Emoji and technical symbols

Profile dimensions:

- Font source and licence
- Unicode coverage
- Text shaping
- Bidirectional behaviour
- Line breaking
- Normalisation
- Glyph density
- Gist score
- Exact-string score
- Image cost
- Safe status

Do not bundle font binaries in public artifacts unless licensing permits it.

## 6.6 Team policy distribution

Build a local team-policy simulator.

Policy hierarchy:

```text
Built-in safety floor
        |
        v
Organisation mandatory policy
        |
        v
Team policy
        |
        v
Repository policy
        |
        v
User preference
```

A lower level cannot weaken a mandatory higher-level safety rule.

Features:

- Signed policy bundle
- Version
- Expiry
- Required preset
- Forbidden modes
- Approved profiles
- Allowed languages
- Minimum saving
- Retention rules
- Export restrictions
- Override rules
- Offline cache
- Conflict explanation

## 6.7 Enterprise audit trail

Create a local append-only audit design.

Event fields:

- Event ID
- Previous-event hash
- Timestamp
- Installation ID
- Synthetic actor ID
- Project and session pseudonyms
- Policy version
- Model profile
- Decision type
- Reason codes
- Protected counts
- Retrieval count
- Outcome
- Evidence hash

Requirements:

- Tamper-evident hash chain
- No raw body
- No secret
- Retention and deletion policy
- JSONL export
- CSV summary
- Verification command
- Synthetic SIEM export adapter
- Role-based report views simulated locally

## 6.8 Editor extension

Build a development-only VS Code-compatible extension.

Features:

- Gateway health
- Active provider simulator
- Current preset
- Context budget meter
- Context X-ray panel
- Protected-value count
- Fallback events
- Exact retrieval action
- Benchmark action
- Compatibility verdict
- Monthly projection
- Model-profile status
- Canary status
- Start, stop and kill switch
- Uninstall guidance

The extension must call local Fixel Recall APIs. It must not duplicate safety logic.

---

# 7. Synthetic user and workload matrix

The product needs a seeded test-data factory.

## User U1: Log-heavy solo developer

- Host: Codex
- Language: English
- Large repetitive terminal logs
- Low cache
- Medium exactness
- Expected verdict: Recommended

## User U2: Code-heavy security engineer

- Host: Claude Code
- Mostly diffs, commands and secrets
- High exactness
- Expected verdict: Audit Only or Not Worth Using

## User U3: Highly cached documentation user

- Host: both
- Long stable instructions
- Very high cache
- Expected verdict: Not Worth Using

## User U4: Multilingual developer

- Host: Claude Code
- English, Hindi and Japanese documents
- Expected verdict depends on font profiles

## User U5: Tool-heavy agent builder

- Host: Codex
- Many completed and active tool calls
- Expected behaviour: completed safe output eligible, active state native

## User U6: Team-managed developer

- Organisation policy requires Protect First
- User requests Lab Mode
- Expected behaviour: policy conflict, higher rule wins

## User U7: Provider-change canary

- Previously supported model profile
- Synthetic model version changes
- Expected behaviour: quarantine and re-test

## User U8: Secret-leak adversarial fixture

- Fake keys in logs, headers and errors
- Expected behaviour: zero persistence and zero rendered secrets

---

# 8. Definition of complete in simulation mode

The project is complete for this phase when:

- Original Prompts 0–10 remain passing.
- Original Prompts 11–29 are completed using fake providers only.
- All Blueprint 2.0 extension prompts pass.
- One-command simulation onboarding works.
- Full rollback works from its manifest.
- Personal compatibility audit produces all verdicts.
- "Not worth using" is demonstrated.
- Context X-ray works end to end.
- Monthly projection labels synthetic data.
- Share card and badge contain no forbidden fields.
- Local leaderboard accepts only signed synthetic evidence.
- Renderer doctor catches seeded failures.
- Adaptive engine proposes safe bounded changes.
- Registry signature and revocation tests pass.
- Provider-change quarantine works.
- Multilingual profiles fall back safely.
- Team policy hierarchy works.
- Audit chain verifies and detects tampering.
- Editor extension operates local APIs.
- No test needs a provider key.
- Network-isolation test passes.
- Seeded secrets appear in no persisted logs, images, exports or artifacts.
- The full synthetic user-acceptance suite passes for Codex and Claude Code.

---

# 9. Future real-integration boundary

Real APIs may be added later only after an explicit founder decision.

Before that point:

- Do not run a real provider canary.
- Do not publish a public leaderboard.
- Do not operate a remote policy service.
- Do not collect public telemetry.
- Do not submit the extension to a marketplace.
- Do not convert simulated savings into marketing claims.

When approved, real integrations should replace simulator adapters, not rewrite the core.
