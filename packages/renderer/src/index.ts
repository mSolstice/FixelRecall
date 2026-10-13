import type { ModelProfileSummary, ReasonCode } from "@fixel-recall/core";
import { deflateSync } from "node:zlib";

export interface RenderProtectedSpan {
  readonly start: number;
  readonly end: number;
  readonly reasonCodes: readonly ReasonCode[];
}

export interface RenderPageLimits {
  readonly maxPages: number;
  readonly maxCharsPerPage: number;
}

export interface RenderDimensionLimits {
  readonly maxWidthPx: number;
  readonly maxHeightPx: number;
  readonly minFontSizePx: number;
}

export interface ExactSidecarInput {
  readonly integrityHash: string;
  readonly lineCount: number;
  readonly recoverable: boolean;
}

export interface RenderSafetyApproval {
  readonly policyApproved: boolean;
  readonly secretCleaned: boolean;
}

export interface ContextRendererInput {
  readonly sourceText: string;
  readonly protectedSpans: readonly RenderProtectedSpan[];
  readonly pageLimits: RenderPageLimits;
  readonly dimensionLimits: RenderDimensionLimits;
  readonly modelProfile: ModelProfileSummary;
  readonly ctxBlockLabel: string;
  readonly exactSidecar: ExactSidecarInput;
  readonly safety: RenderSafetyApproval;
}

export interface RenderedImageOutput {
  readonly pageIndex: number;
  readonly widthPx: number;
  readonly heightPx: number;
  /** Provider-compatible raster format. SVG is not accepted as an image input. */
  readonly mimeType: "image/png";
  readonly bytes: Uint8Array;
  readonly stableImageId: string;
}

export interface GlyphCoverageReport {
  readonly checkedCodePoints: number;
  readonly coveredCodePoints: number;
  readonly missingGlyphs: readonly string[];
  readonly unsupportedGlyphs: readonly string[];
}

export interface RenderTiming {
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly durationMs: number;
}

export type RenderFailureReason =
  | "renderer_failure"
  | "unsupported_glyphs"
  | "unsupported_format"
  | "profile_disabled"
  | "profile_expired";

export type ContextRendererResult =
  | {
      readonly status: "success";
      readonly images: readonly RenderedImageOutput[];
      readonly glyphCoverage: GlyphCoverageReport;
      readonly timing: RenderTiming;
    }
  | {
      readonly status: "failure";
      readonly failureReason: RenderFailureReason;
      readonly glyphCoverage: GlyphCoverageReport;
      readonly timing: RenderTiming;
    };

export interface ContextRenderer {
  render(input: ContextRendererInput): Promise<ContextRendererResult>;
}

export interface FakeRendererOptions {
  readonly shouldFail?: boolean;
  readonly failureReason?: RenderFailureReason;
  readonly nowMs?: number;
}

export interface RendererLogEvent {
  readonly event: "renderer_success" | "renderer_failure";
  readonly renderer: "pxpipe-compatible";
  readonly ctxBlockLabel: string;
  readonly profileId: string;
  readonly pageCount: number;
  readonly failureReason?: RenderFailureReason;
}

export interface PxpipeCompatibleRendererOptions {
  readonly nowMs?: number;
  readonly logger?: (event: RendererLogEvent) => void;
}

export function createDeterministicFakeRenderer(
  options: FakeRendererOptions = {}
): ContextRenderer {
  return {
    render: async (input) => renderFake(input, options)
  };
}

export function createPxpipeCompatibleRenderer(
  options: PxpipeCompatibleRendererOptions = {}
): ContextRenderer {
  return {
    render: async (input) => renderPxpipeCompatible(input, options)
  };
}

function renderFake(
  input: ContextRendererInput,
  options: FakeRendererOptions
): ContextRendererResult {
  const startedAtMs = options.nowMs ?? 1_000;
  const pageCount = Math.min(
    input.pageLimits.maxPages,
    Math.max(1, Math.ceil(input.sourceText.length / input.pageLimits.maxCharsPerPage))
  );
  const glyphCoverage = createGlyphCoverage(input.sourceText);
  const timing = {
    startedAtMs,
    completedAtMs: startedAtMs + pageCount,
    durationMs: pageCount
  };

  if (options.shouldFail === true) {
    return {
      status: "failure",
      failureReason: options.failureReason ?? "renderer_failure",
      glyphCoverage,
      timing
    };
  }

  return {
    status: "success",
    images: Array.from({ length: pageCount }, (_, pageIndex) => createFakeImage(input, pageIndex)),
    glyphCoverage,
    timing
  };
}

function renderPxpipeCompatible(
  input: ContextRendererInput,
  options: PxpipeCompatibleRendererOptions
): ContextRendererResult {
  const startedAtMs = options.nowMs ?? 1_000;
  const glyphCoverage = createGlyphCoverage(input.sourceText);
  const pageCapacity = input.pageLimits.maxPages * input.pageLimits.maxCharsPerPage;
  const pageCount = Math.max(
    1,
    Math.ceil(input.sourceText.length / input.pageLimits.maxCharsPerPage)
  );
  const timing = {
    startedAtMs,
    completedAtMs: startedAtMs + Math.min(pageCount, input.pageLimits.maxPages),
    durationMs: Math.min(pageCount, input.pageLimits.maxPages)
  };
  const failureReason = firstPxpipeFailure(input, glyphCoverage, pageCapacity);

  if (failureReason !== null) {
    options.logger?.({
      event: "renderer_failure",
      renderer: "pxpipe-compatible",
      ctxBlockLabel: input.ctxBlockLabel,
      profileId: input.modelProfile.profileId,
      pageCount: 0,
      failureReason
    });
    return {
      status: "failure",
      failureReason,
      glyphCoverage,
      timing
    };
  }

  const images = Array.from({ length: pageCount }, (_, pageIndex) =>
    createPxpipeCompatibleImage(input, pageIndex)
  );
  options.logger?.({
    event: "renderer_success",
    renderer: "pxpipe-compatible",
    ctxBlockLabel: input.ctxBlockLabel,
    profileId: input.modelProfile.profileId,
    pageCount
  });
  return {
    status: "success",
    images,
    glyphCoverage,
    timing
  };
}

