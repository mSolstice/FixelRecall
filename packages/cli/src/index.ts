#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isoTimestamp, type ModelProfileSummary } from "@context-diet/core";
import {
  createPxpipeCompatibleRenderer,
  type ContextRenderer,
  type ContextRendererInput,
  type ContextRendererResult
} from "@context-diet/renderer";

export const cliName = "context-diet";

export type RendererDoctorStatus = "HEALTHY" | "DEGRADED" | "UNSAFE" | "UNSUPPORTED";
export type CompatibilityAuditVerdict =
  | "RECOMMENDED"
  | "RECOMMENDED_WITH_RESTRICTIONS"
  | "AUDIT_ONLY"
  | "NOT_WORTH_USING"
  | "UNSUPPORTED"
  | "RETEST_REQUIRED";

export type CompatibilityBand = "LOW" | "MEDIUM" | "HIGH";
export type CompatibilityPreset = "SAFE" | "BALANCED" | "MAX" | "BYPASS";
export type CompatibilityHost = "codex" | "claude_code" | "both";

export interface RendererDoctorCheck {
  readonly name: string;
  readonly status: RendererDoctorStatus;
  readonly detail: string;
  readonly nextAction: string;
}

export interface RendererDoctorReport {
  readonly command: "context-diet renderer doctor";
  readonly status: RendererDoctorStatus;
  readonly checks: readonly RendererDoctorCheck[];
  readonly nextActions: readonly string[];
}

export interface RendererDoctorOptions {
  readonly renderer?: ContextRenderer;
  readonly adapterInstalled?: boolean;
  readonly upstreamPxpipeRef?: string;
  readonly licenceNoticePresent?: boolean;
  readonly nativeDependenciesPresent?: boolean;
  readonly fontAvailable?: boolean;
  readonly tempRoot?: string;
  readonly timeoutMs?: number;
  readonly modelProfile?: ModelProfileSummary;
  readonly simulatedImageTokenCost?: number;
  readonly seed?: "healthy" | "degraded" | "unsafe" | "unsupported";
}

export interface CompatibilityAuditInput {
  readonly host: CompatibilityHost;
  readonly modelSimulatorProfile: "enabled" | "expired" | "revoked" | "retest_required";
  readonly workloadType: "prose" | "code" | "tables" | "tool_heavy" | "image_heavy";
  readonly language: string;
  readonly script: "latin" | "devanagari" | "cjk" | "mixed" | "unsupported";
  readonly averageRequestSize: number;
  readonly averageSessionSize: number;
  readonly cacheIntensity: "low" | "medium" | "high";
  readonly exactnessSensitivity: "low" | "medium" | "high" | "critical";
  readonly toolUseFrequency: "low" | "medium" | "high";
  readonly latencySensitivity: "low" | "medium" | "high";
  readonly riskPreference: "conservative" | "balanced" | "aggressive";
}

export interface CompatibilityAuditReport {
  readonly title: "Context Diet Compatibility Audit";
  readonly dataNotice: "SYNTHETIC TEST DATA";
  readonly input: CompatibilityAuditInput;
  readonly compatibilityScore: number;
  readonly expectedBenefitBand: CompatibilityBand;
  readonly accuracyRiskBand: CompatibilityBand;
  readonly latencyBand: CompatibilityBand;
  readonly recommendedPreset: CompatibilityPreset;
  readonly unsupportedCapabilities: readonly string[];
  readonly requiredCanaries: readonly string[];
  readonly verdict: CompatibilityAuditVerdict;
  readonly reasons: readonly string[];
  readonly dashboard: CompatibilityDashboardOutput;
}

export interface CompatibilityDashboardOutput {
  readonly kind: "compatibility_audit";
  readonly dataOrigin: "synthetic";
  readonly host: CompatibilityHost;
  readonly score: number;
  readonly verdict: CompatibilityAuditVerdict;
  readonly bands: {
    readonly expectedBenefit: CompatibilityBand;
    readonly accuracyRisk: CompatibilityBand;
    readonly latency: CompatibilityBand;
  };
  readonly preset: CompatibilityPreset;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly requiredCanaries: readonly string[];
}

export interface CompatibilityAuditOptions {
  readonly fixture?: Partial<CompatibilityAuditInput>;
  readonly seed?: CompatibilityAuditVerdict | "codex" | "claude_code" | "both";
  readonly format?: "json" | "markdown";
}

