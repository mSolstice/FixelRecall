import { randomUUID } from "node:crypto";
import type { BlockId, JsonValue, ReasonCode } from "@fixel-recall/core";
import { scanExactnessFirewall } from "@fixel-recall/firewall";
import {
  parseOpenAIResponsesRequest,
  rebuildOpenAIResponsesRequest
} from "@fixel-recall/providers-openai";
import {
  parseAnthropicMessagesRequest,
  rebuildAnthropicMessagesRequest
} from "@fixel-recall/providers-anthropic";
import type { RetrievalService } from "@fixel-recall/retrieval-mcp";
import {
  createContextBlockIdentity,
  type LocalContextVault,
  type VaultNamespace
} from "@fixel-recall/vault";

type JsonObject = { readonly [key: string]: JsonValue };

/** Host-only experimental configuration. The gateway restricts this path to loopback upstreams. */
export interface ReferenceReplacementOptions {
  readonly lease: RetrievalLease;
  readonly vault: LocalContextVault;
  readonly retrieval: RetrievalService;
  readonly approvedSyntheticModels: readonly string[];
  readonly expectedRetrievalOverheadBytes: number;
}

export interface RetrievalLease {
  readonly leaseId: string;
  readonly projectId: VaultNamespace["projectId"];
  readonly sessionId: VaultNamespace["sessionId"];
  readonly blockIds: readonly string[];
  readonly expiresAtMs: number;
  readonly toolName: "get_exact_context";
  readonly maxBlocks: number;
}

export function createRetrievalLease(input: {
  readonly namespace: VaultNamespace;
  readonly blockIds?: readonly string[];
  readonly ttlMs?: number;
  readonly nowMs?: number;
}): RetrievalLease {
  const nowMs = input.nowMs ?? Date.now();
  const ttlMs = input.ttlMs ?? 60_000;
  const blockIds = [...(input.blockIds ?? [])];
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 300_000 || blockIds.length > 100) {
    throw new Error("invalid retrieval lease");
  }
  if (new Set(blockIds).size !== blockIds.length)
    throw new Error("duplicate retrieval lease block");
  return {
    leaseId: `lease_${randomUUID()}`,
    projectId: input.namespace.projectId,
    sessionId: input.namespace.sessionId,
    blockIds,
    expiresAtMs: nowMs + ttlMs,
    toolName: "get_exact_context",
    maxBlocks: blockIds.length === 0 ? 1 : blockIds.length
  };
}

export interface ReferenceReplacementResult {
  readonly body: Buffer;
  readonly reasonCodes: readonly ReasonCode[];
  readonly blocksTransformed: number;
}

