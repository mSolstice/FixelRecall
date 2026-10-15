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
  const scale = Math.max(1, Math.min(4, Math.floor(input.dimensionLimits.minFontSizePx / 4)));
  const width = Math.min(input.dimensionLimits.maxWidthPx, 1568);
  const height = Math.min(input.dimensionLimits.maxHeightPx, 728);
  for (let start = 0; start < input.sourceText.length; start += input.pageLimits.maxCharsPerPage) {
    let x = scale,
      y = scale;
    for (const character of input.sourceText.slice(
      start,
      start + input.pageLimits.maxCharsPerPage
    )) {
      if (character === "\n" || x + 6 * scale > width) {
        x = scale;
        y += 8 * scale;
        if (character === "\n") continue;
      }
      if (y + 7 * scale > height || x + 5 * scale > width) return "unsupported_format";
      x += 6 * scale;
    }
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
  const pixels = Buffer.alloc(widthPx * heightPx * 4, 255);
  drawBitmapText(pixels, widthPx, heightPx, sourcePage, input.dimensionLimits.minFontSizePx);

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
  const unsupportedGlyphs = [
    ...new Set(codePoints.filter((glyph) => glyphPattern(glyph) === null))
  ];
  return {
    checkedCodePoints: codePoints.length,
    coveredCodePoints: codePoints.filter((glyph) => glyphPattern(glyph) !== null).length,
    missingGlyphs: [],
    unsupportedGlyphs
  };
}

type Glyph = readonly string[];

const GLYPHS: Readonly<Record<string, Glyph>> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  ",": ["00000", "00000", "00000", "00000", "00110", "00110", "00100"],
  ":": ["00000", "00110", "00110", "00000", "00110", "00110", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"]
};

function glyphPattern(value: string): Glyph | null {
  if (value === "\n") return GLYPHS[" "] ?? null;
  return GLYPHS[value] ?? GLYPHS[value.toUpperCase()] ?? null;
}

function drawBitmapText(
  pixels: Buffer,
  width: number,
  height: number,
  source: string,
  minFontSizePx: number
): void {
  const scale = Math.max(1, Math.min(4, Math.floor(minFontSizePx / 4)));
  const advance = 6 * scale;
  const lineHeight = 8 * scale;
  let x = scale;
  let y = scale;
  for (const character of source) {
    if (character === "\n" || x + advance > width) {
      x = scale;
      y += lineHeight;
      if (character === "\n") continue;
    }
    if (y + 7 * scale > height) break;
    const glyph = glyphPattern(character);
    if (glyph === null) {
      x += advance;
      continue;
    }
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row]!.length; column += 1) {
        if (glyph[row]![column] !== "1") continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            const pixelX = x + column * scale + dx;
            const pixelY = y + row * scale + dy;
            const offset = (pixelY * width + pixelX) * 4;
            pixels[offset] = 17;
            pixels[offset + 1] = 24;
            pixels[offset + 2] = 39;
          }
        }
      }
    }
    x += advance;
  }
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