function firstPxpipeFailure(
  input: ContextRendererInput,
  glyphCoverage: GlyphCoverageReport,
  pageCapacity: number
): RenderFailureReason | null {
  if (input.safety.policyApproved !== true || input.safety.secretCleaned !== true) {
    return "renderer_failure";
  }
  if (input.protectedSpans.some((span) => span.reasonCodes.includes("secret_sensitive"))) {
    return "renderer_failure";
  }
  if (input.modelProfile.status !== "enabled") {
    return input.modelProfile.status === "retest_required"
      ? "unsupported_format"
      : "profile_disabled";
  }
  if (input.sourceText.length > pageCapacity) {
    return "unsupported_format";
  }
  if (glyphCoverage.unsupportedGlyphs.length > 0 || glyphCoverage.missingGlyphs.length > 0) {
    return "unsupported_glyphs";
  }
  if (input.pageLimits.maxPages < 1 || input.pageLimits.maxCharsPerPage < 1) {
    return "unsupported_format";
  }
  if (
    input.dimensionLimits.maxWidthPx < 1 ||
    input.dimensionLimits.maxHeightPx < 1 ||
    input.dimensionLimits.minFontSizePx < 1
  ) {
    return "unsupported_format";
  }
  return null;
}

function createFakeImage(input: ContextRendererInput, pageIndex: number): RenderedImageOutput {
  const stableImageId = `${input.ctxBlockLabel}-page-${pageIndex}`;
  return {
    pageIndex,
    widthPx: Math.min(input.dimensionLimits.maxWidthPx, 800),
    heightPx: Math.min(input.dimensionLimits.maxHeightPx, 1_000),
    mimeType: "image/png",
    stableImageId,
    bytes: new TextEncoder().encode(
      JSON.stringify({
        syntheticRenderer: true,
        label: input.ctxBlockLabel,
        pageIndex,
        sidecarHash: input.exactSidecar.integrityHash
      })
    )
  };
}

function createPxpipeCompatibleImage(
  input: ContextRendererInput,
  pageIndex: number
): RenderedImageOutput {
  const start = pageIndex * input.pageLimits.maxCharsPerPage;
  const sourcePage = input.sourceText.slice(start, start + input.pageLimits.maxCharsPerPage);
  const stableImageId = `${input.ctxBlockLabel}-pxpipe-page-${pageIndex}`;
  const widthPx = Math.min(input.dimensionLimits.maxWidthPx, 1_568);
  const heightPx = Math.min(input.dimensionLimits.maxHeightPx, 728);
  // Provider image inputs require raster data. Keep this deterministic adapter
  // dependency-free; the production pxpipe adapter can replace the pixels.
  const stripeCount = Math.max(1, Math.min(32, sourcePage.length));
  const pixels = Buffer.alloc(widthPx * heightPx * 4, 255);
  for (let stripe = 0; stripe < stripeCount; stripe += 1) {
    const x = Math.floor((stripe / stripeCount) * widthPx);
    for (let y = 0; y < Math.min(4, heightPx); y += 1) {
      const offset = (y * widthPx + x) * 4;
      pixels[offset] = 17;
      pixels[offset + 1] = 24;
      pixels[offset + 2] = 39;
    }
  }

  return {
    pageIndex,
    widthPx,
    heightPx,
    mimeType: "image/png",
    stableImageId,
    bytes: createPng(
      widthPx,
      heightPx,
      pixels,
      input.ctxBlockLabel,
      input.exactSidecar.integrityHash
    )
  };
}

function createGlyphCoverage(sourceText: string): GlyphCoverageReport {
  const codePoints = Array.from(sourceText);
  const unsupportedGlyphs = codePoints.filter((glyph) => glyph.codePointAt(0)! > 0xffff);
  return {
    checkedCodePoints: codePoints.length,
    coveredCodePoints: codePoints.length - unsupportedGlyphs.length,
    missingGlyphs: [],
    unsupportedGlyphs
  };
}

function createPng(
  width: number,
  height: number,
  pixels: Buffer,
  label: string,
  sidecarHash: string
): Uint8Array {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 4 + 1)] = 0;
    pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const text = Buffer.from(`label\0${label}\nsidecar\0${sidecarHash}`, "utf8");
  return Buffer.concat([
    Buffer.from("\x89PNG\r\n\x1a\n", "binary"),
    pngChunk(
      "IHDR",
      Buffer.from([
        width >>> 24,
        width >>> 16,
        width >>> 8,
        width,
        height >>> 24,
        height >>> 16,
        height >>> 8,
        height,
        8,
        6,
        0,
        0,
        0
      ])
    ),
    pngChunk("tEXt", text),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
