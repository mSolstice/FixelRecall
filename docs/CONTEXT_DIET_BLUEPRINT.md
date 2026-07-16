# Context Diet Product and Build Blueprint

## Version 2.0

Prepared: 14 July 2026

## One-line definition

Context Diet is a local, safety-first context gateway that reduces waste in long AI coding sessions
while keeping exact facts recoverable and proving whether the optimisation helped.

## Product promise

**Reduce waste. Protect facts. Prove the result.**

## The simple idea

AI coding agents repeatedly receive large blocks of instructions, history, logs, tool results and
documentation.

Some of that material needs letter-for-letter accuracy. Some only needs its meaning.

Context Diet separates the two.

- Exact, current, sensitive or action-critical material stays as native text.
- Old, repetitive and lower-risk material may be compressed into images or replaced with references.
- Every recoverable block keeps a local link to the exact original.
- When the model needs one exact detail, it retrieves only that narrow section.
- The system compares cost, latency and task quality against an uncompressed control.

---

# 1. Background

## 1.1 The problem

A coding-agent request may contain:

- System and developer instructions
- Tool schemas
- Earlier conversation
- Terminal logs
- Source files
- Test output
- Search results
- Completed tool calls
- Active tool-call state
- Repeated documentation

This creates four practical problems:

1. Repeated context can increase cost.
2. Old material leaves less room for useful new work.
3. Very large payloads can add processing latency.
4. Users cannot easily see what consumes the context budget.

## 1.2 What pxpipe demonstrated

pxpipe demonstrated that selected text can be rendered into dense images and sent to a
vision-capable model. For some models and workloads, the image representation can cost fewer input
tokens than the source text.

The idea is useful, but it is lossy.

The model reads pixels, not original characters. Exact strings can be misread without producing an
obvious error.

## 1.3 Why Context Diet exists

Context Diet turns the pxpipe idea into a safer product by adding:

- Risk classification
- Exactness protection
- Secret detection
- Reversible local storage
- Exact retrieval
- Provider-aware routing
- Model-specific profiles
- Personal A/B benchmarking
- Plain-language explanations
- Codex and Claude Code support

---

# 2. Product purpose

Help developers use long AI coding sessions more efficiently while reducing the chance that
compressed context causes a wrong command, broken patch, false result or secret leak.

## What Context Diet will do

- Audit the contents of large requests.
- Group context by source and purpose.
- Estimate whether changing a block is worthwhile.
- Protect exact and sensitive spans.
- Compress only approved content.
- Maintain a reversible map to exact originals.
- Expose a narrow retrieval tool.
- Preserve streaming and provider-specific tool state.
- Compare uncompressed and optimised task runs.
- Show savings, risk and quality in a local dashboard.

## What Context Diet will not promise

- The same saving for every model or client
- Byte-perfect reading from images
- Safe compression of arbitrary code
- Savings on highly cached workloads
- Automatic support for untested model versions
- Cloud storage of raw prompts by default
- A magical skill that rewrites the request already invoking it

---

# 3. First-class platforms

Version 2 must support both:

## OpenAI Codex

Integration surfaces:

- Codex CLI
- Codex IDE extension
- Custom model provider with a local `base_url`
- OpenAI Responses-shaped requests
- `AGENTS.md`
- `.agents/skills/context-diet/`
- Optional MCP exact-retrieval server

## Anthropic Claude Code

Integration surfaces:

- Claude Code CLI
- Claude Code IDE extension
- `ANTHROPIC_BASE_URL` gateway routing
- Anthropic Messages-shaped requests
- `CLAUDE.md`
- `.claude/skills/context-diet/`
- Optional hooks for setup and checks
- Optional MCP exact-retrieval server

## Compatibility principle

There is one product, one safety engine and one canonical skill.

Provider and host differences are isolated in adapters and packaging.

---

# 4. Target users

| User              | Main problem                                | First value                  |
| ----------------- | ------------------------------------------- | ---------------------------- |
| Solo developer    | Long sessions become expensive or crowded   | Context audit and Safe mode  |
| Power user        | Needs more useful room without losing facts | Reversible compression       |
| Engineering lead  | Needs evidence before team rollout          | Benchmark report and policy  |
| Security reviewer | Fears secret leakage or silent corruption   | Threat model and audit trail |
| Agent-tool maker  | Needs reusable context infrastructure       | Core library and adapters    |

---

# 5. MVP scope

## Included in MVP

- Node.js local service
- TypeScript monorepo
- Codex custom-provider path
- Claude Code gateway path
- OpenAI Responses adapter
- Anthropic Messages adapter
- Normalised internal block model
- Exactness Firewall
- Deterministic policy engine
- Renderer interface
- pxpipe-compatible renderer adapter
- Local context vault
- Narrow exact-retrieval MCP tool
- CLI
- Basic local dashboard
- Personal benchmark harness
- Shared Agent Skill with two installation targets
- Safe mode and kill switch
- Privacy-safe metrics

