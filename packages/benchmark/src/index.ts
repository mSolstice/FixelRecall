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
    readonly treatment: "none" | "provider_cache" | "fixel_recall_cache";
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

export interface StrictPatchValidationResult {
  readonly valid: boolean;
  readonly reasons: readonly string[];
}

export interface JsonReplacementValidationResult {
  readonly valid: boolean;
  readonly reasons: readonly string[];
  readonly replacement: {
    readonly file: "src/list-utils.js";
    readonly content: string;
  } | null;
}

export interface ShareCardAllowedFields {
  readonly percentageInputReduction: number | null;
  readonly estimatedTotalSaving: number;
  readonly testsPassed: number;
  readonly protectedValuesImagedCount: number;
  readonly modelFamily: string;
  readonly benchmarkDate: string;
  readonly verificationId: string;
  readonly evidenceOriginLabel: "SYNTHETIC" | "MEASURED" | "MIXED";
  readonly compatibilityVerdict:
    | "RECOMMENDED"
    | "RECOMMENDED_WITH_RESTRICTIONS"
    | "AUDIT_ONLY"
    | "NOT_WORTH_USING"
    | "UNSUPPORTED"
    | "RETEST_REQUIRED";
  readonly monthlyProjectionRange: string;
  readonly benchmarkProfile: string;
  readonly testStatus: "PASSING" | "FAILING" | "INCOMPLETE";
  readonly syntheticWatermark: "SYNTHETIC RESULTS";
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
  readonly svgPath: string | null;
  readonly proofJsonPath: string | null;
}

export interface ShareCardProofObject {
  readonly artifactKind: "fixel_recall_share_card_proof";
  readonly exported: boolean;
  readonly allowlist: readonly ShareCardAllowedFieldName[];
  readonly blockedFieldCount: number;
  readonly fields: ShareCardAllowedFields;
  readonly generatedFiles: readonly ("png" | "svg" | "json_proof")[];
  readonly noUploadOrShareAction: true;
  readonly shareNothingAutomatically: true;
}

export type ShareCardAllowedFieldName = keyof ShareCardAllowedFields;

export type SyntheticBenchmarkBadgeVariant =
  | "benchmark_passing"
  | "synthetic_input_reduction"
  | "protected_values_imaged"
  | "compatibility_status";

export interface SyntheticBenchmarkEvidence {
  readonly artifactKind: "fixel_recall_synthetic_benchmark_evidence";
  readonly dataOrigin: "synthetic";
  readonly syntheticNotice: "SYNTHETIC TEST DATA";
  readonly seed: number;
  readonly generatedAt: string;
  readonly benchmarkPassing: boolean;
  readonly inputReductionPercent: number | null;
  readonly protectedValuesImagedCount: number;
  readonly compatibilityStatus: "PASSING" | "BLOCKED";
  readonly testsPassed: number;
  readonly testsTotal: number;
  readonly modelFamily: string;
  readonly benchmarkDate: string;
  readonly stableResultKey: string;
  readonly privacyFilter: "forbidden_private_fields_excluded";
  readonly forbiddenPrivateFieldCount: number;
}

export interface SyntheticBenchmarkArtifacts {
  readonly evidence: SyntheticBenchmarkEvidence;
  readonly markdownSummary: string;
  readonly pullRequestCommentText: string;
  readonly readmeEmbedInstructions: string;
  readonly badges: Readonly<Record<SyntheticBenchmarkBadgeVariant, string>>;
}

export const shareCardAllowedFields = [
  "percentageInputReduction",
  "estimatedTotalSaving",
  "testsPassed",
  "protectedValuesImagedCount",
  "modelFamily",
  "benchmarkDate",
  "verificationId",
  "evidenceOriginLabel",
  "compatibilityVerdict",
  "monthlyProjectionRange",
  "benchmarkProfile",
  "testStatus",
  "syntheticWatermark"
] as const satisfies readonly ShareCardAllowedFieldName[];

