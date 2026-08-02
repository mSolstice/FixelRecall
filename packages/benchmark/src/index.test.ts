import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  benchmarkReadiness,
  createSyntheticBenchmarkArtifacts,
  createSyntheticBenchmarkBadges,
  createSyntheticBenchmarkEvidence,
  createShareCardPreview,
  createPersonalBenchmarkReport,
  createSyntheticBenchmarkReport,
  exportShareCard,
  renderJsonReplacementBenchmarkCanaryInstructions,
  renderStrictBenchmarkCanaryInstructions,
  renderBenchmarkMarkdown,
  renderSyntheticBenchmarkReadmeInstructions,
  shareCardForbiddenFields,
  syntheticBenchmarkEvidenceAllowedFields,
  syntheticBenchmarkForbiddenFields,
  validateJsonReplacementBenchmarkOutput,
  validateStrictUnifiedDiffPatch,
  validateComparableRuns,
  writeBenchmarkReport,
  type BenchmarkRun,
  type BenchmarkScenario
} from "./index.js";

const scenario: BenchmarkScenario = {
  modelProfile: "synthetic-safe-profile-v1",
  provider: "synthetic",
  repositoryId: "synthetic-repo-fixture",
  repositoryOrigin: "synthetic",
  taskId: "safe-task-fixture",
  taskName: "Synthetic safe helper edit"
};

describe("benchmarkReadiness", () => {
  it("requires a comparable baseline", () => {
    expect(benchmarkReadiness()).toEqual({ comparableBaselineRequired: true });
  });
});