## Deferred

- Hosted team control plane
- Shared cloud vault
- Learned personal classifier
- Enterprise policy console
- Public marketplace submission
- Automatic support for every coding agent
- Aggressive compression of source code
- Remote analytics containing raw content

---

# 6. User commands

| Command                       | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `context-diet doctor`         | Checks installation, gateway, storage, fonts, profiles and privacy settings |
| `context-diet audit`          | Shows what is consuming context and what is eligible                        |
| `context-diet start`          | Starts the local gateway                                                    |
| `context-diet stop`           | Stops the local gateway cleanly                                             |
| `context-diet status`         | Shows health, mode and routing                                              |
| `context-diet explain`        | Explains why a block was kept, redacted, imaged or indexed                  |
| `context-diet benchmark`      | Runs control and optimised comparisons                                      |
| `context-diet retrieve`       | Retrieves a narrow authorised exact section                                 |
| `context-diet delete-session` | Deletes one session and its recoverable blocks                              |
| `context-diet uninstall`      | Removes local configuration safely                                          |

---

# 7. Safety model: Exactness Firewall

Every block passes through the Exactness Firewall before any compression.

| Class               | Meaning                                   | Default action             |
| ------------------- | ----------------------------------------- | -------------------------- |
| Gist-safe           | Meaning matters more than every character | Eligible for compression   |
| Structure-sensitive | Layout and order matter                   | Compress carefully or keep |
| Verbatim-critical   | Every character may matter                | Keep as text               |
| Secret-sensitive    | Must not be rendered or stored            | Redact or protect          |
| Unknown-risk        | Safety cannot be established              | Keep as text               |

## Protected content

- Current user instructions
- System and developer rules required for the task
- Source code, diffs and patches
- Shell commands and SQL
- JSON keys and configuration
- File paths and URLs
- IP addresses, domains and ports
- Dates, timestamps and versions
- UUIDs, Git hashes and ticket IDs
- Database IDs and customer identifiers
- Numbers with units, prices and percentages
- Environment variable names
- API keys, tokens, cookies, passwords and private keys
- User-defined protected patterns
- Active or incomplete tool-call state

## Simple decision order

1. Is it current or required for the next action? Keep it.
2. Is it secret-sensitive? Redact or protect it.
3. Does the task require copying, patching, calculating or executing it exactly? Keep it.
4. Is the format, language or glyph coverage uncertain? Keep it.
5. Is the block recoverable and authorised? Continue.
6. Is the expected saving meaningful after sidecars and image cost? Continue.
7. Does the model profile pass current quality checks? Continue.
8. Otherwise, pass through the original.

---

# 8. Context lanes

## Exact lane

Native text only:

- Current instructions
- Code and diffs
- Commands
- IDs and hashes
- Numbers and versions
- Tool arguments
- Open tool state
- Security-sensitive values

## Recoverable lane

May be compressed after protection:

- Old file excerpts
- Completed tool output
- Terminal logs
- Documentation
- Earlier implementation discussion

Each block gets:

- Stable context ID
- Source hash
- Session and project scope
- Local vault reference
- Exact sidecar index
- Reason code
- Expiry and deletion metadata

## Semantic lane

May be compressed, summarised, deduplicated or removed:

- Repetitive history
- Old explanations
- Resolved planning discussion
- Low-priority narrative logs

---

# 9. Technical architecture

## Main components

| Component                | Job                                                         |
| ------------------------ | ----------------------------------------------------------- |
| CLI                      | Setup, audit, start, stop, explain and benchmark            |
| Local gateway            | Receives supported provider requests and forwards responses |
| OpenAI adapter           | Parses and rebuilds Responses requests                      |
| Anthropic adapter        | Parses and rebuilds Messages requests                       |
| Normalised request model | Provider-neutral internal representation                    |
| Context scanner          | Labels source, age, density and recoverability              |
| Exactness Firewall       | Detects protected and secret-sensitive spans                |
| Policy engine            | Chooses keep, redact, image, reference or drop              |
| Renderer interface       | Allows pxpipe or another renderer without core coupling     |
| Context vault            | Stores authorised exact originals locally                   |
| Retrieval MCP server     | Returns narrow exact sections                               |
| Model-profile registry   | Records image reading and cost assumptions                  |
| Metrics engine           | Records privacy-safe counts, decisions and outcomes         |
| Benchmark harness        | Runs comparable control and optimised tasks                 |
| Dashboard                | Shows Context X-ray, savings, risk and status               |
| Canonical skill          | Operates and explains the local engine                      |

## Request flow