export const shareCardForbiddenFields = [
  "repositoryName",
  "repository",
  "projectHash",
  "branch",
  "paths",
  "path",
  "filePath",
  "filePaths",
  "prompts",
  "prompt",
  "rawPrompt",
  "promptText",
  "code",
  "diff",
  "userIdentity",
  "user",
  "sessionIds",
  "sessionId",
  "providerCredentials",
  "credentials",
  "credential",
  "authorization",
  "apiKey",
  "rawAuditEvents",
  "rawAuditEvent",
  "auditEvents"
] as const;

export const syntheticBenchmarkEvidenceAllowedFields = [
  "artifactKind",
  "dataOrigin",
  "syntheticNotice",
  "seed",
  "generatedAt",
  "benchmarkPassing",
  "inputReductionPercent",
  "protectedValuesImagedCount",
  "compatibilityStatus",
  "testsPassed",
  "testsTotal",
  "modelFamily",
  "benchmarkDate",
  "stableResultKey",
  "privacyFilter",
  "forbiddenPrivateFieldCount"
] as const satisfies readonly (keyof SyntheticBenchmarkEvidence)[];

export const syntheticBenchmarkForbiddenFields = [
  ...shareCardForbiddenFields,
  "repositoryId",
  "repositoryOrigin",
  "repositoryName",
  "taskId",
  "taskName",
  "filesChanged",
  "filePath",
  "diff",
  "rawPrompt",
  "promptText",
  "requestBody",
  "responseBody",
  "authentication",
  "secret",
  "token"
] as const;

export function benchmarkReadiness(): BenchmarkReadiness {
  return { comparableBaselineRequired: true };
}

export function renderStrictBenchmarkCanaryInstructions(): string {
  return [
    "REAL-PROVIDER BENCHMARK CANARY ONLY.",
    "",
    "Return a strict unified diff patch only.",
    "",
    "Output rules:",
    "- No markdown fences.",
    "- No explanation.",
    "- No prose before or after the diff.",
    "- File paths must be exactly src/list-utils.js.",
    "- Use --- src/list-utils.js and +++ src/list-utils.js.",
    "- Do not use a/ or b/ path prefixes.",
    "- Use valid unified diff hunk headers with correct line counts.",
    "- The patch must apply with: patch -p0 -i candidate.patch.",
    "- The patched project must pass: node --test.",
    "- Do not add dependencies.",
    "- Do not change test expectations.",
    "- Preserve exported function name."
  ].join("\n");
}

export function renderJsonReplacementBenchmarkCanaryInstructions(): string {
  return [
    "REAL-PROVIDER BENCHMARK CANARY ONLY.",
    "",
    "Return JSON only.",
    "",
    "Output rules:",
    "- No markdown fences.",
    "- No explanation.",
    "- No prose before or after the JSON.",
    '- JSON schema: {"file":"src/list-utils.js","replacement":"complete replacement file content"}.',
    "- File must be exactly src/list-utils.js.",
    "- Replacement must be the complete src/list-utils.js file content.",
    "- Replacement must preserve exported function name normalizeShoppingList.",
    "- Replacement must not import dependencies.",
    "- Do not change tests.",
    "- Do not include extra JSON fields.",
    "- The local harness will write replacement to a temp copy and run: node --test."
  ].join("\n");
}