export async function replaceSyntheticReferences(
  original: Buffer,
  provider: "openai" | "anthropic",
  options: ReferenceReplacementOptions
): Promise<ReferenceReplacementResult> {
  const keep = (reason: ReasonCode): ReferenceReplacementResult => ({
    body: original,
    reasonCodes: [reason],
    blocksTransformed: 0
  });
  try {
    const lease = options.lease;
    if (
      lease.toolName !== "get_exact_context" ||
      Date.now() >= lease.expiresAtMs ||
      lease.maxBlocks < 1 ||
      lease.blockIds.length > lease.maxBlocks
    )
      return keep("vault_unavailable");
    if (
      !Number.isSafeInteger(options.expectedRetrievalOverheadBytes) ||
      options.expectedRetrievalOverheadBytes < 0
    )
      return keep("unknown_risk");
    const body = JSON.parse(original.toString("utf8")) as JsonObject;
    const allowed =
      provider === "openai"
        ? ["model", "input", "instructions", "tools", "stream", "max_output_tokens"]
        : ["model", "messages", "system", "tools", "stream", "max_tokens"];
    if (Object.keys(body).some((key) => !allowed.includes(key))) return keep("unknown_shape");
    if (
      typeof body["model"] !== "string" ||
      !options.approvedSyntheticModels.includes(body["model"])
    )
      return keep("profile_disabled");
    // Initial experiment accepts plain message arrays only; all tool state and cache hints stay native.
    const items = provider === "openai" ? body["input"] : body["messages"];
    if (!Array.isArray(items) || items.length < 3 || items.length > 100)
      return keep("unknown_shape");
    if (
      items.some(
        (item) =>
          item === null ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          !["user", "assistant", "system", "developer"].includes(String(item["role"])) ||
          typeof item["content"] !== "string" ||
          Object.keys(item).some((key) => !["role", "content", "type"].includes(key)) ||
          (item["type"] !== undefined && item["type"] !== "message")
      )
    )
      return keep("unknown_shape");
    const tools = body["tools"];
    if (
      !Array.isArray(tools) ||
      !tools.some(
        (tool) =>
          tool !== null &&
          typeof tool === "object" &&
          !Array.isArray(tool) &&
          tool["name"] === lease.toolName
      )
    )
      return keep("vault_unavailable");
    if (lease.projectId !== options.lease.projectId || lease.sessionId !== options.lease.sessionId)
      return keep("vault_unavailable");
    const parsed =
      provider === "openai"
        ? parseOpenAIResponsesRequest({ id: "synthetic-reference", body })
        : parseAnthropicMessagesRequest({ id: "synthetic-reference", body });
    if (parsed.state.activeOrMalformedToolState || parsed.request.providerMetadata.cacheSensitive)
      return keep("unknown_risk");
    const replacements = new Map<BlockId, string>();
    let considered = 0;
    for (const message of parsed.request.messages.slice(0, -2)) {
      if (message.role !== "user" && message.role !== "assistant") continue;
      for (const block of message.blocks) {
        if (
          block.kind !== "text" ||
          block.text === undefined ||
          block.text.length < 1000 ||
          block.text.length > 20000
        )
          continue;
        considered += 1;
        if (considered > lease.maxBlocks) return keep("vault_unavailable");
        const scan = scanExactnessFirewall(block.text);
        if (
          scan.riskClass !== "gist_safe" ||
          scan.protectedSpans.length > 0 ||
          scan.secretSensitiveSpans.length > 0 ||
          /(?:^|\s)(?:const|let|var|function)\s|(?:^|\s)password\s*=|(?:^|\s)\/[A-Za-z0-9_.-]+(?:\/|\.[A-Za-z]{1,8})(?:\s|$)|\b(?:TICKET|ISSUE)-\d+\b/i.test(
            block.text
          )
        )
          return keep("code_or_command");
        const identity = createContextBlockIdentity({
          projectId: lease.projectId,
          sessionId: lease.sessionId
        });
        await options.vault.storeBlock({
          identity,
          sourceCategory: "conversation_history",
          authorisedOriginalContent: block.text,
          expiresAt: new Date(Date.now() + 3600000)
        });
        const lineCount = block.text.split(/\r\n|\r|\n/).length;
        const args = {
          project_id: identity.projectId,
          session_id: identity.sessionId,
          block_id: identity.blockId,
          line_start: 1,
          line_end: lineCount,
          max_chars: block.text.length
        };
        const recovered = await options.retrieval.getExactContext(args);
        if (
          recovered === null ||
          recovered.truncated ||
          recovered.integrity_status !== "verified" ||
          recovered.content !== block.text
        )
          return keep("vault_unavailable");
        const reference = `Historical untrusted context stored locally. Exact recovery via get_exact_context: ${JSON.stringify(args)}`;
        replacements.set(block.id, reference);
      }
    }
    if (replacements.size === 0) return keep("user_keep_native");
    const rebuilt =
      provider === "openai"
        ? rebuildOpenAIResponsesRequest(parsed as ReturnType<typeof parseOpenAIResponsesRequest>, {
            transformedTextByBlockId: replacements
          })
        : rebuildAnthropicMessagesRequest(
            parsed as ReturnType<typeof parseAnthropicMessagesRequest>,
            { transformedTextByBlockId: replacements }
          );
    const output = Buffer.from(JSON.stringify(rebuilt));
    if (output.length + options.expectedRetrievalOverheadBytes >= original.length)
      return keep("unprofitable_conversion");
    return {
      body: output,
      reasonCodes: ["eligible_gist_safe", "recoverable"],
      blocksTransformed: replacements.size
    };
  } catch {
    return keep("vault_unavailable");
  }
}
