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

export function anthropicCanaryOutputLimit(body: Readonly<Record<string, unknown>>): unknown {
  return body["max_tokens"];
}

type JsonObject = { readonly [key: string]: JsonValue };
type MutableJsonObject = { [key: string]: JsonValue };

export interface AnthropicGatewayMetadata {
  readonly requiredHeaders: readonly string[];
  readonly betaCapabilities: readonly string[];
}

export interface AnthropicMessagesAdapterState {
  readonly originalRequest: JsonObject;
  readonly requestId: string;
  readonly activeOrMalformedToolState: boolean;
  readonly gatewayMetadata: AnthropicGatewayMetadata;
  readonly messages: readonly AnthropicMessageState[];
}

export interface AnthropicMessageState {
  readonly messageIndex: number;
  readonly role: NormalizedRole;
  readonly raw: JsonObject;
  readonly blockIds: readonly BlockId[];
  readonly mutable: boolean;
  readonly toolUseIds: readonly string[];
  readonly toolResultForIds: readonly string[];
}

export interface AnthropicParseResult {
  readonly request: NormalizedRequest;
  readonly state: AnthropicMessagesAdapterState;
}

export interface AnthropicRebuildOptions {
  readonly imagesByBlockId?: ReadonlyMap<BlockId, readonly string[]>;
  readonly transformedTextByBlockId?:
    | ReadonlyMap<BlockId, string>
    | Readonly<Record<string, string>>;
}

interface ParsedMessage {
  readonly message: ReturnType<typeof createMessage>;
  readonly state: AnthropicMessageState;
}

export function createAnthropicAdapterRequest(id: string): NormalizedRequest {
  return createNormalizedRequest({
    id: requestId(id),
    provider: "anthropic",
    messages: [],
    providerMetadata: createProviderMetadata("anthropic", "anthropic_messages")
  });
}

export function parseAnthropicMessagesRequest(input: {
  readonly id: string;
  readonly body: JsonObject;
  readonly requiredHeaders?: readonly string[];
  readonly betaCapabilities?: readonly string[];
}): AnthropicParseResult {
  const gatewayMetadata = {
    requiredHeaders: input.requiredHeaders ?? ["anthropic-version", "x-api-key"],
    betaCapabilities: input.betaCapabilities ?? []
  };
  const providerMetadata = createProviderMetadata("anthropic", "anthropic_messages", {
    model: readString(input.body["model"]),
    streaming: input.body["stream"] === true,
    cacheSensitive: hasCacheContinuityFields(input.body),
    preservedHeaders: gatewayMetadata.requiredHeaders
  });
  const wireMessages = readMessages(input.body);
  const toolState = classifyToolState(wireMessages);
  const parsedMessages = wireMessages.map((message, index) =>
    parseMessage({
      message,
      messageIndex: index,
      requestProviderMetadata: providerMetadata,
      lockToolState: toolState.activeOrMalformed
    })
  );

  return {
    request: createNormalizedRequest({
      id: requestId(input.id),
      provider: "anthropic",
      messages: parsedMessages.map((message) => message.message),
      providerMetadata
    }),
    state: {
      originalRequest: cloneJsonObject(input.body),
      requestId: input.id,
      activeOrMalformedToolState: toolState.activeOrMalformed,
      gatewayMetadata,
      messages: parsedMessages.map((message) => message.state)
    }
  };
}

export function rebuildAnthropicMessagesRequest(
  parseResult: AnthropicParseResult,
  options: AnthropicRebuildOptions = {}
): JsonObject {
  const rebuilt = cloneJsonObject(parseResult.state.originalRequest);
  const messages = rebuilt["messages"];
  if (!Array.isArray(messages)) {
    return rebuilt;
  }

  const replacements = options.transformedTextByBlockId;
  if (replacements === undefined || parseResult.state.activeOrMalformedToolState) {
    return rebuilt;
  }

  for (const messageState of parseResult.state.messages) {
    if (!messageState.mutable) {
      continue;
    }
    const message = messages[messageState.messageIndex];
    if (!isJsonObject(message)) {
      continue;
    }
    patchTextContent(message, messageState.blockIds, replacements);
    const images = options.imagesByBlockId?.get(messageState.blockIds[0]!);
    if (
      images !== undefined &&
      typeof message["content"] === "string" &&
      message["role"] === "user"
    ) {
      (message as MutableJsonObject)["content"] = [
        { type: "text", text: message["content"] },
        ...images.map((data) => ({
          type: "image",
          source: { type: "base64", media_type: "image/png", data }
        }))
      ];
    }
  }
  return rebuilt;
}

