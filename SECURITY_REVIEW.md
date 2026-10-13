# Security Review

Review date: 2026-07-17

Scope read:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/SECURITY_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/ACCEPTANCE_CRITERIA.md`
- `docs/DECISIONS.md`

Reviewer posture: strict application-security review of the current local Fixel Recall
implementation.

## Findings

### HIGH: Upstream allowlist used prefix matching

**Evidence:** `packages/proxy/src/index.ts` accepted an upstream when the configured URL started
with an allowlist string.

**Exploit path:** A local operator could intend to allow `http://127.0.0.1:1`, but
`http://127.0.0.1:12345/v1/responses` also matched that prefix. The gateway would then forward
provider authentication headers to an origin that was not exactly allowlisted.

**Affected files:**

- `packages/proxy/src/index.ts`
- `packages/proxy/src/index.test.ts`

**Recommended fix:** Parse upstream and allowlist entries as URLs and compare exact origins.

**Status:** Fixed. Regression coverage now proves a prefix-looking allowlist value does not
authorize a different origin and no fake auth header reaches that upstream.

### HIGH: Upstream redirects could be followed with credentials

**Evidence:** `packages/proxy/src/index.ts` forwarded requests with `fetch` without setting manual
redirect handling.

**Exploit path:** An allowlisted upstream, compromised local proxy or misconfiguration could return
a redirect to an attacker-controlled origin. If the runtime followed the redirect, forwarded
provider authentication headers could be exposed outside the allowlist.

**Affected files:**

- `packages/proxy/src/index.ts`
- `packages/proxy/src/index.test.ts`

**Recommended fix:** Set `redirect: "manual"`, block all 3xx upstream responses, return a generic
provider error without exposing the redirect destination, and test that redirected hosts receive no
credentials.

**Status:** Fixed. Regression coverage now proves redirected hosts receive no fake auth header and
logs do not include the fake auth value or raw body canary.

### MEDIUM: User-defined firewall regexes can be expensive if exposed to untrusted users

**Evidence:** `packages/firewall/src/index.ts` accepts `userProtectedPatterns` and runs each pattern
over the full source text.

**Exploit path:** If future CLI, dashboard or configuration surfaces accept arbitrary regular
expressions, a catastrophic expression could consume CPU and deny service during scanning.

**Affected files:**

- `packages/firewall/src/index.ts`

**Recommended fix:** Before exposing user patterns outside trusted tests/config, validate pattern
complexity, cap runtime with a safe regex engine, or use literal/structured match rules instead of
arbitrary regular expressions.

**Status:** Not fixed in this pass because the current code path is internal and no high-confidence
untrusted input path was found. Track before making user-defined patterns operator-configurable.

### MEDIUM: MCP retrieval logs full opaque IDs

**Evidence:** `packages/retrieval-mcp/src/index.ts` logs project, session and block IDs after
filtering path-like values.

**Exploit path:** Local logs could correlate stable project and session identifiers across events.
The IDs do not reveal raw paths, but full identifiers are still durable correlation handles.

**Affected files:**

- `packages/retrieval-mcp/src/index.ts`

**Recommended fix:** Hash or truncate IDs in retrieval logs while keeping full IDs only in in-memory
authorization checks and tool results.

**Status:** Not fixed in this pass because no critical/high confidentiality break was found;
document as a privacy-hardening task.

### LOW: Dashboard serving boundary is not implemented in this package

**Evidence:** `apps/dashboard/src/index.ts` renders static HTML and declares no raw-context API or
remote analytics. No HTTP dashboard server binding was found in scope.

**Exploit path:** A future server wrapper could accidentally bind publicly or add raw-context
endpoints.

**Affected files:**

- `apps/dashboard/src/index.ts`

**Recommended fix:** When a dashboard server is added, enforce loopback binding by default, keep
raw-context APIs absent, and add binding tests.

**Status:** No code change required for the current static renderer.

### LOW: Installer and uninstaller remain preview-only

**Evidence:** `packages/cli/src/index.ts` generates setup previews and uninstall instructions
without writing host configuration.

**Exploit path:** Future write-enabled setup could overwrite user configuration or install hooks
without a transactional restore path.

**Affected files:**

- `packages/cli/src/index.ts`
- `skill-source/fixel-recall/references/CODEX_SETUP.md`
- `skill-source/fixel-recall/references/CLAUDE_CODE_SETUP.md`

**Recommended fix:** Before enabling writes, require explicit confirmation, write a manifest, make
operations transactional, and preserve restore/uninstall instructions.

**Status:** No code change required for current preview-only behavior.

## Areas Reviewed

- Authentication header handling: high redirect and allowlist issues fixed; ordinary logs remain
  metadata-only.
- Raw body logging: existing 4xx suite covers status `400`, `401`, `403`, `404`, `409`, `413`,
  `415`, `422` and `429`; no raw body logging was found.
- Secret scanning: deterministic scanner protects common credential shapes and high-entropy
  canaries; regex hardening remains a medium future risk.
- Secret rendering: renderer interface requires policy approval and secret-cleaned input;
  secret-sensitive protected spans fail rendering.
- Vault storage: vault rejects secret-sensitive spans, enforces scoped IDs, integrity hashes, expiry
  and deletion markers.
- Project and session isolation: IDs are opaque, validated and path-hostile; cross-project/session
  retrieval returns null.
- Path traversal: vault and retrieval reject path-like IDs and never accept filesystem paths from
  tools.
- MCP retrieval: narrow retrieval, caps and authorization are implemented; log minimization can be
  improved.
- Local dashboard exposure: static output hides raw context, exposes no raw-context API and uses no
  remote analytics by default.
- Upstream allowlisting: exact origin comparison is now enforced.
- Redirects: upstream redirects are now blocked manually.
- Request size and denial of service: gateway has byte caps, timeouts and request/header timeouts;
  regex hardening remains future work.
- Temporary images and crash leftovers: renderer doctor covers temp cleanup; no ordinary raw-content
  temp image persistence was found in scope.
- Dependency risk: no new production dependency was added in this review. Existing dependency
  footprint is small and lockfile-pinned.
- Prompt injection: safety defaults keep current, code, command and unknown-risk content native;
  future operator-configurable regex and hooks should remain non-destructive.
- Installer and uninstaller: preview-only with no credential storage; write-enabled installation
  remains future work.
- Codex configuration: generated preview uses local gateway URL and environment key name only, not
  credential values.
- Claude Code configuration and hooks: generated preview uses `ANTHROPIC_BASE_URL`, optional
  non-destructive hook example and no credential values.

## Remaining Risks

- User-defined protected regexes need hardening before exposure to untrusted operators.
- Retrieval logs should be minimized further by hashing or truncating opaque IDs.
- A future dashboard server, installer or uninstaller must preserve loopback-only, no-credential and
  transactional restore guarantees.