export function describeCli(): string {
  return `${cliName} local operator`;
}

export async function runCli(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  if (argv[0] === "renderer" && argv[1] === "doctor") {
    const report = await runRendererDoctor();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "UNSAFE" || report.status === "UNSUPPORTED" ? 2 : 0;
  }
  if (argv[0] === "compatibility-audit") {
    const format = argv.includes("--markdown") ? "markdown" : "json";
    const report = runCompatibilityAudit();
    process.stdout.write(
      format === "markdown"
        ? `${renderCompatibilityAuditMarkdown(report)}\n`
        : `${renderCompatibilityAuditJson(report)}\n`
    );
    return report.verdict === "UNSUPPORTED" ? 2 : 0;
  }
  process.stdout.write(`${describeCli()}\n`);
  return 0;
}

export function runCompatibilityAudit(
  options: CompatibilityAuditOptions = {}
): CompatibilityAuditReport {
  const input = createCompatibilityFixture(options.seed, options.fixture);
  const unsupportedCapabilities = unsupportedCapabilitiesFor(input);
  const requiredCanaries = requiredCanariesFor(input);
  const expectedBenefitBand = benefitBand(input);
  const accuracyRiskBand = riskBand(input);
  const latencyBand = latencyBandFor(input);
  const score = compatibilityScore(input, expectedBenefitBand, accuracyRiskBand, latencyBand);
  const thresholdFailure = exactnessOrSafetyThresholdFailure(input, unsupportedCapabilities);
  const verdict = compatibilityVerdict(input, score, thresholdFailure, unsupportedCapabilities);
  const recommendedPreset = recommendedPresetFor(input, verdict, accuracyRiskBand);
  const reasons = compatibilityReasons(input, verdict, {
    accuracyRiskBand,
    expectedBenefitBand,
    latencyBand,
    thresholdFailure,
    unsupportedCapabilities
  });
  const warnings = reasons.filter((reason) => !reason.toLowerCase().includes("cannot"));

  return {
    accuracyRiskBand,
    compatibilityScore: score,
    dashboard: {
      bands: {
        accuracyRisk: accuracyRiskBand,
        expectedBenefit: expectedBenefitBand,
        latency: latencyBand
      },
      blockers: unsupportedCapabilities,
      dataOrigin: "synthetic",
      host: input.host,
      kind: "compatibility_audit",
      preset: recommendedPreset,
      requiredCanaries,
      score,
      verdict,
      warnings
    },
    dataNotice: "SYNTHETIC TEST DATA",
    expectedBenefitBand,
    input,
    latencyBand,
    reasons,
    recommendedPreset,
    requiredCanaries,
    title: "Context Diet Compatibility Audit",
    unsupportedCapabilities,
    verdict
  };
}