function parseMessage(input: {
  readonly message: JsonObject;
  readonly messageIndex: number;
  readonly requestProviderMetadata: ProviderMetadata;
  readonly lockToolState: boolean;
}): ParsedMessage {
  const role = roleFromMessage(input.message);
  const sourceCategory = sourceCategoryFromRole(role);
  const messageMetadata = createProviderMetadata("anthropic", "anthropic_messages", {
    endpoint: "/v1/messages",
    model: input.requestProviderMetadata.model,
    streaming: input.requestProviderMetadata.streaming,
    cacheSensitive: messageHasCacheContinuityFields(input.message),
    preservedHeaders: input.requestProviderMetadata.preservedHeaders
  });
  const blocks = parseBlocks(input.message, input.messageIndex, sourceCategory, messageMetadata);
  const toolUseIds = blocks
    .map((block) => readToolUseIdFromBlock(block))
    .filter((value): value is string => value !== undefined);
  const toolResultForIds = readToolResultIds(input.message);
  const mutable = input.lockToolState !== true && role !== "assistant";

  return {
    message: createMessage({
      id: messageId(`anthropic-message-${input.messageIndex}`),
      order: orderIndex(input.messageIndex),
      role,
      blocks,
      providerMetadata: messageMetadata
    }),
    state: {
      messageIndex: input.messageIndex,
      role,
      raw: cloneJsonObject(input.message),
      blockIds: blocks.map((block) => block.id),
      mutable,
      toolUseIds,
      toolResultForIds
    }
  };
}

function parseBlocks(
  message: JsonObject,
  messageIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): readonly NormalizedBlock[] {
  const content = message["content"];
  if (Array.isArray(content)) {
    return content.map((part, partIndex) =>
      parseContentBlock(part, messageIndex, partIndex, sourceCategory, providerMetadata)
    );
  }
  if (typeof content === "string") {
    return [
      textBlock({
        id: blockId(`anthropic-${messageIndex}-content`),
        order: orderIndex(0),
        text: content,
        sourceCategory,
        providerMetadata,
        raw: { content }
      })
    ];
  }
  return [unknownBlock(message, messageIndex, 0, sourceCategory, providerMetadata)];
}

function parseContentBlock(
  part: JsonValue,
  messageIndex: number,
  partIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): NormalizedBlock {
  if (!isJsonObject(part)) {
    return unknownBlock({ value: part }, messageIndex, partIndex, sourceCategory, providerMetadata);
  }
  const type = readString(part["type"]);
  if (type === "text" && typeof part["text"] === "string") {
    return textBlock({
      id: blockId(`anthropic-${messageIndex}-${partIndex}`),
      order: orderIndex(partIndex),
      text: part["text"],
      sourceCategory,
      providerMetadata,
      raw: part
    });
  }
  if (type === "image") {
    return imageBlock(part, messageIndex, partIndex, sourceCategory, providerMetadata);
  }
  if (type === "tool_use") {
    return textBlock({
      id: blockId(`anthropic-${messageIndex}-${partIndex}-tool-use`),
      order: orderIndex(partIndex),
      text: JSON.stringify(part["input"] ?? {}),
      sourceCategory: "tool_call",
      providerMetadata,
      raw: part
    });
  }
  if (type === "tool_result") {
    return textBlock({
      id: blockId(`anthropic-${messageIndex}-${partIndex}-tool-result`),
      order: orderIndex(partIndex),
      text: toolResultText(part),
      sourceCategory: "tool_result",
      providerMetadata,
      raw: part
    });
  }
  return unknownBlock(part, messageIndex, partIndex, sourceCategory, providerMetadata);
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
    exactnessRisk: input.sourceCategory === "tool_call" ? "verbatim_critical" : "gist_safe",
    recoverability: notRecoverable("safe_mode"),
    providerMetadata: input.providerMetadata,
    decision: keepNativeDecision(["safe_mode"]),
    passThrough: passThrough(input.raw)
  });
}

