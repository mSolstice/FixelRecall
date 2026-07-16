import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  benchmarkReadiness,
  createShareCardPreview,
  createPersonalBenchmarkReport,
  createSyntheticBenchmarkReport,
  exportShareCard,
  renderBenchmarkMarkdown,
  shareCardForbiddenFields,
  validateComparableRuns,
  writeBenchmarkReport,
  type BenchmarkRun,
  type BenchmarkScenario
} from "./index.js";

describe("benchmarkReadiness", () => {
  it("requires a comparable baseline", () => {
    expect(benchmarkReadiness()).toEqual({ comparableBaselineRequired: true });
  });
});

describe("personal benchmark harness", () => {
  const scenario: BenchmarkScenario = {
    modelProfile: "synthetic-safe-profile-v1",
    provider: "synthetic",
    repositoryId: "synthetic-repo-fixture",
    repositoryOrigin: "synthetic",
    taskId: "safe-task-fixture",
    taskName: "Synthetic safe helper edit"
  };
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
});

describe("optional share-card generator", () => {
  const shareInput = {
    benchmarkDate: "2026-07-17",
    branch: "main",
    estimatedTotalSaving: 12.5,
    modelFamily: "synthetic-safe",
    percentageInputReduction: 42,
    protectedValuesImagedCount: 0,
    repositoryName: "private-repo",
    sessionId: "session_secret",
    testsPassed: 24
  };

  it("shows a preview using only allowlisted fields", () => {
    const preview = createShareCardPreview(shareInput);

    expect(preview.allowedFields).toEqual({
      benchmarkDate: "2026-07-17",
      estimatedTotalSaving: 12.5,
      modelFamily: "synthetic-safe",
      percentageInputReduction: 42,
      protectedValuesImagedCount: 0,
      testsPassed: 24
    });
    expect(preview.previewText).toContain("Context Diet share-card preview");
    expect(preview.previewText).toContain("Input reduction: 42%");
    expect(preview.previewText).not.toContain("private-repo");
    expect(preview.previewText).not.toContain("session_secret");
    expect(preview.shareNothingAutomatically).toBe(true);
  });

  it("requires explicit confirmation before export", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "context-diet-share-card-"));
    const result = await exportShareCard(shareInput, { confirm: false, outputDirectory });

    expect(result.exported).toBe(false);
    expect(result.pngPath).toBeNull();
    expect(result.proofJsonPath).toBeNull();
  });

  it("exports PNG and JSON proof metadata after confirmation", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "context-diet-share-card-"));
    const result = await exportShareCard(shareInput, { confirm: true, outputDirectory });

    expect(result.exported).toBe(true);
    expect(result.pngPath).toContain("context-diet-share-card.png");
    expect(result.proofJsonPath).toContain("context-diet-share-card.proof.json");
    const png = await readFile(result.pngPath as string);
    const proof = JSON.parse(await readFile(result.proofJsonPath as string, "utf8")) as {
      readonly fields: Record<string, unknown>;
      readonly allowlist: readonly string[];
      readonly blockedFields: readonly string[];
    };

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(proof.fields).toEqual(result.preview.allowedFields);
    expect(proof.allowlist).toEqual(result.preview.allowlist);
    expect(JSON.stringify(proof)).not.toContain("private-repo");
    expect(JSON.stringify(proof)).not.toContain("session_secret");
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