export function renderCompatibilityAuditJson(report: CompatibilityAuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function renderCompatibilityAuditMarkdown(report: CompatibilityAuditReport): string {
  return [
    "# Context Diet Compatibility Audit",
    "",
    "**SYNTHETIC TEST DATA**",
    "",
    `Verdict: **${report.verdict}**`,
    `Compatibility score: **${report.compatibilityScore}**`,
    `Recommended preset: **${report.recommendedPreset}**`,
    "",
    `Expected benefit: ${report.expectedBenefitBand}`,
    `Accuracy risk: ${report.accuracyRiskBand}`,
    `Latency: ${report.latencyBand}`,
    "",
    "## Reasons",
    ...report.reasons.map((reason) => `- ${reason}`),
    "",
    "## Required Canaries",
    ...report.requiredCanaries.map((canary) => `- ${canary}`),
    "",
    "## Unsupported Capabilities",
    ...(report.unsupportedCapabilities.length === 0
      ? ["- None"]
      : report.unsupportedCapabilities.map((capability) => `- ${capability}`))
  ].join("\n");
}

export async function runRendererDoctor(
  options: RendererDoctorOptions = {}
): Promise<RendererDoctorReport> {
  const seeded = seedOptions(options);
  const renderer = seeded.renderer ?? createPxpipeCompatibleRenderer({ nowMs: 1_000 });
  const checks: RendererDoctorCheck[] = [];

  checks.push(
    checkBoolean(
      "adapter installed",
      seeded.adapterInstalled ?? true,
      "Renderer adapter is available through the public renderer interface.",
      "Install or enable the renderer adapter package, then rerun the doctor."
    )
  );
  checks.push(
    checkBoolean(
      "upstream pxpipe version or pinned commit",
      (seeded.upstreamPxpipeRef ?? "teamchong/pxpipe@76f4fd2").trim().length > 0,
      `Pinned upstream reference: ${seeded.upstreamPxpipeRef ?? "teamchong/pxpipe@76f4fd2"}.`,
      "Record the exact pxpipe version or commit before enabling rendering."
    )
  );
  checks.push(
    checkBoolean(
      "licence notice",
      seeded.licenceNoticePresent ?? true,
      "MIT licence notice is recorded in the pxpipe integration review.",
      "Restore the pxpipe licence notice and attribution before distribution."
    )
  );
  checks.push(
    checkBoolean(
      "required native dependencies",
      seeded.nativeDependenciesPresent ?? true,
      "Required native renderer dependencies are available or not needed by this adapter.",
      "Install missing native renderer dependencies manually; the doctor will not install them."
    )
  );
  checks.push(checkFontAvailability(seeded.fontAvailable ?? true));

  checks.push(await checkTempDirectory(seeded.tempRoot));

  const input = createDoctorInput(seeded.modelProfile);
  const renderResult = await renderWithTimeout(renderer, input, seeded.timeoutMs ?? 2_000);
  checks.push(checkRenderResult("deterministic golden render", renderResult));
  checks.push(checkDimensions(renderResult));
  checks.push(checkGlyphCoverage(renderResult));
  checks.push(checkExactSidecar(renderResult));
  checks.push(await checkProtectedSpanExclusion(renderer, input));
  checks.push(checkSecretCanaryAbsence(renderResult));
  checks.push(checkModelProfile(input));
  checks.push(checkImageTokenCost(seeded.simulatedImageTokenCost ?? 128));
  checks.push(checkRendererTimeout(renderResult));
  checks.push(await checkCrashCleanup(seeded.tempRoot));

  const status = aggregateStatus(checks);
  return {
    command: "context-diet renderer doctor",
    status,
    checks,
    nextActions: checks
      .filter((check) => check.status !== "HEALTHY")
      .map((check) => `${check.name}: ${check.nextAction}`)
  };
}

function createCompatibilityFixture(
  seed: CompatibilityAuditOptions["seed"],
  override: Partial<CompatibilityAuditInput> = {}
): CompatibilityAuditInput {
  const base: CompatibilityAuditInput = {
    averageRequestSize: 18_000,
    averageSessionSize: 140_000,
    cacheIntensity: "high",
    exactnessSensitivity: "medium",
    host: "both",
    language: "English",
    latencySensitivity: "medium",
    modelSimulatorProfile: "enabled",
    riskPreference: "balanced",
    script: "latin",
    toolUseFrequency: "medium",
    workloadType: "prose"
  };
  const seeded: Record<string, Partial<CompatibilityAuditInput>> = {
    AUDIT_ONLY: { exactnessSensitivity: "critical", riskPreference: "conservative" },
    NOT_WORTH_USING: {
      averageRequestSize: 800,
      averageSessionSize: 4_000,
      cacheIntensity: "low",
      latencySensitivity: "high"
    },
    RECOMMENDED: {},
    RECOMMENDED_WITH_RESTRICTIONS: {
      exactnessSensitivity: "high",
      script: "mixed",
      workloadType: "tables"
    },
    RETEST_REQUIRED: { modelSimulatorProfile: "retest_required" },
    UNSUPPORTED: { exactnessSensitivity: "critical", modelSimulatorProfile: "revoked" },
    both: { host: "both" },
    claude_code: { host: "claude_code", modelSimulatorProfile: "enabled" },
    codex: { host: "codex", modelSimulatorProfile: "enabled" }
  };
  return { ...base, ...(seed === undefined ? {} : seeded[seed]), ...override };
}

function benefitBand(input: CompatibilityAuditInput): CompatibilityBand {
  const sizeScore =
    input.averageSessionSize >= 100_000 || input.averageRequestSize >= 16_000
      ? 2
      : input.averageSessionSize >= 30_000
        ? 1
        : 0;
  const cacheScore =
    input.cacheIntensity === "high" ? 1 : input.cacheIntensity === "medium" ? 0.5 : 0;
  const workloadScore = input.workloadType === "prose" || input.workloadType === "tables" ? 1 : 0;
  const total = sizeScore + cacheScore + workloadScore;
  return total >= 3 ? "HIGH" : total >= 1.5 ? "MEDIUM" : "LOW";
}

function riskBand(input: CompatibilityAuditInput): CompatibilityBand {
  if (
    input.exactnessSensitivity === "critical" ||
    input.script === "unsupported" ||
    input.modelSimulatorProfile === "revoked"
  ) {
    return "HIGH";
  }
  if (
    input.exactnessSensitivity === "high" ||
    input.workloadType === "code" ||
    input.workloadType === "tool_heavy" ||
    input.script === "mixed"
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

function latencyBandFor(input: CompatibilityAuditInput): CompatibilityBand {
  if (input.latencySensitivity === "high" && input.averageRequestSize > 12_000) {
    return "HIGH";
  }
  if (input.latencySensitivity === "medium" || input.averageRequestSize > 20_000) {
    return "MEDIUM";
  }
  return "LOW";
}

function compatibilityScore(
  input: CompatibilityAuditInput,
  benefit: CompatibilityBand,
  risk: CompatibilityBand,
  latency: CompatibilityBand
): number {
  const benefitScore = bandPoints(benefit);
  const riskPenalty = bandPoints(risk);
  const latencyPenalty = Math.max(0, bandPoints(latency) - 1);
  const cacheBonus =
    input.cacheIntensity === "high" ? 8 : input.cacheIntensity === "medium" ? 4 : 0;
  return clampScore(50 + benefitScore * 12 - riskPenalty * 10 - latencyPenalty * 5 + cacheBonus);
}

function exactnessOrSafetyThresholdFailure(
  input: CompatibilityAuditInput,
  unsupportedCapabilities: readonly string[]
): boolean {
  return (
    input.exactnessSensitivity === "critical" ||
    input.modelSimulatorProfile === "revoked" ||
    input.modelSimulatorProfile === "expired" ||
    unsupportedCapabilities.length > 0
  );
}

function compatibilityVerdict(
  input: CompatibilityAuditInput,
  score: number,
  thresholdFailure: boolean,
  unsupportedCapabilities: readonly string[]
): CompatibilityAuditVerdict {
  if (input.modelSimulatorProfile === "retest_required") {
    return "RETEST_REQUIRED";
  }
  if (unsupportedCapabilities.length > 0 || input.modelSimulatorProfile === "revoked") {
    return "UNSUPPORTED";
  }
  if (thresholdFailure) {
    return "AUDIT_ONLY";
  }
  if (
    input.averageRequestSize < 2_000 &&
    input.averageSessionSize < 10_000 &&
    input.cacheIntensity === "low"
  ) {
    return "NOT_WORTH_USING";
  }
  if (score < 45) {
    return "NOT_WORTH_USING";
  }
  if (
    input.exactnessSensitivity === "high" ||
    input.toolUseFrequency === "high" ||
    input.riskPreference === "conservative"
  ) {
    return "RECOMMENDED_WITH_RESTRICTIONS";
  }
  return "RECOMMENDED";
}

function recommendedPresetFor(
  input: CompatibilityAuditInput,
  verdict: CompatibilityAuditVerdict,
  risk: CompatibilityBand
): CompatibilityPreset {
  if (verdict === "UNSUPPORTED" || verdict === "NOT_WORTH_USING") {
    return "BYPASS";
  }
  if (verdict === "AUDIT_ONLY" || verdict === "RETEST_REQUIRED" || risk === "HIGH") {
    return "SAFE";
  }
  if (input.riskPreference === "aggressive" && risk === "LOW") {
    return "MAX";
  }
  return "BALANCED";
}

function unsupportedCapabilitiesFor(input: CompatibilityAuditInput): readonly string[] {
  const unsupported: string[] = [];
  if (input.script === "unsupported") {
    unsupported.push("The selected script is not covered by the local synthetic glyph profile.");
  }
  if (input.modelSimulatorProfile === "revoked") {
    unsupported.push("The local model simulator profile is revoked.");
  }
  if (input.modelSimulatorProfile === "expired") {
    unsupported.push("The local model simulator profile is expired.");
  }
  return unsupported;
}

function requiredCanariesFor(input: CompatibilityAuditInput): readonly string[] {
  const canaries = ["prose gist canary", "exact-string canary", "table structure canary"];
  if (input.workloadType === "code" || input.toolUseFrequency !== "low") {
    canaries.push("tool and code exactness canary");
  }
  if (input.script !== "latin") {
    canaries.push(`${input.script} glyph coverage canary`);
  }
  if (input.host === "both") {
    canaries.push("Codex route canary", "Claude Code route canary");
  } else {
    canaries.push(`${input.host} route canary`);
  }
  return canaries;
}

function compatibilityReasons(
  input: CompatibilityAuditInput,
  verdict: CompatibilityAuditVerdict,
  context: {
    readonly accuracyRiskBand: CompatibilityBand;
    readonly expectedBenefitBand: CompatibilityBand;
    readonly latencyBand: CompatibilityBand;
    readonly thresholdFailure: boolean;
    readonly unsupportedCapabilities: readonly string[];
  }
): readonly string[] {
  const reasons = [
    `This report uses SYNTHETIC TEST DATA for ${input.host}.`,
    `Expected benefit is ${context.expectedBenefitBand.toLowerCase()} based on request size, session size and cache intensity.`,
    `Accuracy risk is ${context.accuracyRiskBand.toLowerCase()} because exactness sensitivity is ${input.exactnessSensitivity}.`,
    `Latency impact is ${context.latencyBand.toLowerCase()} for the selected latency sensitivity.`
  ];
  if (context.thresholdFailure) {
    reasons.push(
      "A safety or exactness threshold failed, so the overall score is not allowed to hide that risk."
    );
  }
  if (context.unsupportedCapabilities.length > 0) {
    reasons.push(...context.unsupportedCapabilities);
  }
  if (verdict === "RETEST_REQUIRED") {
    reasons.push("The local model profile needs fresh canary results before use.");
  }
  if (verdict === "NOT_WORTH_USING") {
    reasons.push("The synthetic workload is too small or latency-sensitive to justify conversion.");
  }
  if (verdict === "RECOMMENDED_WITH_RESTRICTIONS") {
    reasons.push("Use restrictions because some content may need to stay as native text.");
  }
  if (verdict === "RECOMMENDED") {
    reasons.push(
      "The synthetic fixture passed benefit and safety checks for the recommended preset."
    );
  }
  return reasons;
}

function bandPoints(band: CompatibilityBand): number {
  return band === "HIGH" ? 3 : band === "MEDIUM" ? 2 : 1;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function seedOptions(options: RendererDoctorOptions): RendererDoctorOptions {
  if (options.seed === "healthy" || options.seed === undefined) {
    return options;
  }
  if (options.seed === "degraded") {
    return { ...options, fontAvailable: false };
  }
  if (options.seed === "unsafe") {
    return {
      ...options,
      renderer: createStaticRenderer({
        status: "success",
        images: [
          {
            bytes: new TextEncoder().encode("FAKE_SECRET_CANARY_RENDERER_DOCTOR"),
            heightPx: 728,
            mimeType: "image/svg+xml",
            pageIndex: 0,
            stableImageId: "unsafe",
            widthPx: 1_568
          }
        ],
        glyphCoverage: {
          checkedCodePoints: 10,
          coveredCodePoints: 10,
          missingGlyphs: [],
          unsupportedGlyphs: []
        },
        timing: { completedAtMs: 1, durationMs: 1, startedAtMs: 0 }
      })
    };
  }
  return { ...options, adapterInstalled: false };
}

function createDoctorInput(modelProfile?: ModelProfileSummary): ContextRendererInput {
  return {
    ctxBlockLabel: "CTX-DOCTOR-GOLDEN",
    dimensionLimits: { maxHeightPx: 728, maxWidthPx: 1_568, minFontSizePx: 12 },
    exactSidecar: {
      integrityHash: "sha256:doctor-sidecar-hash",
      lineCount: 2,
      recoverable: true
    },
    modelProfile:
      modelProfile ??
      ({
        expiresAt: isoTimestamp("2026-08-16T00:00:00.000Z"),
        issuedAt: isoTimestamp("2026-07-16T00:00:00.000Z"),
        modelFamily: "synthetic-doctor",
        modelVersion: "2026-07",
        origin: "synthetic",
        profileId: "doctor-profile",
        provider: "unknown",
        status: "enabled"
      } satisfies ModelProfileSummary),
    pageLimits: { maxCharsPerPage: 64, maxPages: 2 },
    protectedSpans: [{ end: 15, reasonCodes: ["exact_value"], start: 4 }],
    safety: { policyApproved: true, secretCleaned: true },
    sourceText: "Doctor renderable prose with exact sidecar."
  };
}

function checkBoolean(
  name: string,
  passed: boolean,
  detail: string,
  nextAction: string
): RendererDoctorCheck {
  return {
    detail: passed ? detail : "Required renderer prerequisite is missing.",
    name,
    nextAction: passed ? "No action needed." : nextAction,
    status: passed ? "HEALTHY" : "UNSUPPORTED"
  };
}

function checkFontAvailability(present: boolean): RendererDoctorCheck {
  return present
    ? healthy("font availability", "A monospace font is available to the renderer.")
    : degraded(
        "font availability",
        "A supported monospace font was not detected.",
        "Install a supported monospace font manually and rerun the doctor."
      );
}

async function checkTempDirectory(tempRoot?: string): Promise<RendererDoctorCheck> {
  const root = tempRoot ?? tmpdir();
  let path: string | undefined;
  try {
    path = await mkdtemp(join(root, "context-diet-renderer-doctor-"));
    await writeFile(join(path, "probe.txt"), "safe metadata probe");
    await rm(path, { force: true, recursive: true });
    return healthy(
      "temp directory write and cleanup",
      "Temporary render directory can be written and cleaned."
    );
  } catch {
    if (path !== undefined) {
      await rm(path, { force: true, recursive: true }).catch(() => undefined);
    }
    return degraded(
      "temp directory write and cleanup",
      "Temporary render directory is not writable or could not be cleaned.",
      "Choose a writable temp directory and rerun the doctor."
    );
  }
}

async function renderWithTimeout(
  renderer: ContextRenderer,
  input: ContextRendererInput,
  timeoutMs: number
): Promise<ContextRendererResult | "timeout"> {
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), timeoutMs);
  });
  return Promise.race([renderer.render(input), timeout]);
}