```text
Codex or Claude Code
        |
        v
Local Context Diet gateway
        |
        v
Provider request adapter
        |
        v
Normalised request and blocks
        |
        v
Context scanner
        |
        v
Exactness Firewall
        |
        v
Policy engine
        |
        +---- keep native
        +---- redact protected values
        +---- render approved block
        +---- replace with recoverable reference
        +---- deduplicate or remove stale material
        |
        v
Provider request rebuild
        |
        v
OpenAI or Anthropic
```

Responses stream back without being rewritten.

## Exact recovery flow

```text
Model sees CTX reference
        |
        v
Calls get_exact_context
        |
        v
MCP server checks project, session and block authority
        |
        v
Searches or slices original locally
        |
        v
Returns only the narrow matching text
```

---

# 10. Provider adapter contract

## Provider-neutral core

The core works with normalised types such as:

```ts
type NormalizedMessage = {
  id: string;
  role: "system" | "developer" | "user" | "assistant" | "tool";
  blocks: NormalizedBlock[];
  providerMetadata?: Record<string, unknown>;
};

type NormalizedBlock = {
  id: string;
  kind: "text" | "image" | "tool-call" | "tool-result" | "file" | "log" | "metadata";
  content: unknown;
  exactnessRisk: "low" | "medium" | "high" | "critical";
  recoverable: boolean;
};
```

The final implementation may improve these types, but provider wire objects must not leak into the
policy engine.

## OpenAI adapter responsibilities

- Parse Responses request items
- Preserve developer, user, assistant and tool state
- Preserve function-call and function-call-output pairing
- Preserve image inputs
- Preserve provider fields required for caching and continuity
- Rebuild a valid request
- Pass through unknown shapes unchanged
- Stream output without unnecessary buffering

## Anthropic adapter responsibilities

- Parse Messages content blocks
- Preserve `tool_use` and `tool_result`
- Preserve image blocks
- Preserve cache-control and required beta headers
- Rebuild a valid request
- Pass through unknown block types unchanged
- Stream events in the correct order

---

# 11. Local vault and retrieval

## Vault rules

- Local only by default
- Separate projects and sessions
- Store no authentication headers
- Store no secret-sensitive spans
- Encrypt later if the threat model requires it
- Atomic writes
- Crash-safe cleanup
- Explicit deletion commands
- Configurable expiry
- Narrow read interface
- No arbitrary filesystem path reads

## Retrieval inputs

- Project ID
- Session ID
- Context block ID
- Search pattern or line range
- Maximum characters requested

## Retrieval checks

- Block belongs to the current authorised project
- Block belongs to the allowed session
- Range is within limits
- Pattern cannot escape into another file
- Returned content is capped
- Request and outcome are logged without raw content

---

# 12. Renderer strategy

The renderer is replaceable.

The core depends on an interface, not on pxpipe directly.

```ts
interface ContextRenderer {
  render(input: RenderInput): Promise<RenderResult>;
  healthCheck(profile: ModelProfile): Promise<RendererHealth>;
}
```

## Initial implementation

Use a pxpipe adapter or carefully reused upstream implementation after:

- Licence review
- Dependency review
- Golden render tests
- Glyph coverage tests
- Model readability tests
- Exact-token sidecar tests

## Failure rule

If rendering fails, glyph coverage is weak, the profile is unsupported, the vault is unavailable, or
profitability is negative, return the original text.

---

# 13. Model profiles

A profile records:

- Provider
- Model family and version
- Last tested date
- Expiry date
- Supported image dimensions
- Safe glyph density
- Image token accounting method
- Gist score
- Structure score
- Exact-string score
- Supported languages
- Status: enabled, canary, disabled or expired

An expired or failing profile disables imaging automatically.

A model name alone is not enough. Profiles must be versioned and tested.

---

# 14. Metrics and honest savings

Separate:

- Measured input tokens
- Estimated input tokens
- Cached input tokens
- Image tokens
- Output tokens
- Cost estimate
- Added latency
- Retrieval count
- Protected values detected
- Protected values accidentally imaged
- Test result
- Task agreement

Do not show a saving percentage when:

- No valid control exists
- Model or pricing changed between runs
- Tasks are not comparable
- One run failed
- Token values are unavailable
- Cache treatment differs in an unexplained way

A workload with strong provider caching may show little or no benefit. That is a valid result.

---

# 15. Dashboard

## Main cards

1. **Context X-ray**  
   What is consuming the request?

2. **Safe savings**  
   What was measured, estimated or unavailable?

3. **Risk ledger**  
   What was kept, redacted, imaged, indexed or retrieved?

4. **Model health**  
   Is this profile tested and current?

5. **Session control**  
   Safe, Balanced, Max, bypass and kill switch

## Privacy rule

Raw prompts, code and secrets are hidden by default.

## Optional share card

Allowed:

- Percentage input reduction
- Estimated total saving
- Tests passed
- Protected values imaged count
- Model family
- Benchmark date

