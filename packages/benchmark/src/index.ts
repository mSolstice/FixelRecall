import { deflateSync } from "node:zlib";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface BenchmarkReadiness {
  readonly comparableBaselineRequired: true;
}

export type BenchmarkVariant =
  | "uncompressed_control"
  | "safe_compressed"
  | "safe_compressed_exact_retrieval";

export type BenchmarkProvider = "openai" | "anthropic" | "synthetic";
export type BenchmarkRunStatus = "success" | "failed";
export type BenchmarkAgreementMethod = "task_tests" | "deterministic_checks" | "manual_review";

export interface BenchmarkUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly imageTokens: number | null;
  readonly tokenCountsAvailable: boolean;
}

export interface BenchmarkTestResult {
  readonly command: string;
  readonly passed: boolean;
  readonly outputSummary: string;
}

export interface BenchmarkOutputAgreement {
  readonly agreed: boolean;
  readonly method: BenchmarkAgreementMethod;
  readonly details: string;
}

export interface BenchmarkRun {
  readonly id: string;
  readonly variant: BenchmarkVariant;
  readonly provider: BenchmarkProvider;
  readonly modelProfile: string;
  readonly taskId: string;
  readonly repositoryId: string;
  readonly repositoryOrigin: "synthetic";
  readonly status: BenchmarkRunStatus;
  readonly usage: BenchmarkUsage;
  readonly cacheUsage: {
    readonly treatment: "none" | "provider_cache" | "context_diet_cache";
    readonly cacheHits: number;
    readonly cacheMisses: number;
  };
  readonly latencyMs: number;
  readonly toolActions: readonly string[];
  readonly filesChanged: readonly string[];
  readonly testResults: readonly BenchmarkTestResult[];
  readonly outputAgreement: BenchmarkOutputAgreement;
  readonly retrievalCalls: number;
  readonly protectedValuesImagedCount: number;
  readonly errors: readonly string[];
}

export interface BenchmarkScenario {
  readonly taskId: string;
  readonly taskName: string;
  readonly provider: BenchmarkProvider;
  readonly modelProfile: string;
  readonly repositoryId: string;
  readonly repositoryOrigin: "synthetic";
}

export interface BenchmarkReport {
  readonly dataOrigin: "synthetic";
  readonly generatedAt: string;
  readonly scenario: BenchmarkScenario;
  readonly runs: readonly BenchmarkRun[];
  readonly comparison: {
    readonly comparable: boolean;
    readonly rejectedReasons: readonly string[];
    readonly summary: string;
  };
}

export interface BenchmarkReportFiles {
  readonly jsonPath: string;
  readonly markdownPath: string;
}

export interface ShareCardAllowedFields {
  readonly percentageInputReduction: number | null;
  readonly estimatedTotalSaving: number;
  readonly testsPassed: number;
  readonly protectedValuesImagedCount: number;
  readonly modelFamily: string;
  readonly benchmarkDate: string;
}

export interface ShareCardPreview {
  readonly allowedFields: ShareCardAllowedFields;
  readonly allowlist: readonly ShareCardAllowedFieldName[];
  readonly blockedFields: readonly string[];
  readonly previewText: string;
  readonly shareNothingAutomatically: true;
}

export interface ShareCardExportOptions {
  readonly confirm: boolean;
  readonly outputDirectory: string;
}

export interface ShareCardExportResult {
  readonly exported: boolean;
  readonly preview: ShareCardPreview;
  readonly pngPath: string | null;
  readonly proofJsonPath: string | null;
}

export type ShareCardAllowedFieldName = keyof ShareCardAllowedFields;

export const shareCardAllowedFields = [
  "percentageInputReduction",
  "estimatedTotalSaving",
  "testsPassed",
  "protectedValuesImagedCount",
  "modelFamily",
  "benchmarkDate"
] as const satisfies readonly ShareCardAllowedFieldName[];

export const shareCardForbiddenFields = [
  "repositoryName",
  "repository",
  "projectHash",
  "branch",
  "paths",
  "path",
  "prompts",
  "prompt",
  "code",
  "userIdentity",
  "user",
  "sessionIds",
  "sessionId",
  "providerCredentials",
  "credential",
  "authorization",
  "apiKey"
] as const;

