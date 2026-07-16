import { describe, expect, it } from "vitest";

import { isoTimestamp } from "@context-diet/core";

import {
  createDeterministicFakeRenderer,
  createPxpipeCompatibleRenderer,
  type ContextRendererInput,
  type RendererLogEvent
} from "./index.js";

const input: ContextRendererInput = {
  sourceText: "Synthetic renderable context\nwith two lines.",
  protectedSpans: [{ start: 10, end: 20, reasonCodes: ["exact_value"] }],
  pageLimits: { maxPages: 2, maxCharsPerPage: 24 },
  dimensionLimits: { maxWidthPx: 640, maxHeightPx: 480, minFontSizePx: 12 },
  modelProfile: {
    profileId: "synthetic-profile",
    provider: "unknown",
    modelFamily: "synthetic-model",
    status: "enabled",
    origin: "synthetic",
    issuedAt: isoTimestamp("2026-07-16T00:00:00.000Z"),
    expiresAt: isoTimestamp("2026-08-16T00:00:00.000Z")
  },
  ctxBlockLabel: "CTX-TEST-BLOCK",
  exactSidecar: {
    integrityHash: "sha256:synthetic-sidecar-hash",
    lineCount: 2,
    recoverable: true
  },
  safety: {
    policyApproved: true,
    secretCleaned: true
  }
};

describe("createDeterministicFakeRenderer", () => {
  it("renders stable fake image outputs", async () => {
    const renderer = createDeterministicFakeRenderer({ nowMs: 2_000 });
    const result = await renderer.render(input);

    expect(result).toMatchObject({
      status: "success",
      timing: { startedAtMs: 2_000, completedAtMs: 2_002, durationMs: 2 },
      glyphCoverage: {
        checkedCodePoints: input.sourceText.length,
        missingGlyphs: []
      }
    });
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toMatchObject({
        pageIndex: 0,
        widthPx: 640,
        heightPx: 480,
        mimeType: "image/png",
        stableImageId: "CTX-TEST-BLOCK-page-0"
      });
      expect(new TextDecoder().decode(result.images[0].bytes)).toContain("CTX-TEST-BLOCK");
    }
  });

  it("returns deterministic renderer failures", async () => {
    const renderer = createDeterministicFakeRenderer({
      shouldFail: true,
      failureReason: "renderer_failure",
      nowMs: 3_000
    });

    await expect(renderer.render(input)).resolves.toMatchObject({
      status: "failure",
      failureReason: "renderer_failure",
      timing: { startedAtMs: 3_000 }
    });
  });
});

describe("createPxpipeCompatibleRenderer", () => {
  it("renders deterministic golden pages with stable labels and exact sidecar metadata", async () => {
    const logEvents: RendererLogEvent[] = [];
    const renderer = createPxpipeCompatibleRenderer({
      nowMs: 5_000,
      logger: (event) => logEvents.push(event)
    });

    const result = await renderer.render(input);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toMatchObject({
        pageIndex: 0,
        widthPx: 640,
        heightPx: 480,
        mimeType: "image/svg+xml",
        stableImageId: "CTX-TEST-BLOCK-pxpipe-page-0"
      });
      expect(new TextDecoder().decode(result.images[0].bytes)).toMatchInlineSnapshot(
        `"<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="100%" height="100%" fill="#ffffff"/><text x="16" y="24" font-family="monospace" font-size="14" fill="#111111">CTX-TEST-BLOCK page 1</text><text x="16" y="44" font-family="monospace" font-size="10" fill="#555555">sidecar sha256:synthetic-sidecar-hash</text><text x="16" y="68" font-family="monospace" font-size="12" fill="#111111">Synthetic renderable con</text></svg>"`
      );
    }
    expect(logEvents).toEqual([
      {
        event: "renderer_success",
        renderer: "pxpipe-compatible",
        ctxBlockLabel: "CTX-TEST-BLOCK",
        profileId: "synthetic-profile",
        pageCount: 2
      }
    ]);
    expect(JSON.stringify(logEvents)).not.toContain("Synthetic renderable context");
  });

  it("fails closed before rendering blocks that are not policy approved and secret cleaned", async () => {
    const renderer = createPxpipeCompatibleRenderer({ nowMs: 6_000 });

    await expect(
      renderer.render({
        ...input,
        safety: { policyApproved: false, secretCleaned: true }
      })
    ).resolves.toMatchObject({
      status: "failure",
      failureReason: "renderer_failure"
    });

    await expect(
      renderer.render({
        ...input,
        protectedSpans: [{ start: 0, end: 8, reasonCodes: ["secret_sensitive"] }]
      })
    ).resolves.toMatchObject({
      status: "failure",
      failureReason: "renderer_failure"
    });
  });

  it("enforces model profile, page limit and glyph coverage checks", async () => {
    const renderer = createPxpipeCompatibleRenderer({ nowMs: 7_000 });

    await expect(
      renderer.render({
        ...input,
        modelProfile: { ...input.modelProfile, status: "disabled" }
      })
    ).resolves.toMatchObject({
      status: "failure",
      failureReason: "profile_disabled"
    });

    await expect(
      renderer.render({
        ...input,
        sourceText: "x".repeat(49)
      })
    ).resolves.toMatchObject({
      status: "failure",
      failureReason: "unsupported_format"
    });

    await expect(
      renderer.render({
        ...input,
        sourceText: "unsupported glyph 😀"
      })
    ).resolves.toMatchObject({
      status: "failure",
      failureReason: "unsupported_glyphs"
    });
  });
});