export function validateJsonReplacementBenchmarkOutput(
  output: string,
  expectedPath = "src/list-utils.js"
): JsonReplacementValidationResult {
  const reasons: string[] = [];
  const candidate = extractJsonReplacementCandidate(output, reasons);
  if (candidate === null) {
    return { reasons: [...new Set(reasons)], replacement: null, valid: false };
  }
  const parsed = parseJsonReplacementCandidate(candidate, reasons);
  if (parsed === null) {
    return { reasons: [...new Set(reasons)], replacement: null, valid: false };
  }
  const keys = Object.keys(parsed).sort();
  if (keys.join(",") !== "file,replacement") {
    reasons.push("JSON object must contain exactly file and replacement fields.");
  }
  if (parsed.file !== expectedPath) {
    reasons.push(`JSON file field must be exactly ${expectedPath}.`);
  }
  if (typeof parsed.replacement !== "string" || parsed.replacement.trim().length === 0) {
    reasons.push("JSON replacement field must be non-empty complete file content.");
  }
  const replacement = typeof parsed.replacement === "string" ? parsed.replacement : "";
  if (!/\bexport\s+function\s+normalizeShoppingList\s*\(/.test(replacement)) {
    reasons.push("Replacement must preserve exported function normalizeShoppingList.");
  }
  if (/^\s*import\s/m.test(replacement)) {
    reasons.push("Replacement must not import dependencies.");
  }
  if (/from\s+["'][^"']+["']/.test(replacement)) {
    reasons.push("Replacement must not reference imported dependencies.");
  }
  return {
    reasons: [...new Set(reasons)],
    replacement: reasons.length === 0 ? { content: replacement, file: "src/list-utils.js" } : null,
    valid: reasons.length === 0
  };
}

export function validateStrictUnifiedDiffPatch(
  patch: string,
  expectedPath = "src/list-utils.js"
): StrictPatchValidationResult {
  const reasons: string[] = [];
  if (patch.includes("```")) {
    reasons.push("Patch must not contain markdown fences.");
  }
  const lines = patch.replaceAll("\r\n", "\n").split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    reasons.push("Patch is empty.");
    return { reasons, valid: false };
  }
  if (nonEmptyLines[0] !== `--- ${expectedPath}`) {
    reasons.push(`Patch must start with --- ${expectedPath}.`);
  }
  const oldPathLines = nonEmptyLines.filter((line) => line.startsWith("--- "));
  const newPathLines = nonEmptyLines.filter((line) => line.startsWith("+++ "));
  if (oldPathLines.length !== 1 || oldPathLines[0] !== `--- ${expectedPath}`) {
    reasons.push(`Patch must contain exactly one old path line for ${expectedPath}.`);
  }
  if (newPathLines.length !== 1 || newPathLines[0] !== `+++ ${expectedPath}`) {
    reasons.push(`Patch must contain exactly one new path line for ${expectedPath}.`);
  }
  if (patch.includes("--- a/") || patch.includes("+++ b/")) {
    reasons.push("Patch must not use a/ or b/ path prefixes.");
  }
  const illegalLine = nonEmptyLines.find(
    (line, index) =>
      index > 1 &&
      !line.startsWith("@@") &&
      !line.startsWith("+") &&
      !line.startsWith("-") &&
      !line.startsWith(" ")
  );
  if (illegalLine !== undefined) {
    reasons.push(`Patch contains non-diff text: ${illegalLine.slice(0, 80)}.`);
  }
  reasons.push(...validateUnifiedDiffHunks(nonEmptyLines));
  return { reasons: [...new Set(reasons)], valid: reasons.length === 0 };
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
    "# Fixel Recall Personal Benchmark",
    "",
    "SYNTHETIC DATA",
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
  const jsonPath = join(outputDirectory, "fixel-recall-personal-benchmark.json");
  const markdownPath = join(outputDirectory, "fixel-recall-personal-benchmark.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderBenchmarkMarkdown(report), "utf8");
  return { jsonPath, markdownPath };
}

export function createSyntheticBenchmarkArtifacts(seed = 1): SyntheticBenchmarkArtifacts {
  const report = createSyntheticBenchmarkReport(seed);
  const evidence = createSyntheticBenchmarkEvidence(report, seed);
  const badges = createSyntheticBenchmarkBadges(evidence);
  return {
    badges,
    evidence,
    markdownSummary: renderSyntheticBenchmarkJobSummary(evidence),
    pullRequestCommentText: renderSyntheticBenchmarkPullRequestComment(evidence),
    readmeEmbedInstructions: renderSyntheticBenchmarkReadmeInstructions()
  };
}

export function createSyntheticBenchmarkEvidence(
  report: BenchmarkReport,
  seed: number
): SyntheticBenchmarkEvidence {
  const control = runByVariant(report, "uncompressed_control");
  const compressed = runByVariant(report, "safe_compressed_exact_retrieval");
  const controlInput = control?.usage.inputTokens ?? null;
  const compressedInput = compressed?.usage.inputTokens ?? null;
  const inputReductionPercent =
    controlInput === null || compressedInput === null || controlInput <= 0
      ? null
      : Math.round(((controlInput - compressedInput) / controlInput) * 100);
  const protectedValuesImagedCount = report.runs.reduce(
    (total, run) => total + run.protectedValuesImagedCount,
    0
  );
  const testsTotal = report.runs.reduce((total, run) => total + run.testResults.length, 0);
  const testsPassed = report.runs.reduce(
    (total, run) => total + run.testResults.filter((result) => result.passed).length,
    0
  );
  const benchmarkPassing =
    report.comparison.comparable &&
    report.runs.every((run) => run.status === "success") &&
    testsTotal > 0 &&
    testsPassed === testsTotal &&
    protectedValuesImagedCount === 0;
  return assertSyntheticEvidenceAllowlist({
    artifactKind: "fixel_recall_synthetic_benchmark_evidence",
    benchmarkDate: report.generatedAt.slice(0, 10),
    benchmarkPassing,
    compatibilityStatus: benchmarkPassing ? "PASSING" : "BLOCKED",
    dataOrigin: "synthetic",
    forbiddenPrivateFieldCount: syntheticBenchmarkForbiddenFields.length,
    generatedAt: report.generatedAt,
    inputReductionPercent,
    modelFamily: report.scenario.modelProfile,
    privacyFilter: "forbidden_private_fields_excluded",
    protectedValuesImagedCount,
    seed,
    stableResultKey: `synthetic-seed-${seed}-${benchmarkPassing ? "passing" : "blocked"}-${inputReductionPercent ?? "na"}-${protectedValuesImagedCount}`,
    syntheticNotice: "SYNTHETIC TEST DATA",
    testsPassed,
    testsTotal
  });
}

export function createSyntheticBenchmarkBadges(
  evidence: SyntheticBenchmarkEvidence
): Readonly<Record<SyntheticBenchmarkBadgeVariant, string>> {
  return {
    benchmark_passing: renderBadge({
      color: evidence.benchmarkPassing ? "#2f7d4f" : "#9c2f2f",
      label: "Fixel Recall",
      message: evidence.benchmarkPassing ? "benchmark passing" : "benchmark blocked"
    }),
    compatibility_status: renderBadge({
      color: evidence.compatibilityStatus === "PASSING" ? "#2f7d4f" : "#9c2f2f",
      label: "compatibility",
      message: `SYNTHETIC ${evidence.compatibilityStatus}`
    }),
    protected_values_imaged: renderBadge({
      color: evidence.protectedValuesImagedCount === 0 ? "#2f7d4f" : "#9c2f2f",
      label: "protected imaged",
      message: `SYNTHETIC ${evidence.protectedValuesImagedCount}`
    }),
    synthetic_input_reduction: renderBadge({
      color: evidence.inputReductionPercent === null ? "#606a78" : "#1d6fdc",
      label: "input reduction",
      message:
        evidence.inputReductionPercent === null
          ? "not comparable"
          : `SYNTHETIC ${evidence.inputReductionPercent}%`
    })
  };
}

export function renderSyntheticBenchmarkJobSummary(evidence: SyntheticBenchmarkEvidence): string {
  return [
    "# Fixel Recall Synthetic Benchmark",
    "",
    "**SYNTHETIC TEST DATA**",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Benchmark | ${evidence.benchmarkPassing ? "passing" : "blocked"} |`,
    `| Input reduction | ${evidence.inputReductionPercent === null ? "not comparable" : `SYNTHETIC ${evidence.inputReductionPercent}%`} |`,
    `| Protected values imaged | SYNTHETIC ${evidence.protectedValuesImagedCount} |`,
    `| Compatibility | ${evidence.compatibilityStatus} |`,
    `| Tests | ${evidence.testsPassed}/${evidence.testsTotal} passed |`,
    `| Model family | ${evidence.modelFamily} |`,
    `| Seed | ${evidence.seed} |`,
    "",
    "Artifacts are generated from allowlisted synthetic fields only. Sensitive source details and credentials are excluded."
  ].join("\n");
}

export function renderSyntheticBenchmarkPullRequestComment(
  evidence: SyntheticBenchmarkEvidence
): string {
  return [
    "## Fixel Recall synthetic benchmark",
    "",
    "**SYNTHETIC TEST DATA**",
    "",
    `Benchmark: ${evidence.benchmarkPassing ? "passing" : "blocked"}`,
    `Input reduction: ${evidence.inputReductionPercent === null ? "not comparable" : `SYNTHETIC ${evidence.inputReductionPercent}%`}`,
    `Protected values imaged: SYNTHETIC ${evidence.protectedValuesImagedCount}`,
    `Compatibility: ${evidence.compatibilityStatus}`,
    "",
    "This text is saved as an artifact only; the workflow does not publish comments automatically."
  ].join("\n");
}

export function renderSyntheticBenchmarkReadmeInstructions(): string {
  return [
    "# Fixel Recall Synthetic Benchmark Badge Embeds",
    "",
    "These badges are generated locally by GitHub Actions and uploaded as workflow artifacts. They are not published to an external badge service.",
    "",
    "After downloading the `fixel-recall-synthetic-benchmark` artifact, copy the SVG files into a committed docs or assets folder if you choose to display them.",
    "",
    "```md",
    "![Fixel Recall benchmark](docs/badges/fixel-recall-benchmark.svg)",
    "![Synthetic input reduction](docs/badges/fixel-recall-input-reduction.svg)",
    "![Protected values imaged](docs/badges/fixel-recall-protected-imaged.svg)",
    "![Compatibility status](docs/badges/fixel-recall-compatibility.svg)",
    "```",
    "",
    "Every numeric badge based on test data includes `SYNTHETIC`. Do not replace these with production claims unless measured evidence is available."
  ].join("\n");
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
    return { exported: false, pngPath: null, preview, proofJsonPath: null, svgPath: null };
  }
  await mkdir(options.outputDirectory, { recursive: true });
  const pngPath = join(options.outputDirectory, "fixel-recall-share-card.png");
  const svgPath = join(options.outputDirectory, "fixel-recall-share-card.svg");
  const proofJsonPath = join(options.outputDirectory, "fixel-recall-share-card.proof.json");
  await writeFile(pngPath, createShareCardPng(preview.allowedFields));
  await writeFile(svgPath, createShareCardSvg(preview.allowedFields), "utf8");
  const proof = createShareCardProofObject(preview, true);
  await writeFile(proofJsonPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  return { exported: true, pngPath, preview, proofJsonPath, svgPath };
}

function pickAllowedShareFields(input: Record<string, unknown>): ShareCardAllowedFields {
  return {
    benchmarkDate: stringField(input.benchmarkDate),
    benchmarkProfile: stringField(input.benchmarkProfile),
    compatibilityVerdict: compatibilityVerdictField(input.compatibilityVerdict),
    estimatedTotalSaving: numberField(input.estimatedTotalSaving),
    evidenceOriginLabel: evidenceOriginField(input.evidenceOriginLabel),
    modelFamily: stringField(input.modelFamily),
    monthlyProjectionRange: stringField(input.monthlyProjectionRange),
    percentageInputReduction:
      input.percentageInputReduction === null ? null : numberField(input.percentageInputReduction),
    protectedValuesImagedCount: integerField(input.protectedValuesImagedCount),
    syntheticWatermark: "SYNTHETIC RESULTS",
    testStatus: testStatusField(input.testStatus),
    testsPassed: integerField(input.testsPassed),
    verificationId: stringField(input.verificationId)
  };
}

function createShareCardProofObject(
  preview: ShareCardPreview,
  exported: boolean
): ShareCardProofObject {
  return {
    allowlist: preview.allowlist,
    artifactKind: "fixel_recall_share_card_proof",
    blockedFieldCount: preview.blockedFields.length,
    exported,
    fields: preview.allowedFields,
    generatedFiles: exported ? ["png", "svg", "json_proof"] : [],
    noUploadOrShareAction: true,
    shareNothingAutomatically: true
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

function assertSyntheticEvidenceAllowlist(
  evidence: SyntheticBenchmarkEvidence
): SyntheticBenchmarkEvidence {
  const allowed = new Set<string>(syntheticBenchmarkEvidenceAllowedFields);
  for (const key of Object.keys(evidence)) {
    if (!allowed.has(key)) {
      throw new Error(`Synthetic benchmark evidence field is not allowlisted: ${key}`);
    }
  }
  return evidence;
}

function runByVariant(
  report: BenchmarkReport,
  variant: BenchmarkVariant
): BenchmarkRun | undefined {
  return report.runs.find((run) => run.variant === variant);
}

function extractJsonReplacementCandidate(output: string, reasons: string[]): string | null {
  const trimmed = output.trim();
  const fencedBlocks = [...trimmed.matchAll(/```(?<language>[^\n`]*)\n(?<body>[\s\S]*?)```/g)];
  if (fencedBlocks.length === 0) {
    if (trimmed.includes("```")) {
      reasons.push("Fenced JSON block is malformed.");
      return null;
    }
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      reasons.push("Output must be a single JSON object with no surrounding prose.");
    }
    return trimmed;
  }
  if (fencedBlocks.length > 1) {
    reasons.push("Output must not contain multiple fenced JSON blocks.");
    return null;
  }
  const block = fencedBlocks[0]!;
  const language = (block.groups?.language ?? "").trim().toLowerCase();
  if (language !== "json") {
    reasons.push("Fenced JSON block must be labelled json.");
  }
  const blockIndex = block.index ?? 0;
  const before = trimmed.slice(0, blockIndex).trim();
  const after = trimmed.slice(blockIndex + block[0].length).trim();
  if (before.length > 0 || after.length > 0) {
    reasons.push("Output must not contain prose outside the fenced JSON block.");
  }
  const body = (block.groups?.body ?? "").trim();
  if (!body.startsWith("{") || !body.endsWith("}")) {
    reasons.push("Fenced JSON block must contain exactly one JSON object.");
  }
  return body;
}

