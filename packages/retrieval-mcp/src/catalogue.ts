import {
  assertContextBlockId,
  assertProjectId,
  assertSessionId,
  type LocalContextVault,
  type StoredContextBlock
} from "@fixel-recall/vault";

export interface ContextCellReference {
  readonly blockId: string;
  readonly relatedBlockIds?: readonly string[];
}

export interface ContextCell {
  readonly block_id: string;
  readonly category: StoredContextBlock["sourceCategory"];
  readonly description: string;
  readonly created_at: string;
  readonly expires_at: string;
  readonly integrity_status: "verified";
  readonly source_freshness: "unknown";
  readonly trust: "untrusted_source_data";
  readonly related_block_ids: readonly string[];
}

export interface ContextCataloguePage {
  readonly cells: readonly ContextCell[];
  readonly next_offset: number | null;
  readonly truncated: boolean;
  readonly unavailable: boolean;
}

export interface ContextCatalogueOptions {
  readonly vault: LocalContextVault;
  /** Supplied by the trusted host, never by model tool arguments. */
  readonly authority: { readonly projectId: string; readonly sessionId: string };
  readonly references: readonly ContextCellReference[];
  readonly maxMetadataBytes?: number;
}

const descriptions: Record<StoredContextBlock["sourceCategory"], string> = {
  current_instruction: "Current instruction",
  conversation_history: "Conversation history",
  tool_result: "Tool result",
  terminal_output: "Terminal output",
  external_content: "External content",
  tool_call: "Tool call",
  source_code: "Source code",
  documentation: "Documentation",
  unknown: "Unclassified source"
};

/** An in-memory catalogue of host-registered references; never indexes files or generates summaries. */
export function createContextCatalogue(options: ContextCatalogueOptions) {
  const { projectId, sessionId } = options.authority;
  assertProjectId(projectId);
  assertSessionId(sessionId);
  const maxBytes = options.maxMetadataBytes ?? 16_384;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 512 || maxBytes > 65_536) {
    throw new Error("catalogue metadata limit must be between 512 and 65536 bytes");
  }
  if (options.references.length > 100) throw new Error("catalogue reference limit exceeded");
  const references = options.references.map((ref) => {
    assertContextBlockId(ref.blockId);
    const related = [...(ref.relatedBlockIds ?? [])];
    if (related.length > 8) throw new Error("catalogue relation limit exceeded");
    related.forEach((id) => assertContextBlockId(id));
    return { blockId: ref.blockId, related };
  });
  if (new Set(references.map((ref) => ref.blockId)).size !== references.length) {
    throw new Error("duplicate catalogue reference");
  }

  return {
    async list(
      input: { readonly offset?: number; readonly limit?: number; readonly query?: string } = {}
    ): Promise<ContextCataloguePage> {
      const offset = input.offset ?? 0;
      const limit = input.limit ?? 10;
      if (
        input.query !== undefined &&
        (typeof input.query !== "string" ||
          input.query.length > 80 ||
          !/^[a-zA-Z _-]+$/.test(input.query))
      ) {
        throw new Error("invalid catalogue query");
      }
      const query = input.query?.trim().toLowerCase() ?? "";
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset > references.length ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 20
      ) {
        throw new Error("invalid catalogue page bounds");
      }
      const valid = new Map<string, StoredContextBlock>();
      try {
        // Revalidate on every read so expired, deleted or corrupted blocks are never advertised.
        for (const ref of references) {
          const block = await options.vault.retrieveBlock({
            projectId,
            sessionId,
            blockId: ref.blockId
          });
          if (
            block !== null &&
            block.projectId === projectId &&
            block.sessionId === sessionId &&
            block.blockId === ref.blockId
          ) {
            valid.set(ref.blockId, block);
          }
        }
      } catch {
        return { cells: [], next_offset: null, truncated: false, unavailable: true };
      }
      const cells: ContextCell[] = [];
      let cursor = offset;
      while (cursor < references.length && cells.length < limit) {
        const ref = references[cursor]!;
        const block = valid.get(ref.blockId);
        if (
          block === undefined ||
          !`${block.sourceCategory} ${descriptions[block.sourceCategory]}`
            .toLowerCase()
            .includes(query)
        ) {
          cursor++;
          continue;
        }
        const cell: ContextCell = {
          block_id: block.blockId,
          category: block.sourceCategory,
          description: descriptions[block.sourceCategory],
          created_at: block.createdAt.toISOString(),
          expires_at: block.expiresAt.toISOString(),
          integrity_status: "verified",
          source_freshness: "unknown",
          trust: "untrusted_source_data",
          related_block_ids: ref.related.filter((id) => id !== ref.blockId && valid.has(id))
        };
        const candidate = {
          cells: [...cells, cell],
          // null and false reserve the longest possible page-envelope encoding.
          next_offset: null,
          truncated: false,
          unavailable: false
        };
        if (Buffer.byteLength(JSON.stringify(candidate), "utf8") > maxBytes) {
          if (cells.length === 0)
            return { cells: [], next_offset: null, truncated: true, unavailable: true };
          break;
        }
        cells.push(cell);
        cursor++;
      }
      return {
        cells,
        next_offset: cursor < references.length ? cursor : null,
        truncated: cursor < references.length,
        unavailable: false
      };
    }
  };
}
