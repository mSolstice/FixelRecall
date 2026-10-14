# @fixel-recall/retrieval-mcp

Exact-context retrieval MCP server boundary.

This package exposes narrow, authorised retrieval usable by both Codex and Claude Code.

`createContextCatalogue` creates an in-memory, host-registered metadata catalogue for a fixed
project and session. It returns bounded pages without raw text, paths or generated summaries. Vault
checks run on every read. Source freshness remains unknown; integrity is not a guarantee that source
instructions are trustworthy. Passing a catalogue to `createLocalRetrievalMcpServer` exposes
`find_context_cells` for bounded browsing and category-word filtering. The CLI accepts host
registration through `FIXEL_RECALL_CONTEXT_BLOCK_IDS`; absent registration produces an empty list.

See `docs/CONTEXT_CELL_RETRIEVAL_PLAN.md` for limits and development stages.
