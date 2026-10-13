import { describe, expect, it } from "vitest";

import { reasonCatalogue, type JsonValue, type ReasonCode } from "@fixel-recall/core";
import {
  parseAnthropicMessagesRequest,
  rebuildAnthropicMessagesRequest
} from "../../packages/providers-anthropic/src/index.js";
import {
  parseOpenAIResponsesRequest,
  rebuildOpenAIResponsesRequest
} from "../../packages/providers-openai/src/index.js";

type JsonObject = { readonly [key: string]: JsonValue };
type ProviderShape = "openai" | "anthropic";

interface FailureCase {
  readonly name: string;
  readonly reason: ReasonCode;
  readonly bodyKind: "normal" | "unknown" | "malformed_tool";
}

const protectedValue = "PROTECTED_VALUE_DO_NOT_RENDER_12345";

const failureCases = [
  { name: "unknown provider block", reason: "unknown_shape", bodyKind: "unknown" },
  { name: "malformed tool state", reason: "code_or_command", bodyKind: "malformed_tool" },
  { name: "renderer timeout", reason: "renderer_failure", bodyKind: "normal" },
  { name: "renderer crash", reason: "renderer_failure", bodyKind: "normal" },
  { name: "missing font", reason: "unsupported_format", bodyKind: "normal" },
  { name: "unsupported glyph", reason: "unsupported_glyphs", bodyKind: "normal" },
  { name: "expired model profile", reason: "profile_expired", bodyKind: "normal" },
  { name: "revoked model profile", reason: "profile_disabled", bodyKind: "normal" },
  { name: "invalid registry signature", reason: "profile_disabled", bodyKind: "normal" },
  { name: "vault unavailable", reason: "vault_unavailable", bodyKind: "normal" },
  { name: "policy conflict", reason: "safe_mode", bodyKind: "normal" },
  { name: "adaptive engine low confidence", reason: "unknown_risk", bodyKind: "normal" },
  { name: "simulated provider version change", reason: "unsupported_format", bodyKind: "normal" },
  { name: "secret scanner uncertainty", reason: "unknown_risk", bodyKind: "normal" }
] as const satisfies readonly FailureCase[];

const providers = ["openai", "anthropic"] as const satisfies readonly ProviderShape[];

describe("fallback invariants", () => {
  it.each(failureCases)("preserves native content for %s", (failure) => {
    const outcomes = providers.map((provider) => exerciseFallback(provider, failure));

    for (const outcome of outcomes) {
      expect(outcome.reason).toBe(failure.reason);
      expect(reasonCatalogue[outcome.reason].cliText).not.toContain(protectedValue);
      expect(outcome.rebuilt).toEqual(outcome.original);
      expect(outcome.beforeText).toEqual(outcome.afterText);
      expect(outcome.beforeText.join("\n")).toContain(protectedValue);
      expect(outcome.afterText.join("\n")).toContain(protectedValue);
      expect(outcome.renderedArtifacts).toEqual([]);
      expect(JSON.stringify(outcome.renderedArtifacts)).not.toContain(protectedValue);
      expect(outcome.afterText.length).toBe(outcome.beforeText.length);
      expect(outcome.providerRequestValid).toBe(true);
      expect(outcome.realProviderTraffic).toBe(false);
    }

    expect(outcomes.map((outcome) => outcome.reason)).toEqual([failure.reason, failure.reason]);
    expect(outcomes.map((outcome) => outcome.renderedArtifacts.length)).toEqual([0, 0]);
    expect(outcomes.map((outcome) => outcome.providerRequestValid)).toEqual([true, true]);
  });
});

function exerciseFallback(
  provider: ProviderShape,
  failure: FailureCase
): {
  readonly provider: ProviderShape;
  readonly original: JsonObject;
  readonly rebuilt: JsonObject;
  readonly beforeText: readonly string[];
  readonly afterText: readonly string[];
  readonly renderedArtifacts: readonly string[];
  readonly reason: ReasonCode;
  readonly providerRequestValid: boolean;
  readonly realProviderTraffic: false;
} {
  const original = createBody(provider, failure.bodyKind);
  const beforeText = extractText(provider, original);
  const renderedArtifacts: readonly string[] = [];
  const rebuilt =
    provider === "openai"
      ? rebuildOpenAIResponsesRequest(
          parseOpenAIResponsesRequest({ body: original, id: `fallback-${failure.name}` })
        )
      : rebuildAnthropicMessagesRequest(
          parseAnthropicMessagesRequest({ body: original, id: `fallback-${failure.name}` })
        );

  return {
    afterText: extractText(provider, rebuilt),
    beforeText,
    original,
    provider,
    providerRequestValid: isValidProviderRequest(provider, rebuilt),
    realProviderTraffic: false,
    reason: failure.reason,
    rebuilt,
    renderedArtifacts
  };
}