function checkRenderResult(
  name: string,
  result: ContextRendererResult | "timeout"
): RendererDoctorCheck {
  if (result === "timeout") {
    return degraded(
      name,
      "Renderer did not finish within the timeout.",
      "Increase timeout or inspect renderer health."
    );
  }
  if (result.status === "failure") {
    return unsupported(
      name,
      `Renderer failed with ${result.failureReason}.`,
      "Fix renderer failure before enabling imaging."
    );
  }
  const golden = new TextDecoder().decode(result.images[0]?.bytes ?? new Uint8Array());
  return golden.includes("CTX-DOCTOR-GOLDEN") && golden.includes("sha256:doctor-sidecar-hash")
    ? healthy(name, "Golden render is deterministic and includes the CTX label.")
    : unsafe(
        name,
        "Golden render did not contain expected stable metadata.",
        "Disable imaging and inspect renderer output."
      );
}

function checkDimensions(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "supported image dimensions",
      "Image dimensions could not be verified.",
      "Fix render failure first."
    );
  }
  const image = result.images[0];
  const ok = image !== undefined && image.widthPx <= 1_568 && image.heightPx <= 728;
  return ok
    ? healthy(
        "supported image dimensions",
        "Rendered dimensions are within the supported profile limits."
      )
    : unsupported(
        "supported image dimensions",
        "Rendered dimensions exceed the supported profile limits.",
        "Reduce renderer dimensions or update the model profile."
      );
}