describe("personal benchmark harness", () => {
  const runs: readonly BenchmarkRun[] = [
    run("uncompressed_control"),
    run("safe_compressed"),
    run("safe_compressed_exact_retrieval", { retrievalCalls: 2 })
  ];

  it("creates a comparable synthetic report for the three supported modes", () => {
    const report = createPersonalBenchmarkReport({
      generatedAt: "2026-07-17T00:00:00.000Z",
      runs,
      scenario
    });

    expect(report).toMatchObject({
      comparison: { comparable: true },
      dataOrigin: "synthetic",
      scenario: { repositoryOrigin: "synthetic" }
    });
    expect(report.runs.map((item) => item.variant)).toEqual([
      "uncompressed_control",
      "safe_compressed",
      "safe_compressed_exact_retrieval"
    ]);
  });

  it("renders local Markdown and JSON reports", async () => {
    const report = createSyntheticBenchmarkReport(7);
    const outputDirectory = await mkdtemp(join(tmpdir(), "context-diet-benchmark-"));
    const files = await writeBenchmarkReport(report, outputDirectory);
    const markdown = await readFile(files.markdownPath, "utf8");
    const json = JSON.parse(await readFile(files.jsonPath, "utf8")) as unknown;

    expect(markdown).toContain("SYNTHETIC TEST DATA");
    expect(markdown).toContain("uncompressed_control");
    expect(markdown).toContain("safe_compressed_exact_retrieval");
    expect(json).toMatchObject({ dataOrigin: "synthetic" });
  });

  it("does not claim quality from text similarity alone", () => {
    const report = createPersonalBenchmarkReport({
      generatedAt: "2026-07-17T00:00:00.000Z",
      runs,
      scenario
    });
    const markdown = renderBenchmarkMarkdown(report);

    expect(report.comparison.summary).toContain("not text similarity alone");
    expect(markdown).toContain("Output agreement: passed via task_tests");
  });

  it("rejects incomparable runs with missing variants", () => {
    const reasons = validateComparableRuns(scenario, runs.slice(0, 2));

    expect(reasons.join("\n")).toContain("Missing required run variant");
  });

  it("rejects incomparable runs with changed provider, model, task or repository", () => {
    const reasons = validateComparableRuns(scenario, [
      runs[0] as BenchmarkRun,
      { ...(runs[1] as BenchmarkRun), modelProfile: "other-profile", provider: "openai" },
      {
        ...(runs[2] as BenchmarkRun),
        repositoryId: "other-repo",
        taskId: "other-task"
      }
    ]);

    expect(reasons.join("\n")).toContain("provider openai");
    expect(reasons.join("\n")).toContain("model profile other-profile");
    expect(reasons.join("\n")).toContain("repository other-repo");
    expect(reasons.join("\n")).toContain("task other-task");
  });

  it("rejects failed, unavailable, unsafe or unverified runs", () => {
    const reasons = validateComparableRuns(scenario, [
      runs[0] as BenchmarkRun,
      {
        ...(runs[1] as BenchmarkRun),
        outputAgreement: {
          agreed: false,
          details: "changed behavior",
          method: "deterministic_checks"
        },
        protectedValuesImagedCount: 1,
        status: "failed",
        usage: { ...(runs[1] as BenchmarkRun).usage, tokenCountsAvailable: false }
      },
      {
        ...(runs[2] as BenchmarkRun),
        outputAgreement: { agreed: true, details: "looked okay", method: "manual_review" },
        testResults: [{ command: "pnpm test", outputSummary: "failed", passed: false }]
      }
    ]);

    expect(reasons.join("\n")).toContain("failed");
    expect(reasons.join("\n")).toContain("unavailable token counts");
    expect(reasons.join("\n")).toContain("imaged protected values");
    expect(reasons.join("\n")).toContain("did not meet deterministic output agreement");
    expect(reasons.join("\n")).toContain("manual review");
    expect(reasons.join("\n")).toContain("passing task tests");
  });

  it("renders strict real-provider benchmark instructions", () => {
    const instructions = renderStrictBenchmarkCanaryInstructions();

    expect(instructions).toContain("No markdown fences");
    expect(instructions).toContain("No explanation");
    expect(instructions).toContain("src/list-utils.js");
    expect(instructions).toContain("patch -p0 -i candidate.patch");
    expect(instructions).toContain("node --test");
  });

  it("renders JSON replacement real-provider benchmark instructions", () => {
    const instructions = renderJsonReplacementBenchmarkCanaryInstructions();

    expect(instructions).toContain("Return JSON only");
    expect(instructions).toContain("No markdown fences");
    expect(instructions).toContain('"file":"src/list-utils.js"');
    expect(instructions).toContain("complete replacement file content");
    expect(instructions).toContain("node --test");
  });

  it("accepts only strict applyable unified diff candidates", () => {
    const validPatch = [
      "--- src/list-utils.js",
      "+++ src/list-utils.js",
      "@@ -1,3 +1,6 @@",
      " export function normalizeShoppingList(items) {",
      "-  return items;",
      "+  return [...new Set(items",
      "+    .map((item) => item.trim().toLowerCase())",
      "+    .filter((item) => item.length > 0)",
      "+  )].sort();",
      " }",
      ""
    ].join("\n");

    expect(validateStrictUnifiedDiffPatch(validPatch)).toEqual({ reasons: [], valid: true });
  });

  it("rejects fenced or explanatory benchmark diffs", () => {
    const result = validateStrictUnifiedDiffPatch(
      [
        "Here is the patch:",
        "```diff",
        "--- src/list-utils.js",
        "+++ src/list-utils.js",
        "@@ -1,3 +1,3 @@",
        " export function normalizeShoppingList(items) {",
        "-  return items;",
        "+  return [];",
        " }",
        "```",
        ""
      ].join("\n")
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.join("\n")).toContain("markdown fences");
    expect(result.reasons.join("\n")).toContain("Patch must start");
    expect(result.reasons.join("\n")).toContain("non-diff text");
  });

  it("rejects malformed hunk counts and non-p0 paths", () => {
    const result = validateStrictUnifiedDiffPatch(
      [
        "--- a/src/list-utils.js",
        "+++ b/src/list-utils.js",
        "@@ -1,3 +1,8 @@",
        " export function normalizeShoppingList(items) {",
        "-  return items;",
        "+  return [];",
        " }",
        ""
      ].join("\n")
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.join("\n")).toContain("src/list-utils.js");
    expect(result.reasons.join("\n")).toContain("a/ or b/");
    expect(result.reasons.join("\n")).toContain("Hunk line counts do not match");
  });

  it("accepts strict JSON replacement candidates", () => {
    const output = JSON.stringify({
      file: "src/list-utils.js",
      replacement: [
        "export function normalizeShoppingList(items) {",
        "  return [...new Set(items",
        "    .map((item) => item.trim().toLowerCase())",
        "    .filter((item) => item.length > 0)",
        "  )].sort();",
        "}",
        ""
      ].join("\n")
    });

    expect(validateJsonReplacementBenchmarkOutput(output)).toEqual({
      reasons: [],
      replacement: {
        content: [
          "export function normalizeShoppingList(items) {",
          "  return [...new Set(items",
          "    .map((item) => item.trim().toLowerCase())",
          "    .filter((item) => item.length > 0)",
          "  )].sort();",
          "}",
          ""
        ].join("\n"),
        file: "src/list-utils.js"
      },
      valid: true
    });
  });

  it("accepts a single fenced JSON replacement object", () => {
    const result = validateJsonReplacementBenchmarkOutput(
      [
        "```json",
        JSON.stringify({
          file: "src/list-utils.js",
          replacement: [
            "export function normalizeShoppingList(items) {",
            "  return [...new Set(items",
            "    .map((item) => item.trim().toLowerCase())",
            "    .filter((item) => item.length > 0)",
            "  )].sort();",
            "}",
            ""
          ].join("\n")
        }),
        "```"
      ].join("\n")
    );

    expect(result).toMatchObject({
      reasons: [],
      replacement: { file: "src/list-utils.js" },
      valid: true
    });
  });

  it("rejects multiple fenced JSON blocks", () => {
    const block = [
      "```json",
      JSON.stringify({
        file: "src/list-utils.js",
        replacement: "export function normalizeShoppingList(items) { return items; }"
      }),
      "```"
    ].join("\n");
    const result = validateJsonReplacementBenchmarkOutput(`${block}\n${block}`);

    expect(result.valid).toBe(false);
    expect(result.reasons.join("\n")).toContain("multiple fenced JSON blocks");
    expect(result.replacement).toBeNull();
  });

  it("rejects prose outside a fenced JSON replacement object", () => {
    const result = validateJsonReplacementBenchmarkOutput(
      [
        "Here is the JSON:",
        "```json",
        JSON.stringify({
          file: "src/list-utils.js",
          replacement: "export function normalizeShoppingList(items) { return items; }"
        }),
        "```"
      ].join("\n")
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.join("\n")).toContain("prose outside the fenced JSON block");
    expect(result.replacement).toBeNull();
  });

  it("rejects non-json fenced replacement output", () => {
    const result = validateJsonReplacementBenchmarkOutput(
      [
        "```js",
        JSON.stringify({
          file: "src/list-utils.js",
          replacement: "export function normalizeShoppingList(items) { return items; }"
        }),
        "```"
      ].join("\n")
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.join("\n")).toContain("labelled json");
    expect(result.replacement).toBeNull();
  });

  it("rejects wrong JSON file, extra fields, missing export or imports", () => {
    const result = validateJsonReplacementBenchmarkOutput(
      JSON.stringify({
        extra: "not allowed",
        file: "src/list-utils.test.js",
        replacement: [
          'import { uniq } from "not-allowed";',
          "export function otherName(items) {",
          "  return uniq(items);",
          "}"
        ].join("\n")
      })
    );

    expect(result.valid).toBe(false);
    expect(result.reasons.join("\n")).toContain("exactly file and replacement fields");
    expect(result.reasons.join("\n")).toContain("file field must be exactly src/list-utils.js");
    expect(result.reasons.join("\n")).toContain("normalizeShoppingList");
    expect(result.reasons.join("\n")).toContain("must not import dependencies");
    expect(result.replacement).toBeNull();
  });

  it("rejects invalid JSON replacement output", () => {
    const result = validateJsonReplacementBenchmarkOutput("{not-json");

    expect(result.valid).toBe(false);
    expect(result.reasons.join("\n")).toContain("valid JSON");
    expect(result.replacement).toBeNull();
  });
});