function imageBlock(
  raw: JsonObject,
  messageIndex: number,
  partIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): NormalizedKnownBlock {
  return {
    id: blockId(`anthropic-${messageIndex}-${partIndex}-image`),
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
  messageIndex: number,
  partIndex: number,
  sourceCategory: SourceCategory,
  providerMetadata: ProviderMetadata
): NormalizedBlock {
  return {
    id: blockId(`anthropic-${messageIndex}-${partIndex}-unknown`),
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
  message: MutableJsonObject,
  blockIds: readonly BlockId[],
  replacements: NonNullable<AnthropicRebuildOptions["transformedTextByBlockId"]>
): void {
  const content = message["content"];
  if (Array.isArray(content)) {
    for (let index = 0; index < content.length; index += 1) {
      const blockIdForPart = blockIds[index];
      const replacement =
        blockIdForPart === undefined ? undefined : getReplacement(replacements, blockIdForPart);
      const part = content[index];
      if (replacement !== undefined && isJsonObject(part) && part["type"] === "text") {
        content[index] = { ...part, text: replacement };
      }
    }
    return;
  }
  const replacement =
    blockIds[0] === undefined ? undefined : getReplacement(replacements, blockIds[0]);
  if (replacement !== undefined && typeof content === "string") {
    message["content"] = replacement;
  }
}

function getReplacement(
  replacements: NonNullable<AnthropicRebuildOptions["transformedTextByBlockId"]>,
  id: BlockId
): string | undefined {
  if (replacements instanceof Map) {
    return replacements.get(id);
  }
  const keyedReplacements = replacements as Readonly<Record<string, string>>;
  return keyedReplacements[id];
}

function classifyToolState(messages: readonly JsonObject[]): {
  readonly activeOrMalformed: boolean;
} {
  const toolUses = new Map<string, number>();
  const toolResults = new Map<string, number>();
  for (const message of messages) {
    const content = message["content"];
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (!isJsonObject(part)) {
        continue;
      }
      if (part["type"] === "tool_use") {
        const id = readString(part["id"]);
        if (id !== undefined) {
          toolUses.set(id, (toolUses.get(id) ?? 0) + 1);
        }
      }
      if (part["type"] === "tool_result") {
        const id = readString(part["tool_use_id"]);
        if (id !== undefined) {
          toolResults.set(id, (toolResults.get(id) ?? 0) + 1);
        }
      }
    }
  }
  for (const [id, count] of toolUses) {
    if (count !== 1 || toolResults.get(id) !== 1) {
      return { activeOrMalformed: true };
    }
  }
  for (const [id, count] of toolResults) {
    if (count !== 1 || toolUses.get(id) !== 1) {
      return { activeOrMalformed: true };
    }
  }
  return { activeOrMalformed: false };
}

function roleFromMessage(message: JsonObject): NormalizedRole {
  const role = readString(message["role"]);
  if (role === "user" || role === "assistant") {
    return role;
  }
  return "unknown";
}

function sourceCategoryFromRole(role: NormalizedRole): SourceCategory {
  if (role === "assistant") {
    return "conversation_history";
  }
  if (role === "user") {
    return "conversation_history";
  }
  return "unknown";
}

function readMessages(body: JsonObject): readonly JsonObject[] {
  const messages = body["messages"];
  return Array.isArray(messages) ? messages.filter(isJsonObject) : [];
}

function readToolResultIds(message: JsonObject): readonly string[] {
  const content = message["content"];
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .filter(isJsonObject)
    .map((part) => (part["type"] === "tool_result" ? readString(part["tool_use_id"]) : undefined))
    .filter((value): value is string => value !== undefined);
}

function readToolUseIdFromBlock(block: NormalizedBlock): string | undefined {
  const raw = block.passThrough?.raw;
  if (!isJsonObject(raw) || raw["type"] !== "tool_use") {
    return undefined;
  }
  return readString(raw["id"]);
}

function toolResultText(part: JsonObject): string {
  const content = part["content"];
  if (typeof content === "string") {
    return content;
  }
  return JSON.stringify(content ?? "");
}

function hasCacheContinuityFields(body: JsonObject): boolean {
  return (
    body["container"] !== undefined ||
    body["metadata"] !== undefined ||
    body["context_management"] !== undefined
  );
}

function messageHasCacheContinuityFields(message: JsonObject): boolean {
  if (message["cache_control"] !== undefined) {
    return true;
  }
  const content = message["content"];
  return (
    Array.isArray(content) &&
    content.filter(isJsonObject).some((part) => part["cache_control"] !== undefined)
  );
}

function passThrough(raw: JsonObject): OriginalPassThroughFragment {
  return {
    encoding: "json",
    raw,
    integrity: {
      algorithm: "sha256",
      digest: "not-yet-hashed-anthropic-pass-through"
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