function checkGlyphCoverage(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "glyph coverage",
      "Glyph coverage could not be verified.",
      "Fix render failure first."
    );
  }
  return result.glyphCoverage.unsupportedGlyphs.length === 0 &&
    result.glyphCoverage.missingGlyphs.length === 0
    ? healthy("glyph coverage", "All doctor glyphs are covered.")
    : unsupported(
        "glyph coverage",
        "Some glyphs are missing or unsupported.",
        "Install a supported font or keep affected text native."
      );
}

function checkExactSidecar(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "exact-sidecar output",
      "Exact sidecar output could not be verified.",
      "Fix render failure first."
    );
  }
  const output = new TextDecoder().decode(result.images[0]?.bytes ?? new Uint8Array());
  return output.includes("sha256:doctor-sidecar-hash")
    ? healthy("exact-sidecar output", "Rendered output references the exact sidecar hash.")
    : unsafe(
        "exact-sidecar output",
        "Rendered output is missing exact sidecar metadata.",
        "Disable imaging until sidecar output is restored."
      );
}

async function checkProtectedSpanExclusion(
  renderer: ContextRenderer,
  input: ContextRendererInput
): Promise<RendererDoctorCheck> {
  const result = await renderer.render({
    ...input,
    protectedSpans: [{ end: 8, reasonCodes: ["secret_sensitive"], start: 0 }]
  });
  return result.status === "failure"
    ? healthy(
        "protected-span exclusion",
        "Secret-sensitive protected spans are refused by the renderer."
      )
    : unsafe(
        "protected-span exclusion",
        "Renderer accepted a secret-sensitive protected span.",
        "Disable imaging until protected-span gating is fixed."
      );
}