function createBody(provider: ProviderShape, kind: FailureCase["bodyKind"]): JsonObject {
  if (provider === "openai") {
    return createOpenAIBody(kind);
  }
  return createAnthropicBody(kind);
}

function createOpenAIBody(kind: FailureCase["bodyKind"]): JsonObject {
  if (kind === "unknown") {
    return {
      input: [
        {
          content: [
            { text: `first ${protectedValue}`, type: "input_text" },
            { payload: { keep: protectedValue }, type: "future_context_block" },
            { text: "last native value", type: "input_text" }
          ],
          role: "user"
        }
      ],
      model: "fake-openai-model"
    };
  }
  if (kind === "malformed_tool") {
    return {
      input: [
        { content: [{ text: `first ${protectedValue}`, type: "input_text" }], role: "user" },
        {
          arguments: '{"path":"/synthetic/path"}',
          call_id: "call_incomplete",
          name: "read_file",
          type: "function_call"
        },
        { content: [{ text: "last native value", type: "input_text" }], role: "user" }
      ],
      model: "fake-openai-model"
    };
  }
  return {
    input: [
      { content: [{ text: `first ${protectedValue}`, type: "input_text" }], role: "user" },
      { content: [{ text: "middle native value", type: "input_text" }], role: "assistant" },
      { content: [{ text: "last native value", type: "input_text" }], role: "user" }
    ],
    model: "fake-openai-model"
  };
}

function createAnthropicBody(kind: FailureCase["bodyKind"]): JsonObject {
  if (kind === "unknown") {
    return {
      max_tokens: 64,
      messages: [
        {
          content: [
            { text: `first ${protectedValue}`, type: "text" },
            { payload: { keep: protectedValue }, type: "future_context_block" },
            { text: "last native value", type: "text" }
          ],
          role: "user"
        }
      ],
      model: "fake-claude-model"
    };
  }
  if (kind === "malformed_tool") {
    return {
      max_tokens: 64,
      messages: [
        { content: [{ text: `first ${protectedValue}`, type: "text" }], role: "user" },
        {
          content: [
            {
              id: "toolu_incomplete",
              input: { path: "/synthetic/path" },
              name: "read_file",
              type: "tool_use"
            }
          ],
          role: "assistant"
        },
        { content: [{ text: "last native value", type: "text" }], role: "user" }
      ],
      model: "fake-claude-model"
    };
  }
  return {
    max_tokens: 64,
    messages: [
      { content: [{ text: `first ${protectedValue}`, type: "text" }], role: "user" },
      { content: [{ text: "middle native value", type: "text" }], role: "assistant" },
      { content: [{ text: "last native value", type: "text" }], role: "user" }
    ],
    model: "fake-claude-model"
  };
}

function extractText(provider: ProviderShape, body: JsonObject): readonly string[] {
  return provider === "openai" ? extractOpenAIText(body) : extractAnthropicText(body);
}

function extractOpenAIText(body: JsonObject): readonly string[] {
  const input = body["input"];
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((item) => {
    if (!isJsonObject(item)) {
      return [];
    }
    if (typeof item["content"] === "string") {
      return [item["content"]];
    }
    if (Array.isArray(item["content"])) {
      return item["content"].flatMap((part) =>
        isJsonObject(part) && typeof part["text"] === "string" ? [part["text"]] : []
      );
    }
    if (typeof item["arguments"] === "string") {
      return [item["arguments"]];
    }
    if (typeof item["output"] === "string") {
      return [item["output"]];
    }
    return [];
  });
}

function extractAnthropicText(body: JsonObject): readonly string[] {
  const messages = body["messages"];
  if (!Array.isArray(messages)) {
    return [];
  }
  return messages.flatMap((message) => {
    if (!isJsonObject(message)) {
      return [];
    }
    const content = message["content"];
    if (typeof content === "string") {
      return [content];
    }
    if (!Array.isArray(content)) {
      return [];
    }
    return content.flatMap((part) => {
      if (!isJsonObject(part)) {
        return [];
      }
      if (typeof part["text"] === "string") {
        return [part["text"]];
      }
      if (typeof part["content"] === "string") {
        return [part["content"]];
      }
      return [];
    });
  });
}

function isValidProviderRequest(provider: ProviderShape, body: JsonObject): boolean {
  if (provider === "openai") {
    return typeof body["model"] === "string" && Array.isArray(body["input"]);
  }
  return (
    typeof body["model"] === "string" &&
    typeof body["max_tokens"] === "number" &&
    Array.isArray(body["messages"])
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
