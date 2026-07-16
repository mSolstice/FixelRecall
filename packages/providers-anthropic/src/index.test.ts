import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createFakeGateway } from "../../proxy/src/index.js";
import { parseAnthropicMessagesRequest, rebuildAnthropicMessagesRequest } from "./index.js";

const fixturePath = fileURLToPath(
  new URL("../../../tests/fixtures/anthropic/claude-messages-request.json", import.meta.url)
);

describe("Anthropic Messages adapter", () => {
  it("round-trips the sanitised transport-spike fixture without changes", () => {
    const body = readFixture();
    const parsed = parseAnthropicMessagesRequest({
      id: "anthropic-round-trip",
      body,
      requiredHeaders: ["anthropic-version", "x-api-key"],
      betaCapabilities: ["fake-beta-capability"]
    });

    expect(parsed.request.provider).toBe("anthropic");
    expect(parsed.request.providerMetadata).toMatchObject({
      model: "fake-claude-model",
      streaming: true,
      preservedHeaders: ["anthropic-version", "x-api-key"]
    });
    expect(parsed.state.gatewayMetadata.betaCapabilities).toEqual(["fake-beta-capability"]);
    expect(parsed.request.messages[0]?.blocks[0]).toMatchObject({
      kind: "text",
      text: "Sanitised Claude Code Messages request for fake gateway routing."
    });
    expect(rebuildAnthropicMessagesRequest(parsed)).toEqual(body);
  });

  it("transforms old history while preserving role, order and untouched fields", () => {
    const body = requestWithHistory();
    const parsed = parseAnthropicMessagesRequest({ id: "anthropic-transform", body });
    const oldHistoryBlock = parsed.request.messages[0]?.blocks[0];

    expect(parsed.request.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user"
    ]);
    expect(oldHistoryBlock?.id).toBe("anthropic-0-0");

    const rebuilt = rebuildAnthropicMessagesRequest(parsed, {
      transformedTextByBlockId: new Map([
        [oldHistoryBlock!.id, "[[CTX anthropic-0-0 rendered old history]]"]
      ])
    });

    expect(rebuilt["metadata"]).toEqual({ fixture: "old-history" });
    expect(rebuilt["messages"]).toEqual([
      {
        ...body.messages[0],
        content: [{ type: "text", text: "[[CTX anthropic-0-0 rendered old history]]" }]
      },
      body.messages[1],
      body.messages[2]
    ]);
  });

  it("preserves active tool-use state and ignores text transforms", () => {
    const body = requestWithActiveToolUse();
    const parsed = parseAnthropicMessagesRequest({ id: "anthropic-active-tool", body });
    const historyBlock = parsed.request.messages[0]?.blocks[0];

    expect(parsed.state.activeOrMalformedToolState).toBe(true);
    expect(
      rebuildAnthropicMessagesRequest(parsed, {
        transformedTextByBlockId: new Map([[historyBlock!.id, "do not apply"]])
      })
    ).toEqual(body);
  });

  it("preserves malformed tool_use/tool_result relationships unchanged", () => {
    const body = requestWithMalformedToolPair();
    const parsed = parseAnthropicMessagesRequest({ id: "anthropic-malformed-tool", body });
    const historyBlock = parsed.request.messages[0]?.blocks[0];

    expect(parsed.state.activeOrMalformedToolState).toBe(true);
    expect(
      rebuildAnthropicMessagesRequest(parsed, {
        transformedTextByBlockId: new Map([[historyBlock!.id, "do not apply"]])
      })
    ).toEqual(body);
  });

  it("passes unknown block types and fields through unchanged", () => {
    const body = {
      model: "fake-claude-model",
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: [{ type: "future_block", payload: { exact: true }, keep_field: "unchanged" }]
        }
      ],
      future_top_level: { keep: ["unchanged"] }
    } as const;
    const parsed = parseAnthropicMessagesRequest({ id: "anthropic-unknown", body });

    expect(parsed.request.messages[0]?.blocks[0]).toMatchObject({
      kind: "unknown",
      decision: { action: "PASS_THROUGH_UNKNOWN" }
    });
    expect(rebuildAnthropicMessagesRequest(parsed)).toEqual(body);
  });

  it("preserves cache-control fields", () => {
    const body = {
      model: "fake-claude-model",
      max_tokens: 64,
      metadata: { user_id: "synthetic-user" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Cached synthetic history.",
              cache_control: { type: "ephemeral" }
            }
          ]
        }
      ]
    } as const;
    const parsed = parseAnthropicMessagesRequest({ id: "anthropic-cache", body });

    expect(parsed.request.providerMetadata.cacheSensitive).toBe(true);
    expect(parsed.request.messages[0]?.providerMetadata.cacheSensitive).toBe(true);
    expect(rebuildAnthropicMessagesRequest(parsed)).toEqual(body);
  });

  it("preserves image content blocks", () => {
    const body = {
      model: "fake-claude-model",
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this sanitized image." },
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: "ZmFrZQ==" }
            }
          ]
        }
      ]
    } as const;
    const parsed = parseAnthropicMessagesRequest({ id: "anthropic-image", body });

    expect(parsed.request.messages[0]?.blocks.map((block) => block.kind)).toEqual([
      "text",
      "image"
    ]);
    expect(rebuildAnthropicMessagesRequest(parsed)).toEqual(body);
  });

  it("rebuilds a valid streaming request while preserving event order", async () => {
    const body = readFixture();
    const parsed = parseAnthropicMessagesRequest({ id: "anthropic-streaming-gateway", body });
    const rebuilt = rebuildAnthropicMessagesRequest(parsed);
    const gateway = createFakeGateway();
    await new Promise<void>((resolve) => {
      gateway.server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = gateway.server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/messages`, {
        method: "POST",
        headers: {
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "x-api-key": "fake-anthropic-key",
          "x-request-id": "anthropic-adapter-stream"
        },
        body: JSON.stringify(rebuilt)
      });
      expect(response.status).toBe(200);
      const streamText = await response.text();
      expect(streamText.indexOf("message_start")).toBeLessThan(
        streamText.indexOf("content_block_delta")
      );
      expect(streamText.indexOf("content_block_delta")).toBeLessThan(
        streamText.indexOf("message_stop")
      );
    } finally {
      await gateway.close();
    }
  });
});

function readFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, unknown>;
}

function requestWithHistory() {
  return {
    model: "fake-claude-model",
    max_tokens: 64,
    metadata: { fixture: "old-history" },
    messages: [
      { role: "user", content: [{ type: "text", text: "Old gist-safe history." }] },
      { role: "assistant", content: [{ type: "text", text: "Assistant model output." }] },
      { role: "user", content: [{ type: "text", text: "Current user turn." }] }
    ]
  } as const;
}

function requestWithActiveToolUse() {
  return {
    model: "fake-claude-model",
    max_tokens: 64,
    messages: [
      { role: "user", content: [{ type: "text", text: "History before active tool." }] },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_active_1",
            name: "read_file",
            input: { path: "/fake/path" }
          }
        ]
      }
    ]
  } as const;
}

function requestWithMalformedToolPair() {
  return {
    model: "fake-claude-model",
    max_tokens: 64,
    messages: [
      { role: "user", content: [{ type: "text", text: "History before malformed tool." }] },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_missing_1", content: "missing call" }]
      }
    ]
  } as const;
}