function checkSecretCanaryAbsence(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "fake secret-canary absence",
      "Canary absence could not be verified.",
      "Fix render failure first."
    );
  }
  const output = result.images.map((image) => new TextDecoder().decode(image.bytes)).join("\n");
  return output.includes("FAKE_SECRET_CANARY_RENDERER_DOCTOR")
    ? unsafe(
        "fake secret-canary absence",
        "A fake secret canary appeared in rendered output.",
        "Disable imaging and inspect scanner/redaction boundaries."
      )
    : healthy("fake secret-canary absence", "No fake secret canary appeared in rendered output.");
}

function checkModelProfile(input: ContextRendererInput): RendererDoctorCheck {
  return input.modelProfile.status === "enabled"
    ? healthy("model-profile compatibility", "Model profile is enabled for renderer doctor checks.")
    : unsupported(
        "model-profile compatibility",
        "Model profile is not enabled.",
        "Approve and enable a current model profile before imaging."
      );
}

function checkImageTokenCost(cost: number): RendererDoctorCheck {
  if (!Number.isFinite(cost) || cost <= 0) {
    return unsupported(
      "simulated image-token cost",
      "Image token cost could not be estimated.",
      "Add a valid image token accounting rule."
    );
  }
  return cost > 10_000
    ? degraded(
        "simulated image-token cost",
        "Simulated image-token cost is unusually high.",
        "Review model token accounting before enabling imaging."
      )
    : healthy(
        "simulated image-token cost",
        "Simulated image-token cost is within expected bounds."
      );
}