function parseJsonReplacementCandidate(
  value: string,
  reasons: string[]
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      reasons.push("Output JSON must be an object.");
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    reasons.push("Output must be valid JSON.");
    return null;
  }
}

function validateUnifiedDiffHunks(lines: readonly string[]): readonly string[] {
  const reasons: string[] = [];
  const hunkHeaderPattern =
    /^@@ -(?<oldStart>\d+)(?:,(?<oldCount>\d+))? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@/;
  let hunkCount = 0;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.startsWith("@@")) {
      index += 1;
      continue;
    }
    hunkCount += 1;
    const match = line.match(hunkHeaderPattern);
    if (match === null || match.groups === undefined) {
      reasons.push(`Invalid unified diff hunk header: ${line}.`);
      index += 1;
      continue;
    }
    const expectedOld = Number.parseInt(match.groups.oldCount ?? "1", 10);
    const expectedNew = Number.parseInt(match.groups.newCount ?? "1", 10);
    let actualOld = 0;
    let actualNew = 0;
    index += 1;
    while (index < lines.length && !lines[index]!.startsWith("@@")) {
      const hunkLine = lines[index]!;
      if (hunkLine.startsWith("--- ") || hunkLine.startsWith("+++ ")) {
        reasons.push("Patch must not contain file path lines inside a hunk.");
        index += 1;
        continue;
      }
      if (hunkLine.startsWith(" ")) {
        actualOld += 1;
        actualNew += 1;
      } else if (hunkLine.startsWith("-")) {
        actualOld += 1;
      } else if (hunkLine.startsWith("+")) {
        actualNew += 1;
      }
      index += 1;
    }
    if (actualOld !== expectedOld || actualNew !== expectedNew) {
      reasons.push(
        `Hunk line counts do not match header ${line}: expected old/new ${expectedOld}/${expectedNew}, got ${actualOld}/${actualNew}.`
      );
    }
  }
  if (hunkCount === 0) {
    reasons.push("Patch must contain at least one unified diff hunk.");
  }
  return reasons;
}

