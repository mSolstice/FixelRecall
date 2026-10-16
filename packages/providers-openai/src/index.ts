import {
  blockId,
  createMessage,
  createNormalizedRequest,
  createProviderMetadata,
  createTextBlock,
  keepNativeDecision,
  messageId,
  notRecoverable,
  orderIndex,
  requestId,
  type BlockId,
  type JsonValue,
  type NormalizedBlock,
  type NormalizedKnownBlock,
  type NormalizedRequest,
  type NormalizedRole,
  type OriginalPassThroughFragment,
  type ProviderMetadata,
  type SourceCategory
} from "@fixel-recall/core";

export {
  codexSubscriptionPaths,
  validateCodexSubscriptionBaseUrl,
  resolveCodexSubscriptionRoute,
  openAICanaryOutputLimit
} from "./subscription.js";

type JsonObject = { readonly [key: string]: JsonValue };
type MutableJsonObject = { [key: string]: JsonValue };

export interface OpenAIResponsesAdapterState {
  readonly originalRequest: JsonObject;
  readonly requestId: string;
  readonly activeOrMalformedToolState: boolean;
  readonly items: readonly OpenAIResponsesItemState[];
}

export interface OpenAIResponsesItemState {
  readonly itemIndex: number;
  readonly role: NormalizedRole;
  readonly raw: JsonObject;
  readonly blockIds: readonly BlockId[];
  readonly mutable: boolean;
  readonly toolCallId?: string;
  readonly toolOutputForCallId?: string;
}

export interface OpenAIParseResult {
  readonly request: NormalizedRequest;
  readonly state: OpenAIResponsesAdapterState;
}

export interface OpenAIRebuildOptions {
  readonly imagesByBlockId?: ReadonlyMap<BlockId, readonly string[]>;
  readonly transformedTextByBlockId?:
    | ReadonlyMap<BlockId, string>
    | Readonly<Record<string, string>>;
}

interface ParsedItem {
  readonly message: ReturnType<typeof createMessage>;
  readonly state: OpenAIResponsesItemState;
}

export function createOpenAIAdapterRequest(id: string): NormalizedRequest {
  return createNormalizedRequest({
    id: requestId(id),
    provider: "openai",
    messages: [],
    providerMetadata: createProviderMetadata("openai", "openai_responses")
  });
}

export function parseOpenAIResponsesRequest(input: {
  readonly id: string;
  readonly body: JsonObject;
  readonly preservedHeaders?: readonly string[];
}): OpenAIParseResult {
  const providerMetadata = createProviderMetadata("openai", "openai_responses", {
    model: readString(input.body["model"]),
    streaming: input.body["stream"] === true,
    cacheSensitive: hasCacheContinuityFields(input.body),
    preservedHeaders: input.preservedHeaders ?? []
  });
  const wireItems = readInputItems(input.body);
  const toolState = classifyToolState(wireItems);
  const parsedItems = wireItems.map((item, index) =>
    parseResponsesItem({
      item,
      itemIndex: index,
      requestProviderMetadata: providerMetadata,
      lockToolState: toolState.activeOrMalformed
    })
  );

  return {
    request: createNormalizedRequest({
      id: requestId(input.id),
      provider: "openai",
      messages: parsedItems.map((item) => item.message),
      providerMetadata
    }),
    state: {
      originalRequest: cloneJsonObject(input.body),
      requestId: input.id,
      activeOrMalformedToolState: toolState.activeOrMalformed,
      items: parsedItems.map((item) => item.state)
    }
  };
}

export function rebuildOpenAIResponsesRequest(
  parseResult: OpenAIParseResult,
  options: OpenAIRebuildOptions = {}
): JsonObject {
  const rebuilt = cloneJsonObject(parseResult.state.originalRequest);
  const input = rebuilt["input"];
  if (!Array.isArray(input)) {
    return rebuilt;
  }

  const replacements = options.transformedTextByBlockId;
  if (replacements === undefined || parseResult.state.activeOrMalformedToolState) {
    return rebuilt;
  }

  for (const itemState of parseResult.state.items) {
    if (!itemState.mutable) {
      continue;
    }
    const item = input[itemState.itemIndex];
    if (!isJsonObject(item)) {
      continue;
    }
    patchTextContent(item, itemState.blockIds, replacements);
    const images = options.imagesByBlockId?.get(itemState.blockIds[0]!);
    if (images !== undefined && typeof item["content"] === "string" && item["role"] === "user") {
      (item as MutableJsonObject)["content"] = [
        { type: "input_text", text: item["content"] },
        ...images.map((data) => ({
          type: "input_image",
          image_url: `data:image/png;base64,${data}`
        }))
      ];
    }
  }

  return rebuilt;
}