export function benchmarkReadiness(): BenchmarkReadiness {
  return { comparableBaselineRequired: true };
}

export function createSyntheticBenchmarkReport(seed = 1): BenchmarkReport {
  const scenario: BenchmarkScenario = {
    modelProfile: "synthetic-safe-profile-v1",
    provider: "synthetic",
    repositoryId: `synthetic-repo-${seed}`,
    repositoryOrigin: "synthetic",
    taskId: `safe-task-${seed}`,
    taskName: "Update a synthetic formatting helper and run deterministic tests"
  };
  return createPersonalBenchmarkReport({
    generatedAt: "2026-07-17T00:00:00.000Z",
    runs: [
      syntheticRun(scenario, "uncompressed_control", 24_000, 4_000, 0, 0, 1800, 0),
      syntheticRun(scenario, "safe_compressed", 11_000, 4_000, 2_000, 900, 2050, 0),
      syntheticRun(scenario, "safe_compressed_exact_retrieval", 12_000, 4_000, 2_500, 900, 2250, 2)
    ],
    scenario
  });
}

export function createPersonalBenchmarkReport(input: {
  readonly scenario: BenchmarkScenario;
  readonly runs: readonly BenchmarkRun[];
  readonly generatedAt: string;
}): BenchmarkReport {
  const rejectedReasons = validateComparableRuns(input.scenario, input.runs);
  return {
    comparison: {
      comparable: rejectedReasons.length === 0,
      rejectedReasons,
      summary:
        rejectedReasons.length === 0
          ? "The three synthetic benchmark runs are comparable. Agreement is based on task tests and deterministic checks, not text similarity alone."
          : "The benchmark runs are not comparable and must not be used for savings or quality conclusions."
    },
    dataOrigin: "synthetic",
    generatedAt: input.generatedAt,
    runs: input.runs,
    scenario: input.scenario
  };
}

export function validateComparableRuns(
  scenario: BenchmarkScenario,
  runs: readonly BenchmarkRun[]
): readonly string[] {
  const reasons: string[] = [];
  const variants = new Set(runs.map((run) => run.variant));
  for (const required of [
    "uncompressed_control",
    "safe_compressed",
    "safe_compressed_exact_retrieval"
  ] satisfies readonly BenchmarkVariant[]) {
    if (!variants.has(required)) {
      reasons.push(`Missing required run variant: ${required}.`);
    }
  }
  for (const run of runs) {
    if (run.repositoryOrigin !== "synthetic" || scenario.repositoryOrigin !== "synthetic") {
      reasons.push("Personal benchmark harness currently accepts only synthetic repositories.");
    }
    if (run.provider !== scenario.provider) {
      reasons.push(`Run ${run.id} uses provider ${run.provider}, not ${scenario.provider}.`);
    }
    if (run.modelProfile !== scenario.modelProfile) {
      reasons.push(
        `Run ${run.id} uses model profile ${run.modelProfile}, not ${scenario.modelProfile}.`
      );
    }
    if (run.taskId !== scenario.taskId) {
      reasons.push(`Run ${run.id} uses task ${run.taskId}, not ${scenario.taskId}.`);
    }
    if (run.repositoryId !== scenario.repositoryId) {
      reasons.push(
        `Run ${run.id} uses repository ${run.repositoryId}, not ${scenario.repositoryId}.`
      );
    }
    if (run.status !== "success") {
      reasons.push(`Run ${run.id} failed and cannot be compared as a successful benchmark run.`);
    }
    if (!run.usage.tokenCountsAvailable) {
      reasons.push(`Run ${run.id} has unavailable token counts.`);
    }
    if (run.protectedValuesImagedCount > 0) {
      reasons.push(`Run ${run.id} imaged protected values and is unsafe to compare.`);
    }
    if (!run.outputAgreement.agreed) {
      reasons.push(`Run ${run.id} did not meet deterministic output agreement.`);
    }
    if (run.outputAgreement.method === "manual_review") {
      reasons.push(`Run ${run.id} relies on manual review; deterministic checks are required.`);
    }
    if (run.testResults.length === 0 || run.testResults.some((result) => !result.passed)) {
      reasons.push(`Run ${run.id} does not have passing task tests.`);
    }
  }
  return [...new Set(reasons)];
}