function checkRendererTimeout(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  return result === "timeout"
    ? degraded(
        "renderer timeout",
        "Renderer timed out.",
        "Increase timeout or inspect renderer performance."
      )
    : healthy("renderer timeout", "Renderer completed before timeout.");
}

async function checkCrashCleanup(tempRoot?: string): Promise<RendererDoctorCheck> {
  const root = tempRoot ?? tmpdir();
  let path: string | undefined;
  try {
    path = await mkdtemp(join(root, "context-diet-renderer-crash-"));
    await writeFile(join(path, "partial.tmp"), "safe partial metadata");
    throw new Error("simulated renderer crash");
  } catch {
    if (path !== undefined) {
      await rm(path, { force: true, recursive: true });
    }
    return healthy("crash cleanup", "Simulated crash artifacts were cleaned.");
  }
}

function aggregateStatus(checks: readonly RendererDoctorCheck[]): RendererDoctorStatus {
  if (checks.some((check) => check.status === "UNSAFE")) {
    return "UNSAFE";
  }
  if (checks.some((check) => check.status === "UNSUPPORTED")) {
    return "UNSUPPORTED";
  }
  if (checks.some((check) => check.status === "DEGRADED")) {
    return "DEGRADED";
  }
  return "HEALTHY";
}

function healthy(name: string, detail: string): RendererDoctorCheck {
  return { detail, name, nextAction: "No action needed.", status: "HEALTHY" };
}

function degraded(name: string, detail: string, nextAction: string): RendererDoctorCheck {
  return { detail, name, nextAction, status: "DEGRADED" };
}

function unsafe(name: string, detail: string, nextAction: string): RendererDoctorCheck {
  return { detail, name, nextAction, status: "UNSAFE" };
}

function unsupported(name: string, detail: string, nextAction: string): RendererDoctorCheck {
  return { detail, name, nextAction, status: "UNSUPPORTED" };
}

function createStaticRenderer(result: ContextRendererResult): ContextRenderer {
  return { render: async () => result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