function parseResponsesItem(input: {
  readonly item: JsonObject;
  readonly itemIndex: number;
  readonly requestProviderMetadata: ProviderMetadata;
  readonly lockToolState: boolean;
}): ParsedItem {
  const role = roleFromItem(input.item);
  const sourceCategory = sourceCategoryFromRole(role);
  const itemMetadata = createProviderMetadata("openai", "openai_responses", {
    endpoint: "/v1/responses",
    model: input.requestProviderMetadata.model,
    streaming: input.requestProviderMetadata.streaming,
    cacheSensitive: itemHasCacheContinuityFields(input.item),
    preservedHeaders: input.requestProviderMetadata.preservedHeaders
  });
  const blocks = parseBlocksForItem(input.item, input.itemIndex, sourceCategory, itemMetadata);
  const toolCallId = readString(input.item["call_id"]);
  const toolOutputForCallId =
    input.item["type"] === "function_call_output" ? readString(input.item["call_id"]) : undefined;
  const mutable = input.lockToolState !== true && role !== "tool";

  return {
    message: createMessage({
      id: messageId(`openai-item-${input.itemIndex}`),
      order: orderIndex(input.itemIndex),
      role,
      blocks,
      providerMetadata: itemMetadata
    }),
    state: {
      itemIndex: input.itemIndex,
      role,
      raw: cloneJsonObject(input.item),
      blockIds: blocks.map((block) => block.id),
      mutable,
      ...(toolCallId === undefined ? {} : { toolCallId }),
      ...(toolOutputForCallId === undefined ? {} : { toolOutputForCallId })
    }
  };
}

function parseBlocksForItem(
  item: JsonObject,
  itemIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): readonly NormalizedBlock[] {
  const content = item["content"];
  if (Array.isArray(content)) {
    return content.flatMap((part, partIndex) =>
      parseContentPart(part, itemIndex, partIndex, sourceCategory, providerMetadata)
    );
  }
  if (typeof content === "string") {
    return [
      textBlock({
        id: blockId(`openai-${itemIndex}-content`),
        order: orderIndex(0),
        text: content,
        sourceCategory,
        providerMetadata,
        raw: { content }
      })
    ];
  }
  if (item["type"] === "function_call") {
    return [
      textBlock({
        id: blockId(`openai-${itemIndex}-function-call`),
        order: orderIndex(0),
        text: readString(item["arguments"]) ?? "",
        sourceCategory: "tool_call",
        providerMetadata,
        raw: item
      })
    ];
  }
  if (item["type"] === "function_call_output") {
    return [
      textBlock({
        id: blockId(`openai-${itemIndex}-function-output`),
        order: orderIndex(0),
        text: readString(item["output"]) ?? "",
        sourceCategory: "tool_result",
        providerMetadata,
        raw: item
      })
    ];
  }
  return [unknownBlock(item, itemIndex, 0, sourceCategory, providerMetadata)];
}

function parseContentPart(
  part: JsonValue,
  itemIndex: number,
  partIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): readonly NormalizedBlock[] {
  if (!isJsonObject(part)) {
    return [unknownBlock({ value: part }, itemIndex, partIndex, sourceCategory, providerMetadata)];
  }

  const type = readString(part["type"]);
  if (
    (type === "input_text" || type === "output_text" || type === "text") &&
    typeof part["text"] === "string"
  ) {
    return [
      textBlock({
        id: blockId(`openai-${itemIndex}-${partIndex}`),
        order: orderIndex(partIndex),
        text: part["text"],
        sourceCategory,
        providerMetadata,
        raw: part
      })
    ];
  }
  if (type === "input_image" || type === "output_image" || type === "image") {
    return [imageBlock(part, itemIndex, partIndex, sourceCategory, providerMetadata)];
  }
  return [unknownBlock(part, itemIndex, partIndex, sourceCategory, providerMetadata)];
}

function textBlock(input: {
  readonly id: BlockId;
  readonly order: ReturnType<typeof orderIndex>;
  readonly text: string;
  readonly sourceCategory: SourceCategory;
  readonly providerMetadata: ProviderMetadata;
  readonly raw: JsonObject;
}): NormalizedKnownBlock {
  return createTextBlock({
    id: input.id,
    order: input.order,
    text: input.text,
    sourceCategory: input.sourceCategory,
    exactnessRisk: "gist_safe",
    recoverability: notRecoverable("safe_mode"),
    providerMetadata: input.providerMetadata,
    decision: keepNativeDecision(["safe_mode"]),
    passThrough: passThrough(input.raw)
  });
}