Forbidden:

- Repository name
- Project hash
- Branch
- Paths
- Prompts
- Code
- Account identity
- Session IDs
- Provider keys

Export requires explicit confirmation.

---

# 16. Operating modes

## Safe mode

Default.

- Preserves all current and exact material
- Compresses only old gist-safe content
- Requires recoverability
- Requires a healthy model profile

## Balanced mode

Opt-in.

- Allows some structure-sensitive completed output
- Uses larger glyphs and stronger sidecars
- Requires successful personal benchmark

## Max mode

Experimental.

- Aggressive compression
- Not for production code changes
- Requires repeated warning and explicit session-level opt-in

## Bypass

Forwards supported requests unchanged while retaining health visibility.

---

# 17. Skills and plugins

## Canonical skill

`skill-source/context-diet/SKILL.md`

## Generated targets

- `.agents/skills/context-diet/`
- `.claude/skills/context-diet/`

## Skill responsibilities

- Explain Context Diet
- Run doctor and audit
- Start and stop the local service
- Run benchmarks
- Explain decisions
- Retrieve exact context through the local tool
- Troubleshoot configuration

## Skill boundary

The skill cannot compress the request already invoking it. It operates the gateway that transforms
future provider requests.

## Packaging

After the MVP works:

- Package Codex distribution according to current Codex plugin rules.
- Package Claude Code distribution with its plugin manifest, skills, optional hooks and MCP
  configuration.
- Keep platform packaging outside the provider-neutral engine.

---

# 18. Security principles

- Listen on localhost by default.
- Reject non-loopback binding unless explicitly configured.
- Do not log raw request bodies.
- Do not log authentication headers.
- Do not render secrets.
- Do not persist secrets.
- Prevent path traversal.
- Isolate projects and sessions.
- Limit request and retrieval sizes.
- Use timeouts and cancellation.
- Fail open for content transformation, meaning send original content when optimisation fails.
- Fail closed for unauthorised vault retrieval, meaning return nothing.
- Keep a runtime kill switch.
- Delete temporary image files safely.
- Review upstream pxpipe code and licence before reuse.

---

# 19. Benchmark design

Run three comparable paths:

1. Uncompressed control
2. Safe compressed
3. Safe compressed with exact retrieval available

Compare:

- Input tokens
- Cached tokens
- Output tokens
- Cost
- Latency
- Tool actions
- Files changed
- Tests passed
- Output agreement
- Retrieval calls
- Protected-value failures

Use safe repositories or synthetic fixtures first.

Do not test with private customer code during early development.

---

# 20. MVP success criteria

The MVP is successful when:

- Codex can route through the local OpenAI-compatible gateway.
- Claude Code can route through the local Anthropic-compatible gateway.
- Both preserve streaming.
- Both preserve active tool state.
- Unknown requests pass through unchanged.
- Secrets never appear in rendered output or logs in the test suite.
- Recoverable blocks can be retrieved only from the authorised project and session.
- A renderer failure returns original text.
- Skill copies stay synchronised.
- The dashboard distinguishes measured from estimated values.
- A benchmark can show either a positive, neutral or negative result honestly.
- Safe mode can be disabled instantly.

---

# 21. Roadmap

## Phase 0: Feasibility

- Verify Codex custom-provider routing
- Verify Claude Code gateway routing
- Capture fake request fixtures
- Confirm streaming and authentication pass-through
- Confirm MCP exact retrieval can be exposed to both

## Phase 1: Safe engine

- Normalised block model
- Exactness Firewall
- Policy engine
- Vault
- Retrieval
- Renderer interface

## Phase 2: Dual provider gateway

- OpenAI adapter
- Anthropic adapter
- Local proxy
- Streaming
- Kill switch
- CLI

## Phase 3: Proof

- Savings calculator
- Model profiles
- Benchmark harness
- Dashboard
- Share card

## Phase 4: Distribution

- Shared skill
- Codex package
- Claude Code plugin
- Installer
- Documentation
- Beta release

---

# 22. Non-negotiable decisions

1. Codex and Claude Code are both first-class.
2. Core logic stays provider-neutral.
3. Exactness beats headline savings.
4. Unknown means keep.
5. Secret-sensitive content is never rendered or persisted.
6. A failed optimisation sends the original.
7. A failed authorisation returns no vault content.
8. The vault is local by default.
9. The product reports evidence, not marketing maths.
10. The skill and gateway remain separate components.

---

# 23. Reference documentation

Official references should be rechecked during implementation because these tools change quickly:

- OpenAI Codex: AGENTS.md, skills, custom model providers, configuration and MCP
- Anthropic Claude Code: CLAUDE.md, skills, gateways, hooks, plugins and MCP
- Agent Skills open standard
- Model Context Protocol specification
- Node.js release schedule
- pnpm installation and workspace documentation