export function renderBenchmarkMarkdown(report: BenchmarkReport): string {
  const lines = [
    "# Context Diet Personal Benchmark",
    "",
    "SYNTHETIC TEST DATA",
    "",
    `Generated: ${report.generatedAt}`,
    `Task: ${report.scenario.taskName}`,
    `Provider: ${report.scenario.provider}`,
    `Model profile: ${report.scenario.modelProfile}`,
    `Repository: ${report.scenario.repositoryId}`,
    "",
    "## Comparison",
    "",
    `Comparable: ${report.comparison.comparable ? "yes" : "no"}`,
    report.comparison.summary,
    ""
  ];
  if (report.comparison.rejectedReasons.length > 0) {
    lines.push("Rejected reasons:", "");
    for (const reason of report.comparison.rejectedReasons) {
      lines.push(`- ${reason}`);
    }
    lines.push("");
  }
  lines.push("## Runs", "");
  for (const run of report.runs) {
    lines.push(
      `### ${run.variant}`,
      "",
      `Status: ${run.status}`,
      `Input tokens: ${formatNullable(run.usage.inputTokens)}`,
      `Output tokens: ${formatNullable(run.usage.outputTokens)}`,
      `Cached input tokens: ${formatNullable(run.usage.cachedInputTokens)}`,
      `Image tokens: ${formatNullable(run.usage.imageTokens)}`,
      `Latency: ${run.latencyMs} ms`,
      `Cache treatment: ${run.cacheUsage.treatment}`,
      `Tool actions: ${run.toolActions.join(", ") || "none"}`,
      `Files changed: ${run.filesChanged.join(", ") || "none"}`,
      `Retrieval calls: ${run.retrievalCalls}`,
      `Protected values imaged: ${run.protectedValuesImagedCount}`,
      `Output agreement: ${run.outputAgreement.agreed ? "passed" : "failed"} via ${run.outputAgreement.method}`,
      `Errors: ${run.errors.join("; ") || "none"}`,
      "",
      "Test commands:",
      ""
    );
    for (const result of run.testResults) {
      lines.push(
        `- ${result.command}: ${result.passed ? "passed" : "failed"} (${result.outputSummary})`
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function writeBenchmarkReport(
  report: BenchmarkReport,
  outputDirectory: string
): Promise<BenchmarkReportFiles> {
  await mkdir(outputDirectory, { recursive: true });
  const jsonPath = join(outputDirectory, "context-diet-personal-benchmark.json");
  const markdownPath = join(outputDirectory, "context-diet-personal-benchmark.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderBenchmarkMarkdown(report), "utf8");
  return { jsonPath, markdownPath };
}

export function createShareCardPreview(input: Record<string, unknown>): ShareCardPreview {
  const blockedFields = detectForbiddenFields(input);
  const allowedFields = pickAllowedShareFields(input);
  return {
    allowedFields,
    allowlist: shareCardAllowedFields,
    blockedFields,
    previewText: renderShareCardPreviewText(allowedFields, blockedFields),
    shareNothingAutomatically: true
  };
}

export async function exportShareCard(
  input: Record<string, unknown>,
  options: ShareCardExportOptions
): Promise<ShareCardExportResult> {
  const preview = createShareCardPreview(input);
  if (!options.confirm) {
    return { exported: false, pngPath: null, preview, proofJsonPath: null };
  }
  await mkdir(options.outputDirectory, { recursive: true });
  const pngPath = join(options.outputDirectory, "context-diet-share-card.png");
  const proofJsonPath = join(options.outputDirectory, "context-diet-share-card.proof.json");
  await writeFile(pngPath, createShareCardPng(preview.allowedFields));
  await writeFile(
    proofJsonPath,
    `${JSON.stringify(
      {
        allowlist: preview.allowlist,
        blockedFields: preview.blockedFields,
        exported: true,
        fields: preview.allowedFields,
        shareNothingAutomatically: true
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return { exported: true, pngPath, preview, proofJsonPath };
}

function pickAllowedShareFields(input: Record<string, unknown>): ShareCardAllowedFields {
  return {
    benchmarkDate: stringField(input.benchmarkDate),
    estimatedTotalSaving: numberField(input.estimatedTotalSaving),
    modelFamily: stringField(input.modelFamily),
    percentageInputReduction:
      input.percentageInputReduction === null ? null : numberField(input.percentageInputReduction),
    protectedValuesImagedCount: integerField(input.protectedValuesImagedCount),
    testsPassed: integerField(input.testsPassed)
  };
}

function detectForbiddenFields(input: Record<string, unknown>): readonly string[] {
  const blocked = new Set<string>();
  const forbidden = new Set(shareCardForbiddenFields.map((field) => field.toLowerCase()));
  const visit = (value: unknown, prefix: string): void => {
    if (value === null || typeof value !== "object") {
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      const path = prefix.length === 0 ? key : `${prefix}.${key}`;
      if (forbidden.has(key.toLowerCase())) {
        blocked.add(path);
      }
      visit(nested, path);
    }
  };
  visit(input, "");
  return [...blocked].sort();
}

function renderShareCardPreviewText(
  fields: ShareCardAllowedFields,
  blockedFields: readonly string[]
): string {
  return [
    "Context Diet share-card preview",
    `Input reduction: ${fields.percentageInputReduction === null ? "not comparable" : `${fields.percentageInputReduction}%`}`,
    `Estimated total saving: $${fields.estimatedTotalSaving.toFixed(2)}`,
    `Tests passed: ${fields.testsPassed}`,
    `Protected values imaged: ${fields.protectedValuesImagedCount}`,
    `Model family: ${fields.modelFamily}`,
    `Benchmark date: ${fields.benchmarkDate}`,
    `Blocked forbidden fields: ${blockedFields.length}`
  ].join("\n");
}

function createShareCardPng(fields: ShareCardAllowedFields): Buffer {
  const width = 640;
  const height = 360;
  const safeValue =
    fields.percentageInputReduction === null
      ? 180
      : Math.max(80, Math.min(220, Math.round(220 - fields.percentageInputReduction)));
  const row = Buffer.alloc(1 + width * 4);
  row[0] = 0;
  for (let x = 0; x < width; x += 1) {
    const offset = 1 + x * 4;
    row[offset] = 22;
    row[offset + 1] = safeValue;
    row[offset + 2] = 130;
    row[offset + 3] = 255;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  return Buffer.concat([uint32(data.length), typeBytes, data, uint32(crc32(typeBytes, data))]);
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function crc32(type: Buffer, data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function integerField(value: unknown): number {
  return Math.max(0, Math.round(numberField(value)));
}

function stringField(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value : "unknown";
}

function syntheticRun(
  scenario: BenchmarkScenario,
  variant: BenchmarkVariant,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number,
  imageTokens: number,
  latencyMs: number,
  retrievalCalls: number
): BenchmarkRun {
  return {
    cacheUsage: {
      cacheHits: cachedInputTokens > 0 ? 2 : 0,
      cacheMisses: cachedInputTokens > 0 ? 1 : 0,
      treatment: variant === "uncompressed_control" ? "none" : "context_diet_cache"
    },
    errors: [],
    filesChanged: ["src/synthetic-format-helper.ts", "src/synthetic-format-helper.test.ts"],
    id: `${scenario.taskId}-${variant}`,
    latencyMs,
    modelProfile: scenario.modelProfile,
    outputAgreement: {
      agreed: true,
      details: "Synthetic unit tests and deterministic snapshot checks agree.",
      method: "task_tests"
    },
    protectedValuesImagedCount: 0,
    provider: scenario.provider,
    repositoryId: scenario.repositoryId,
    repositoryOrigin: scenario.repositoryOrigin,
    retrievalCalls,
    status: "success",
    taskId: scenario.taskId,
    testResults: [
      {
        command: "pnpm test -- synthetic-format-helper",
        outputSummary: "synthetic helper tests passed",
        passed: true
      }
    ],
    toolActions: ["read_file", "apply_patch", "run_tests"],
    usage: {
      cachedInputTokens,
      imageTokens,
      inputTokens,
      outputTokens,
      tokenCountsAvailable: true
    },
    variant
  };
}

function formatNullable(value: number | null): string {
  return value === null ? "unavailable" : String(value);
}