function imageBlock(
  raw: JsonObject,
  itemIndex: number,
  partIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): NormalizedKnownBlock {
  return {
    id: blockId(`openai-${itemIndex}-${partIndex}-image`),
    order: orderIndex(partIndex),
    kind: "image",
    sourceCategory,
    exactnessRisk: "verbatim_critical",
    recoverability: notRecoverable("unsupported_format"),
    providerMetadata,
    passThrough: passThrough(raw),
    decision: keepNativeDecision(["unsupported_format"])
  };
}

function unknownBlock(
  raw: JsonObject,
  itemIndex: number,
  partIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): NormalizedBlock {
  return {
    id: blockId(`openai-${itemIndex}-${partIndex}-unknown`),
    order: orderIndex(partIndex),
    kind: "unknown",
    sourceCategory,
    exactnessRisk: "unknown_risk",
    recoverability: notRecoverable("unknown_shape"),
    providerMetadata,
    passThrough: passThrough(raw),
    decision: { action: "PASS_THROUGH_UNKNOWN", reasonCodes: ["unknown_shape"] }
  };
}

function patchTextContent(
  item: MutableJsonObject,
  blockIds: readonly BlockId[],
  replacements: NonNullable<OpenAIRebuildOptions["transformedTextByBlockId"]>
): void {
  const content = item["content"];
  if (Array.isArray(content)) {
    for (let index = 0; index < content.length; index += 1) {
      const blockIdForPart = blockIds[index];
      const replacement =
        blockIdForPart === undefined ? undefined : getReplacement(replacements, blockIdForPart);
      const part = content[index];
      if (replacement !== undefined && isJsonObject(part) && typeof part["text"] === "string") {
        content[index] = { ...part, text: replacement };
      }
    }
    return;
  }
  const replacement =
    blockIds[0] === undefined ? undefined : getReplacement(replacements, blockIds[0]);
  if (replacement !== undefined && typeof content === "string") {
    item["content"] = replacement;
  }
}

function getReplacement(
  replacements: NonNullable<OpenAIRebuildOptions["transformedTextByBlockId"]>,
  id: BlockId
): string | undefined {
  if (replacements instanceof Map) {
    return replacements.get(id);
  }
  const keyedReplacements = replacements as Readonly<Record<string, string>>;
  return keyedReplacements[id];
}

function roleFromItem(item: JsonObject): NormalizedRole {
  const role = readString(item["role"]);
  if (
    role === "developer" ||
    role === "user" ||
    role === "assistant" ||
    role === "system" ||
    role === "tool"
  ) {
    return role;
  }
  if (item["type"] === "function_call") {
    return "assistant";
  }
  if (item["type"] === "function_call_output") {
    return "tool";
  }
  return "unknown";
}

function sourceCategoryFromRole(role: NormalizedRole): SourceCategory {
  if (role === "developer" || role === "system") {
    return "current_instruction";
  }
  if (role === "tool") {
    return "tool_result";
  }
  return "conversation_history";
}

function classifyToolState(items: readonly JsonObject[]): { readonly activeOrMalformed: boolean } {
  const calls = new Map<string, number>();
  const outputs = new Map<string, number>();
  for (const item of items) {
    const callId = readString(item["call_id"]);
    if (callId === undefined) {
      continue;
    }
    if (item["type"] === "function_call") {
      calls.set(callId, (calls.get(callId) ?? 0) + 1);
    }
    if (item["type"] === "function_call_output") {
      outputs.set(callId, (outputs.get(callId) ?? 0) + 1);
    }
  }
  for (const [callId, count] of calls) {
    if (count !== 1 || outputs.get(callId) !== 1) {
      return { activeOrMalformed: true };
    }
  }
  for (const [callId, count] of outputs) {
    if (count !== 1 || calls.get(callId) !== 1) {
      return { activeOrMalformed: true };
    }
  }
  return { activeOrMalformed: false };
}

function readInputItems(body: JsonObject): readonly JsonObject[] {
  const input = body["input"];
  if (Array.isArray(input)) {
    return input.filter(isJsonObject);
  }
  if (typeof input === "string") {
    return [{ role: "user", content: input }];
  }
  return [];
}

function hasCacheContinuityFields(body: JsonObject): boolean {
  return (
    body["previous_response_id"] !== undefined ||
    body["store"] !== undefined ||
    body["truncation"] !== undefined ||
    body["prompt_cache_key"] !== undefined
  );
}

function itemHasCacheContinuityFields(item: JsonObject): boolean {
  return item["id"] !== undefined || item["cache_control"] !== undefined;
}

function passThrough(raw: JsonObject): OriginalPassThroughFragment {
  return {
    encoding: "json",
    raw,
    integrity: {
      algorithm: "sha256",
      digest: "not-yet-hashed-openai-pass-through"
    }
  };
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function isJsonObject(value: JsonValue | unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
