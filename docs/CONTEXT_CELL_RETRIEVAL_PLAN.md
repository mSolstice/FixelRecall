# Context Cell Retrieval Development

## Stage 1: Trusted retrieval scope

Implemented: retrieval is bound to a host-configured project and session. Tool arguments cannot
expand that scope. Missing authority denies reads. Invalid identifier text is excluded from logs.
The CLI MCP process requires `FIXEL_RECALL_PROJECT_ID` and `FIXEL_RECALL_SESSION_ID` in its launch
environment, using real IDs created by the local identity service. Neither value is a provider key.
Restart the MCP process when switching sessions. Both Codex and Claude Code use this same process.

This is a local process trust boundary, not protection against another process running as the same
OS user. The host must supply the scope independently of model output. Existing unscoped MCP launch
configurations must be updated before retrieval can work.

## Stage 2: Exact sections and failure handling

Implemented: sections are sliced from stored text, preserving internal LF, CRLF and CR separators.
The final selected line's separator is excluded. Responses include half-open `source_range` offsets
in UTF-16 code units. Return limits do not split surrogate pairs or CRLF delimiters; grapheme
clusters can still be split. Both selectors scan only the configured search window and flag partial
results as truncated. Vault failures return no content and log only a safe outcome code. Tests cover
line endings, Unicode, bounded scanning and storage failure alongside expiry and corruption. Vault
loading remains bounded by its block-size limit, not the search window.

## Stage 3: Compact catalogue

Implemented as the public `createContextCatalogue` API in the retrieval package. The host registers
up to 100 opaque references at construction; model arguments cannot register blocks or change scope.
Reads revalidate references through the vault in the fixed authorized namespace. Missing, expired
and deleted records are omitted; storage or integrity failures return an unavailable empty page.
Categories have fixed descriptions, avoiding content-derived summaries and path disclosure. Creation
and expiry dates describe storage lifetime. Source freshness is explicitly unknown. Related
references appear only when registered and successfully verified in the same scope.

Pages contain up to 20 entries and default to a 16 KiB serialized metadata budget (maximum 64 KiB).
Registration order is stable, with offset pagination. Each read checks at most 100 blocks; vault
block-size limits still apply. This API is provider-neutral and uses no network. It is not yet
automatically populated or injected into requests. Stage 4 exposes the discovery boundary. No
filesystem catalogue or arbitrary user-written labels are accepted.

## Stage 4: Bounded discovery

Implemented: `find_context_cells` browses the scoped catalogue using optional category-word `query`,
`offset` and `limit`. No scope or registration arguments are accepted. Queries are literal, limited
to 80 ASCII letters, spaces, underscores and hyphens. Raw-text and semantic search are not
implemented. Catalogue page and metadata limits apply; invalid calls return fixed safe errors. Call
`get_exact_context` with the discovered ID, host-provided project/session IDs and a narrow selector.
Retrieved content remains untrusted data. No printed FETCH or EVICT commands execute.

Both hosts use `fixel-recall mcp retrieval`. At launch the trusted host supplies
`FIXEL_RECALL_CONTEXT_BLOCK_IDS`, a JSON array of up to 100 actual vault block IDs, alongside
`FIXEL_RECALL_PROJECT_ID` and `FIXEL_RECALL_SESSION_ID`. Missing registration means an empty
catalogue. Restart to change registrations. No provider credentials are needed. Automatic
registration remains future integration work.

## Stage 5: Selective replacement and evidence

The implementation now defines a typed host-issued retrieval lease. A lease is a short-lived,
session-scoped record containing only authorized opaque block IDs, expiry, the retrieval tool
capability and the original-content integrity hashes. The model cannot create or extend it. The
gateway may replace an old block only when the lease exists, the block passes the Exactness
Firewall, exact recovery has already been verified, the provider adapter rebuilds a valid request,
and the complete rebuilt request is smaller after retrieval overhead. Current instructions, code,
commands, active tools, unknown shapes and protected values remain native.

The replacement is a clearly labelled historical reference containing the opaque block ID and the
real retrieval tool name. It is useful only when the host has registered that tool for the same
session. The gateway does not assume that a provider can understand arbitrary latent vectors or
plain-text FETCH commands. Every failed check preserves the original request bytes.

The remaining work is to replace the current synthetic experiment with a typed lease API, make the
gateway create and validate leases from trusted session state, add OpenAI and Anthropic request
fixtures, and measure complete task success, retrieval overhead, latency and failures. No release or
savings claim should depend on the experiment until those tests pass.

Stages 1 through 4 are implemented. No automatic indexing, context eviction or savings claim follows
from it. Real provider traffic, publication and user configuration writes require separate
authorization.