describe("optional share-card generator", () => {
  const shareInput = {
    benchmarkDate: "2026-07-17",
    benchmarkProfile: "synthetic-profile-safe-v1",
    branch: "main",
    code: "const secret = 'do-not-export';",
    compatibilityVerdict: "RECOMMENDED_WITH_RESTRICTIONS",
    credentials: "credential-do-not-export",
    estimatedTotalSaving: 12.5,
    evidenceOriginLabel: "SYNTHETIC",
    filePath: "/Users/example/private-repo/src/secret.ts",
    modelFamily: "synthetic-safe",
    monthlyProjectionRange: "$8.00-$12.00 SYNTHETIC",
    percentageInputReduction: 42,
    prompt: "private prompt should not appear",
    protectedValuesImagedCount: 0,
    rawAuditEvents: [{ body: "raw audit event should not appear" }],
    repositoryName: "private-repo",
    sessionId: "session_secret",
    testStatus: "PASSING",
    testsPassed: 24,
    userIdentity: "Ada Private",
    verificationId: "verify_synthetic_001"
  };

  it("shows a preview using only allowlisted fields", () => {
    const preview = createShareCardPreview(shareInput);

    expect(preview.allowedFields).toEqual({
      benchmarkDate: "2026-07-17",
      benchmarkProfile: "synthetic-profile-safe-v1",
      compatibilityVerdict: "RECOMMENDED_WITH_RESTRICTIONS",
      estimatedTotalSaving: 12.5,
      evidenceOriginLabel: "SYNTHETIC",
      modelFamily: "synthetic-safe",
      monthlyProjectionRange: "$8.00-$12.00 SYNTHETIC",
      percentageInputReduction: 42,
      protectedValuesImagedCount: 0,
      syntheticWatermark: "SYNTHETIC RESULTS",
      testStatus: "PASSING",
      testsPassed: 24,
      verificationId: "verify_synthetic_001"
    });
    expect(preview.previewText).toContain("Context Diet share-card preview");
    expect(preview.previewText).toContain("Input reduction: 42%");
    expect(preview.previewText).toContain("Verification ID: verify_synthetic_001");
    expect(preview.previewText).toContain("Evidence origin: SYNTHETIC");
    expect(preview.previewText).toContain("Compatibility verdict: RECOMMENDED_WITH_RESTRICTIONS");
    expect(preview.previewText).toContain("Monthly projection: $8.00-$12.00 SYNTHETIC");
    expect(preview.previewText).toContain("Benchmark profile: synthetic-profile-safe-v1");
    expect(preview.previewText).toContain("Test status: PASSING");
    expect(preview.previewText).toContain("Watermark: SYNTHETIC RESULTS");
    expect(preview.previewText).not.toContain("private-repo");
    expect(preview.previewText).not.toContain("session_secret");
    expect(preview.previewText).not.toContain("private prompt");
    expect(preview.previewText).not.toContain("do-not-export");
    expect(preview.shareNothingAutomatically).toBe(true);
  });

  it("requires explicit confirmation before export", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "context-diet-share-card-"));
    const result = await exportShareCard(shareInput, { confirm: false, outputDirectory });

    expect(result.exported).toBe(false);
    expect(result.pngPath).toBeNull();
    expect(result.svgPath).toBeNull();
    expect(result.proofJsonPath).toBeNull();
  });

  it("exports PNG, SVG and JSON proof metadata after confirmation", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "context-diet-share-card-"));
    const result = await exportShareCard(shareInput, { confirm: true, outputDirectory });

    expect(result.exported).toBe(true);
    expect(result.pngPath).toContain("context-diet-share-card.png");
    expect(result.svgPath).toContain("context-diet-share-card.svg");
    expect(result.proofJsonPath).toContain("context-diet-share-card.proof.json");
    const png = await readFile(result.pngPath as string);
    const svg = await readFile(result.svgPath as string, "utf8");
    const proof = JSON.parse(await readFile(result.proofJsonPath as string, "utf8")) as {
      readonly artifactKind: string;
      readonly fields: Record<string, unknown>;
      readonly allowlist: readonly string[];
      readonly blockedFieldCount: number;
      readonly generatedFiles: readonly string[];
      readonly noUploadOrShareAction: boolean;
    };

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("SYNTHETIC RESULTS");
    expect(svg).toContain("verify_synthetic_001");
    expect(proof.artifactKind).toBe("context_diet_share_card_proof");
    expect(proof.fields).toEqual(result.preview.allowedFields);
    expect(proof.allowlist).toEqual(result.preview.allowlist);
    expect(proof.blockedFieldCount).toBe(result.preview.blockedFields.length);
    expect(proof.generatedFiles).toEqual(["png", "svg", "json_proof"]);
    expect(proof.noUploadOrShareAction).toBe(true);
    for (const artifact of [svg, JSON.stringify(proof)]) {
      expect(artifact).not.toContain("private-repo");
      expect(artifact).not.toContain("session_secret");
      expect(artifact).not.toContain("private prompt");
      expect(artifact).not.toContain("do-not-export");
      expect(artifact).not.toContain("Ada Private");
      expect(artifact).not.toContain("credential-do-not-export");
      expect(artifact).not.toContain("raw audit event");
      expect(artifact).not.toContain("/Users/example");
      expect(artifact).not.toContain("main");
      expect(artifact).not.toContain("rawAuditEvents");
      expect(artifact).not.toContain("branch");
    }
  });

  it.each(shareCardForbiddenFields)("blocks forbidden field %s", (field) => {
    const preview = createShareCardPreview({
      ...shareInput,
      [field]: `forbidden-${field}`,
      nested: { [field]: `nested-forbidden-${field}` }
    });

    expect(preview.blockedFields).toEqual(expect.arrayContaining([field, `nested.${field}`]));
    expect(preview.previewText).not.toContain(`forbidden-${field}`);
    expect(JSON.stringify(preview.allowedFields)).not.toContain(`forbidden-${field}`);
  });
});

