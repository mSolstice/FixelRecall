import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createFakeGateway } from "../../proxy/src/index.js";
import { parseOpenAIResponsesRequest, rebuildOpenAIResponsesRequest } from "./index.js";

const fixturePath = fileURLToPath(
  new URL("../../../tests/fixtures/openai/codex-responses-request.json", import.meta.url)
);

describe("OpenAI Responses adapter", () => {
  it("round-trips the sanitised transport-spike fixture without changes", () => {
    const body = readFixture();
    const parsed = parseOpenAIResponsesRequest({
      id: "openai-round-trip",
      body,
      preservedHeaders: ["openai-beta", "x-request-id"]
    });

    expect(parsed.request.provider).toBe("openai");
    expect(parsed.request.providerMetadata).toMatchObject({
      model: "fake-openai-model",
      streaming: true,
      preservedHeaders: ["openai-beta", "x-request-id"]
    });
    expect(parsed.request.messages).toHaveLength(1);
    expect(parsed.request.messages[0]?.blocks[0]).toMatchObject({
      kind: "text",
      text: "Sanitised Codex Responses request for fake gateway routing."
    });
    expect(rebuildOpenAIResponsesRequest(parsed)).toEqual(body);
  });

  it("transforms old history while preserving item order and untouched fields", () => {
    const body = requestWithHistory();
    const parsed = parseOpenAIResponsesRequest({ id: "openai-transform", body });
    const firstHistoryBlock = parsed.request.messages[1]?.blocks[0];
    expect(firstHistoryBlock?.id).toBe("openai-1-0");

    const rebuilt = rebuildOpenAIResponsesRequest(parsed, {
      transformedTextByBlockId: new Map([
        [firstHistoryBlock!.id, "[[CTX openai-1-0 rendered old history]]"]
      ])
    });

    expect(rebuilt["metadata"]).toEqual({ fixture: "old-history" });
    expect(rebuilt["input"]).toEqual([
      body.input[0],
      {
        ...body.input[1],
        content: [{ type: "input_text", text: "[[CTX openai-1-0 rendered old history]]" }]
      },
      body.input[2]
    ]);
  });

  it("preserves active tool-call state and ignores text transforms", () => {
    const body = requestWithActiveToolCall();
    const parsed = parseOpenAIResponsesRequest({ id: "openai-active-tool", body });
    const historyBlock = parsed.request.messages[0]?.blocks[0];

    expect(parsed.state.activeOrMalformedToolState).toBe(true);
    expect(
      rebuildOpenAIResponsesRequest(parsed, {
        transformedTextByBlockId: new Map([[historyBlock!.id, "do not apply"]])
      })
    ).toEqual(body);
  });

  it("preserves malformed function-call/output relationships unchanged", () => {
    const body = requestWithMalformedToolPair();
    const parsed = parseOpenAIResponsesRequest({ id: "openai-malformed-tool", body });
    const historyBlock = parsed.request.messages[0]?.blocks[0];

    expect(parsed.state.activeOrMalformedToolState).toBe(true);
    expect(
      rebuildOpenAIResponsesRequest(parsed, {
        transformedTextByBlockId: new Map([[historyBlock!.id, "do not apply"]])
      })
    ).toEqual(body);
  });

  it("passes unknown items and fields through unchanged", () => {
    const body = {
      model: "fake-openai-model",
      input: [
        { type: "future_item", future_field: { keep: ["unchanged"] } },
        { role: "user", content: [{ type: "future_content", payload: { exact: true } }] }
      ],
      future_top_level: { exact: "preserve" }
    } as const;
    const parsed = parseOpenAIResponsesRequest({ id: "openai-unknown", body });

    expect(parsed.request.messages[0]?.blocks[0]).toMatchObject({
      kind: "unknown",
      decision: { action: "PASS_THROUGH_UNKNOWN" }
    });
    expect(parsed.request.messages[1]?.blocks[0]).toMatchObject({
      kind: "unknown",
      decision: { action: "PASS_THROUGH_UNKNOWN" }
    });
    expect(rebuildOpenAIResponsesRequest(parsed)).toEqual(body);
  });

  it("preserves cached-content continuity metadata", () => {
    const body = {
      model: "fake-openai-model",
      previous_response_id: "resp_fake_previous",
      prompt_cache_key: "fake-cache-key",
      input: [
        {
          id: "msg_cached_1",
          role: "user",
          cache_control: { type: "ephemeral" },
          content: [{ type: "input_text", text: "Cached synthetic history." }]
        }
      ]
    } as const;
    const parsed = parseOpenAIResponsesRequest({
      id: "openai-cache",
      body,
      preservedHeaders: ["openai-previous-response-id"]
    });

    expect(parsed.request.providerMetadata.cacheSensitive).toBe(true);
    expect(parsed.request.messages[0]?.providerMetadata.cacheSensitive).toBe(true);
    expect(rebuildOpenAIResponsesRequest(parsed)).toEqual(body);
  });

  it("preserves image content blocks", () => {
    const body = {
      model: "fake-openai-model",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe this sanitized image." },
            { type: "input_image", image_url: "data:image/png;base64,ZmFrZQ==" }
          ]
        }
      ]
    } as const;
    const parsed = parseOpenAIResponsesRequest({ id: "openai-image", body });

    expect(parsed.request.messages[0]?.blocks.map((block) => block.kind)).toEqual([
      "text",
      "image"
    ]);
    expect(rebuildOpenAIResponsesRequest(parsed)).toEqual(body);
  });

  it("rebuilds a valid streaming request accepted by the local fake gateway", async () => {
    const body = readFixture();
    const parsed = parseOpenAIResponsesRequest({ id: "openai-streaming-gateway", body });
    const rebuilt = rebuildOpenAIResponsesRequest(parsed);
    const gateway = createFakeGateway();
    await new Promise<void>((resolve) => {
      gateway.server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = gateway.server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected TCP server address");
      }
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "openai-adapter-stream" },
        body: JSON.stringify(rebuilt)
      });
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain("response.output_text.delta");
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
    model: "fake-openai-model",
    metadata: { fixture: "old-history" },
    input: [
      {
        role: "developer",
        content: [{ type: "input_text", text: "Current developer instruction stays exact." }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: "Old gist-safe history eligible for rendering." }]
      },
      {
        role: "assistant",
        content: [{ type: "output_text", text: "Assistant response must remain model output." }]
      }
    ]
  } as const;
}

function requestWithActiveToolCall() {
  return {
    model: "fake-openai-model",
    input: [
      { role: "user", content: [{ type: "input_text", text: "History before active tool." }] },
      {
        type: "function_call",
        call_id: "call_active_1",
        name: "read_file",
        arguments: '{"path":"/fake/path"}'
      }
    ]
  } as const;
}

function requestWithMalformedToolPair() {
  return {
    model: "fake-openai-model",
    input: [
      { role: "user", content: [{ type: "input_text", text: "History before malformed tool." }] },
      {
        type: "function_call_output",
        call_id: "call_missing_1",
        output: "output without matching call"
      }
    ]
  } as const;
}
