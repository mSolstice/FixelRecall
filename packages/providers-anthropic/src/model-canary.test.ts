import { describe, expect, it } from "vitest";

import {
  claudeCandidateProfiles,
  createModelProfileRegistry,
  createSyntheticCanaryWorkloads,
  evaluateSyntheticCanaries,
  isoTimestamp,
  type CanaryWorkloadKind
} from "@fixel-recall/core";
import { parseAnthropicMessagesRequest, rebuildAnthropicMessagesRequest } from "./index.js";

const evaluatedAt = isoTimestamp("2026-10-13T00:00:00.000Z");

describe("Claude synthetic model canary matrix", () => {
  it.each([
    ["text", textRequest()],
    ["streaming", streamingRequest()],
    ["tool state", toolRequest()],
    ["cache fields", cacheRequest()],
    ["image block", imageRequest()],
    ["exact strings", exactStringRequest()],
    ["unknown block", unknownBlockRequest()]
  ])("round-trips the synthetic %s case without changing wire data", (_name, body) => {
    const parsed = parseAnthropicMessagesRequest({
      id: "synthetic-claude-canary",
      body,
      requiredHeaders: ["anthropic-version", "x-api-key"],
      betaCapabilities: ["synthetic-beta"]
    });

    expect(rebuildAnthropicMessagesRequest(parsed)).toEqual(body);
    expect(parsed.state.gatewayMetadata.requiredHeaders).toEqual([
      "anthropic-version",
      "x-api-key"
    ]);
  });

  it("keeps tool state native and preserves cache and image metadata", () => {
    const tool = parseAnthropicMessagesRequest({ id: "synthetic-tool", body: toolRequest() });
    const cache = parseAnthropicMessagesRequest({ id: "synthetic-cache", body: cacheRequest() });
    const image = parseAnthropicMessagesRequest({ id: "synthetic-image", body: imageRequest() });

    expect(tool.state.activeOrMalformedToolState).toBe(false);
    expect(tool.state.messages[0]?.toolUseIds).toEqual(["toolu_synthetic"]);
    expect(tool.state.messages[1]?.toolResultForIds).toEqual(["toolu_synthetic"]);
    expect(cache.request.providerMetadata.cacheSensitive).toBe(true);
    expect(image.request.messages[0]?.blocks.map((block) => block.kind)).toEqual(["image"]);
  });

  it("does not enable a Claude candidate even when every synthetic workload passes", () => {
    const profile = claudeCandidateProfiles[1];
    const observed = Object.fromEntries(
      createSyntheticCanaryWorkloads().map((workload) => [
        workload.kind,
        workload.expectedFragments
      ])
    ) as Record<CanaryWorkloadKind, readonly string[]>;
    const canary = evaluateSyntheticCanaries({
      profile,
      observedFragmentsByKind: observed,
      evaluatedAt
    });
    const status = createModelProfileRegistry([profile]).resolveStatus({
      provider: "anthropic",
      modelFamily: profile.modelFamily,
      modelVersion: profile.modelVersion,
      at: evaluatedAt,
      canary
    });

    expect(canary.passed).toBe(true);
    expect(status).toEqual({ kind: "disabled", profileId: profile.profileId });
  });

  it("falls back to unchanged native content when the matrix sees malformed tool state", () => {
    const body = {
      model: "claude-sonnet-5-5",
      max_tokens: 32,
      messages: [
        {
          role: "assistant",
          content: [{ type: "tool_use", id: "toolu_missing_result", name: "fake", input: {} }]
        },
        { role: "user", content: [{ type: "text", text: "Synthetic follow-up." }] }
      ]
    } as const;
    const parsed = parseAnthropicMessagesRequest({ id: "synthetic-malformed", body });
    const textBlock = parsed.request.messages[1]?.blocks[0];

    expect(parsed.state.activeOrMalformedToolState).toBe(true);
    expect(
      rebuildAnthropicMessagesRequest(parsed, {
        transformedTextByBlockId: new Map([[textBlock!.id, "must remain native"]])
      })
    ).toEqual(body);
  });
});

function baseRequest(content: readonly unknown[]) {
  return {
    model: "claude-sonnet-5-5",
    max_tokens: 50,
    messages: [{ role: "user", content }]
  } as const;
}

function textRequest() {
  return baseRequest([{ type: "text", text: "Synthetic Claude prose canary." }]);
}

function streamingRequest() {
  return {
    ...baseRequest([{ type: "text", text: "Synthetic streaming canary." }]),
    stream: true
  } as const;
}

function toolRequest() {
  return {
    ...baseRequest([{ type: "text", text: "Synthetic tool request." }]),
    messages: [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_synthetic", name: "synthetic_tool", input: {} }]
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_synthetic", content: "synthetic result" }
        ]
      }
    ]
  } as const;
}

function cacheRequest() {
  return {
    ...baseRequest([
      { type: "text", text: "Synthetic cached history.", cache_control: { type: "ephemeral" } }
    ]),
    metadata: { synthetic: true }
  } as const;
}

function imageRequest() {
  return baseRequest([
    { type: "image", source: { type: "base64", media_type: "image/png", data: "c3ludGhldGlj" } }
  ]);
}

function exactStringRequest() {
  return baseRequest([
    { type: "text", text: "UUID=123e4567-e89b-12d3-a456-426614174000 HASH=synthetic-hash" }
  ]);
}

function unknownBlockRequest() {
  return baseRequest([{ type: "future_synthetic_block", payload: { preserve: true } }]);
}