describe("GitHub Actions synthetic benchmark artifacts", () => {
  it("creates stable allowlisted evidence for a fixed seed", () => {
    const first = createSyntheticBenchmarkArtifacts(7);
    const second = createSyntheticBenchmarkArtifacts(7);

    expect(first.evidence).toEqual(second.evidence);
    expect(Object.keys(first.evidence).sort()).toEqual(
      [...syntheticBenchmarkEvidenceAllowedFields].sort()
    );
    expect(first.evidence).toMatchObject({
      artifactKind: "context_diet_synthetic_benchmark_evidence",
      dataOrigin: "synthetic",
      seed: 7,
      syntheticNotice: "SYNTHETIC TEST DATA"
    });
  });

  it("labels numeric synthetic badge results as SYNTHETIC", () => {
    const artifacts = createSyntheticBenchmarkArtifacts(1);

    expect(artifacts.badges.synthetic_input_reduction).toContain("SYNTHETIC");
    expect(artifacts.badges.protected_values_imaged).toContain("SYNTHETIC");
    expect(artifacts.markdownSummary).toContain("SYNTHETIC TEST DATA");
    expect(artifacts.markdownSummary).toContain("SYNTHETIC 50%");
    expect(artifacts.pullRequestCommentText).toContain("saved as an artifact only");
  });

  it("generates all static SVG badge variants without external badge services", () => {
    const badges = createSyntheticBenchmarkBadges(createSyntheticBenchmarkArtifacts(1).evidence);

    expect(Object.keys(badges).sort()).toEqual([
      "benchmark_passing",
      "compatibility_status",
      "protected_values_imaged",
      "synthetic_input_reduction"
    ]);
    for (const svg of Object.values(badges)) {
      expect(svg).toContain("<svg");
      expect(svg).not.toContain("shields.io");
      expect(svg).not.toContain("badge");
      expect(svg).not.toContain("https://");
      expect(svg).not.toContain("<script");
    }
  });

  it("excludes forbidden private fields from evidence, summaries and badges", () => {
    const artifacts = createSyntheticBenchmarkArtifacts(3);
    const serialised = JSON.stringify(artifacts);

    for (const forbidden of [
      "private-repo",
      "session_secret",
      "SECRET_VALUE",
      "api_key=",
      "Authorization",
      "Bearer "
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
    for (const forbiddenField of syntheticBenchmarkForbiddenFields) {
      expect(Object.keys(artifacts.evidence)).not.toContain(forbiddenField);
    }
    expect(artifacts.evidence.privacyFilter).toBe("forbidden_private_fields_excluded");
    expect(artifacts.evidence.forbiddenPrivateFieldCount).toBe(
      syntheticBenchmarkForbiddenFields.length
    );
    for (const forbiddenField of syntheticBenchmarkForbiddenFields) {
      expect(serialised).not.toContain(`"${forbiddenField}"`);
    }
  });

  it("keeps incompatible reports blocked instead of claiming passing evidence", () => {
    const report = createPersonalBenchmarkReport({
      generatedAt: "2026-07-17T00:00:00.000Z",
      runs: [run("uncompressed_control"), run("safe_compressed")],
      scenario
    });
    const evidence = createSyntheticBenchmarkEvidence(report, 11);

    expect(evidence.benchmarkPassing).toBe(false);
    expect(evidence.compatibilityStatus).toBe("BLOCKED");
    expect(createSyntheticBenchmarkBadges(evidence).benchmark_passing).toContain(
      "benchmark blocked"
    );
  });

  it("renders README embed instructions for local artifact badges", () => {
    const instructions = renderSyntheticBenchmarkReadmeInstructions();

    expect(instructions).toContain("not published to an external badge service");
    expect(instructions).toContain("context-diet-benchmark.svg");
    expect(instructions).toContain("SYNTHETIC");
  });
});

function run(
  variant: BenchmarkRun["variant"],
  overrides: Partial<BenchmarkRun> = {}
): BenchmarkRun {
  return {
    cacheUsage: {
      cacheHits: variant === "uncompressed_control" ? 0 : 1,
      cacheMisses: variant === "uncompressed_control" ? 0 : 1,
      treatment: variant === "uncompressed_control" ? "none" : "context_diet_cache"
    },
    errors: [],
    filesChanged: ["src/example.ts", "src/example.test.ts"],
    id: `fixture-${variant}`,
    latencyMs: variant === "uncompressed_control" ? 1000 : 1200,
    modelProfile: "synthetic-safe-profile-v1",
    outputAgreement: {
      agreed: true,
      details: "Tests and deterministic checks match.",
      method: "task_tests"
    },
    protectedValuesImagedCount: 0,
    provider: "synthetic",
    repositoryId: "synthetic-repo-fixture",
    repositoryOrigin: "synthetic",
    retrievalCalls: variant === "safe_compressed_exact_retrieval" ? 1 : 0,
    status: "success",
    taskId: "safe-task-fixture",
    testResults: [{ command: "pnpm test -- example", outputSummary: "passed", passed: true }],
    toolActions: ["read_file", "apply_patch", "run_tests"],
    usage: {
      cachedInputTokens: variant === "uncompressed_control" ? 0 : 500,
      imageTokens: variant === "uncompressed_control" ? 0 : 100,
      inputTokens: variant === "uncompressed_control" ? 10_000 : 6_000,
      outputTokens: 1_000,
      tokenCountsAvailable: true
    },
    variant,
    ...overrides
  };
}
