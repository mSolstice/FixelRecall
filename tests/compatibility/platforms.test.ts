import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  createAnthropicAdapterRequest,
  parseAnthropicMessagesRequest,
  rebuildAnthropicMessagesRequest
} from "@fixel-recall/providers-anthropic";
import {
  createOpenAIAdapterRequest,
  parseOpenAIResponsesRequest,
  rebuildOpenAIResponsesRequest
} from "@fixel-recall/providers-openai";

describe("platform compatibility scaffold", () => {
  it("keeps Codex/OpenAI and Claude/Anthropic provider families represented", () => {
    expect([
      createOpenAIAdapterRequest("codex-route").provider,
      createAnthropicAdapterRequest("claude-route").provider
    ]).toEqual(["openai", "anthropic"]);
  });

  it("covers equivalent adapter capabilities for Codex and Claude Code", () => {
    const openai = parseOpenAIResponsesRequest({
      id: "compat-openai",
      body: openAIParityBody(),
      preservedHeaders: ["authorization", "openai-beta"]
    });
    const anthropic = parseAnthropicMessagesRequest({
      id: "compat-anthropic",
      body: anthropicParityBody(),
      betaCapabilities: ["fake-beta-capability"],
      requiredHeaders: ["anthropic-version", "x-api-key"]
    });

    expect(openai.request.providerMetadata).toMatchObject({
      rawShape: "openai_responses",
      streaming: true,
      cacheSensitive: true
    });
    expect(anthropic.request.providerMetadata).toMatchObject({
      rawShape: "anthropic_messages",
      streaming: true,
      cacheSensitive: true
    });
    expect(openai.state.activeOrMalformedToolState).toBe(false);
    expect(anthropic.state.activeOrMalformedToolState).toBe(false);
    expect(
      openai.request.messages.flatMap((message) => message.blocks.map((block) => block.kind))
    ).toEqual(expect.arrayContaining(["text", "image"]));
    expect(
      anthropic.request.messages.flatMap((message) => message.blocks.map((block) => block.kind))
    ).toEqual(expect.arrayContaining(["text", "image"]));
    expect(
      openai.request.messages.flatMap((message) =>
        message.blocks.map((block) => block.sourceCategory)
      )
    ).toEqual(expect.arrayContaining(["tool_call", "tool_result"]));
    expect(
      anthropic.request.messages.flatMap((message) =>
        message.blocks.map((block) => block.sourceCategory)
      )
    ).toEqual(expect.arrayContaining(["tool_call", "tool_result"]));
    expect(rebuildOpenAIResponsesRequest(openai)).toEqual(openAIParityBody());
    expect(rebuildAnthropicMessagesRequest(anthropic)).toEqual(anthropicParityBody());
  });

  it("keeps provider wire names out of the core package source", () => {
    const coreSource = readFileSync(
      fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "utf8"
    );

    expect(coreSource).not.toMatch(/\b(OpenAI|Anthropic|Responses|Messages)\b/);
    expect(coreSource).not.toContain("function_call");
    expect(coreSource).not.toContain("tool_use");
    expect(coreSource).not.toContain("cache_control");
  });
});

function openAIParityBody() {
  return {
    model: "fake-openai-model",
    previous_response_id: "resp_fake_previous",
    prompt_cache_key: "fake-cache-key",
    stream: true,
    input: [
      {
        role: "user",
        cache_control: { type: "ephemeral" },
        content: [
          { type: "input_text", text: "Codex parity text." },
          { type: "input_image", image_url: "data:image/png;base64,ZmFrZQ==" }
        ]
      },
      {
        type: "function_call",
        call_id: "call_parity_1",
        name: "read_file",
        arguments: '{"path":"/fake/path"}'
      },
      {
        type: "function_call_output",
        call_id: "call_parity_1",
        output: "synthetic tool result"
      }
    ]
  } as const;
}

function anthropicParityBody() {
  return {
    model: "fake-claude-model",
    max_tokens: 64,
    metadata: { fixture: "parity" },
    stream: true,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Claude Code parity text.",
            cache_control: { type: "ephemeral" }
          },
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: "ZmFrZQ==" }
          }
        ]
      },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_parity_1",
            name: "read_file",
            input: { path: "/fake/path" }
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_parity_1",
            content: "synthetic tool result"
          }
        ]
      }
    ]
  } as const;
}