function renderBadge(input: {
  readonly label: string;
  readonly message: string;
  readonly color: string;
}): string {
  const label = escapeSvg(input.label);
  const message = escapeSvg(input.message);
  const labelWidth = badgeTextWidth(input.label);
  const messageWidth = badgeTextWidth(input.message);
  const totalWidth = labelWidth + messageWidth;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${message}">`,
    `<title>${label}: ${message}</title>`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".1" stop-opacity=".1"/><stop offset=".9" stop-opacity=".3"/><stop offset="1" stop-opacity=".5"/></linearGradient>`,
    `<clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    `<rect width="${labelWidth}" height="20" fill="#555"/>`,
    `<rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${input.color}"/>`,
    `<rect width="${totalWidth}" height="20" fill="url(#s)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">`,
    `<text x="${Math.round(labelWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${label}</text>`,
    `<text x="${Math.round(labelWidth / 2)}" y="14">${label}</text>`,
    `<text x="${labelWidth + Math.round(messageWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${message}</text>`,
    `<text x="${labelWidth + Math.round(messageWidth / 2)}" y="14">${message}</text>`,
    `</g>`,
    `</svg>`
  ].join("");
}

function badgeTextWidth(value: string): number {
  return Math.max(44, value.length * 7 + 10);
}

function escapeSvg(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderShareCardPreviewText(
  fields: ShareCardAllowedFields,
  blockedFields: readonly string[]
): string {
  return [
    "Fixel Recall share-card preview",
    `Input reduction: ${fields.percentageInputReduction === null ? "not comparable" : `${fields.percentageInputReduction}%`}`,
    `Estimated total saving: $${fields.estimatedTotalSaving.toFixed(2)}`,
    `Tests passed: ${fields.testsPassed}`,
    `Protected values imaged: ${fields.protectedValuesImagedCount}`,
    `Model family: ${fields.modelFamily}`,
    `Verification ID: ${fields.verificationId}`,
    `Evidence origin: ${fields.evidenceOriginLabel}`,
    `Compatibility verdict: ${fields.compatibilityVerdict}`,
    `Monthly projection: ${fields.monthlyProjectionRange}`,
    `Benchmark profile: ${fields.benchmarkProfile}`,
    `Test status: ${fields.testStatus}`,
    `Watermark: ${fields.syntheticWatermark}`,
    `Benchmark date: ${fields.benchmarkDate}`,
    `Blocked forbidden fields: ${blockedFields.length}`
  ].join("\n");
}

function createShareCardSvg(fields: ShareCardAllowedFields): string {
  const lines = [
    "Fixel Recall",
    fields.syntheticWatermark,
    `Input reduction: ${fields.percentageInputReduction === null ? "not comparable" : `${fields.percentageInputReduction}%`}`,
    `Monthly projection: ${fields.monthlyProjectionRange}`,
    `Verdict: ${fields.compatibilityVerdict}`,
    `Tests: ${fields.testStatus} (${fields.testsPassed} passed)`,
    `Profile: ${fields.benchmarkProfile}`,
    `Verification: ${fields.verificationId}`
  ];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" role="img" aria-label="Fixel Recall share card ${escapeSvg(fields.syntheticWatermark)}">`,
    `<rect width="640" height="360" fill="#f7f8fa"/>`,
    `<rect x="24" y="24" width="592" height="312" rx="8" fill="#ffffff" stroke="#d8dde5"/>`,
    ...lines.map(
      (line, index) =>
        `<text x="48" y="${64 + index * 34}" fill="${index === 1 ? "#9c2f2f" : "#16181d"}" font-family="Inter,Arial,sans-serif" font-size="${index === 0 ? 24 : 18}" font-weight="${index <= 1 ? 700 : 400}">${escapeSvg(line)}</text>`
    ),
    `</svg>`
  ].join("");
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

function evidenceOriginField(value: unknown): ShareCardAllowedFields["evidenceOriginLabel"] {
  return value === "MEASURED" || value === "MIXED" ? value : "SYNTHETIC";
}

function compatibilityVerdictField(value: unknown): ShareCardAllowedFields["compatibilityVerdict"] {
  return value === "RECOMMENDED" ||
    value === "RECOMMENDED_WITH_RESTRICTIONS" ||
    value === "AUDIT_ONLY" ||
    value === "NOT_WORTH_USING" ||
    value === "UNSUPPORTED" ||
    value === "RETEST_REQUIRED"
    ? value
    : "AUDIT_ONLY";
}

function testStatusField(value: unknown): ShareCardAllowedFields["testStatus"] {
  return value === "PASSING" || value === "FAILING" || value === "INCOMPLETE"
    ? value
    : "INCOMPLETE";
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
      treatment: variant === "uncompressed_control" ? "none" : "fixel_recall_cache"
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
