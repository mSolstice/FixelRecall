# Context Diet Security Model

## Security objective

Context Diet sits in a sensitive position. It may see prompts, source material, tool output and
provider credentials while forwarding requests.

The product must reduce context without becoming a credential collector, secret-rendering machine or
cross-project data leak.

## Trust boundaries

```text
User machine
├── Codex or Claude Code
├── Context Diet gateway
├── Local vault
├── Local dashboard
└── Local MCP retrieval server
        |
        v
Network boundary
        |
        v
Allowlisted model provider
```

## Sensitive assets

- API keys and authentication tokens
- Source code
- Prompts and conversation history
- File paths and repository identity
- Customer data in logs or fixtures
- Exact values used in commands
- Vault contents
- Project and session identifiers
- Benchmark results tied to private repositories

## Main threats

### 1. Credential leakage

Risk:

- Header logging
- Exception dumps
- Debug traces
- Dashboard exposure
- Test snapshots

Controls:

- Redact before logging
- Store no authentication headers
- Use fake keys in tests
- Keep credential values out of configuration committed to Git
- Add regression tests that scan logs

### 2. Secret rendering

Risk:

A secret inside a log or file excerpt is rendered into an image and sent upstream or saved locally.

Controls:

- Run secret scanner before renderer
- Mask or exclude protected spans
- Entropy-based and pattern-based detection
- User-defined protected patterns
- Block rendering when scanner confidence is uncertain
- Test generated images and sidecars for known canary secrets

### 3. Silent exactness corruption

Risk:

A model misreads an image and uses a wrong path, ID, version or number.

Controls:

- Exactness Firewall
- Safe mode
- Native exact sidecar
- Reversible block IDs
- MCP retrieval
- Keep current and action-critical content native
- Model profile exact-string tests
- No claim of byte-perfect images

### 4. Cross-project vault access

Risk:

One repository or session retrieves another project's context.

Controls:

- Strong project and session scoping
- Unpredictable block identifiers
- Authorisation checks on every retrieval
- No arbitrary filesystem paths in tool inputs
- Cross-project negative tests

### 5. Path traversal

Risk:

A query such as `../../secret` escapes the vault.

Controls:

- Block IDs, not filesystem paths
- Canonical path checks
- No user-controlled direct read paths
- Fixed storage root
- Traversal regression tests

### 6. Prompt injection inside compressed content

Risk:

Old logs or documents contain instructions that the model treats as current commands.

Controls:

- Label transformed blocks as historical or untrusted
- Keep instruction hierarchy explicit
- Do not transform content in a way that removes source labels
- Policy rules for tool output and external content
- Retrieval responses include source and trust metadata

### 7. Denial of service

Risk:

Huge request bodies, image rendering storms or broad retrieval searches exhaust resources.

Controls:

- Request-size limits
- Block-size and page limits
- Timeouts
- Concurrency limits
- Cancellation
- Retrieval maximums
- Disk quota and expiry

### 8. Local dashboard exposure

Risk:

Another device accesses the dashboard or raw data.

Controls:

- Loopback binding
- No raw content endpoints in MVP
- Random local session token if needed
- Clear warning before non-loopback binding
- No credential display

### 9. Upstream redirection

Risk:

Configuration sends credentials to an attacker-controlled host.

Controls:

- Explicit upstream allowlist
- Show upstream in `doctor` and `status`
- Require confirmation when host changes
- Reject mixed or unexpected schemes
- Prefer HTTPS upstream
- Never follow arbitrary redirects with credentials

### 10. Crash leftovers

Risk:

Temporary images or partial vault files remain after failure.

Controls:

- Atomic writes
- Restricted temporary directory
- Cleanup on success and failure
- Startup cleanup
- Retention policy
- Crash-recovery tests

## Failure philosophy

Two different failure rules are required.

### Transformation failure: pass original

When optimisation cannot be proven safe, preserve the original request content.

This avoids breaking the user's coding task.

### Authorisation failure: return nothing

When a vault retrieval is not authorised, do not fall back to a broad read.

This avoids leaking data.

## Logging policy

Allowed:

- Timestamp
- Provider family
- Model profile ID
- Block counts
- Character and token estimates
- Decision reason codes
- Timings
- Error codes without raw content
- Benchmark pass or fail

Forbidden by default:

- Raw prompts
- Raw tool output
- Authentication headers
- Secrets
- Full file paths
- Repository names
- User identity
- Retrieved exact text

## Security release gate

Do not release when:

- A known secret can enter a generated image
- Auth headers appear in logs
- Cross-project retrieval succeeds
- The proxy binds publicly by default
- A renderer failure drops content
- Unknown provider shapes are mutated
- High or critical findings remain unresolved
