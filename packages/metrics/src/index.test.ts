import { describe, expect, it } from "vitest";

import {
  createProviderCostReport,
  createSafeMetric,
  recommendContextDiet,
  type ProviderCostRun,
  type RecommendationInput
} from "./index.js";

describe("createSafeMetric", () => {
  it("records only a metric name and numeric value", () => {
    expect(createSafeMetric("block_count", 2)).toEqual({ name: "block_count", value: 2 });
  });
});

describe("recommendContextDiet", () => {
  const base: RecommendationInput = {
    accuracyRiskLevel: "low",
    addedLatencyMs: 100,
    cacheIntensity: "low",
    costAssumptions: {
      imageCostPerRender: 0.01,
      retrievalCostPerUse: 0.001,
      textCostPerThousandTokens: 0.02
    },
    eligibleContextTokens: 20_000,
    evidenceAvailable: true,
    modelProfileStatus: "enabled",
    projectedUsage: {
      averageEligibleTokensPerRequest: 18_000,
      requestsPerWeek: 120
    },
    retrievalFrequency: 0.2,
    userRiskTolerance: "balanced"
  };

  it("recommends strong positive value", () => {
    const result = recommendContextDiet(base);

    expect(result).toMatchObject({
      dataOrigin: "synthetic",
      recommendedOperatingMode: "balanced",
      verdict: "STRONG_POSITIVE_VALUE"
    });
    expect(result.netProjection.weekly).toBeGreaterThan(0);
  });

  it("handles small positive but high risk with restrictions", () => {
    const result = recommendContextDiet({
      ...base,
      accuracyRiskLevel: "high",
      eligibleContextTokens: 5_000,
      projectedUsage: { averageEligibleTokensPerRequest: 5_000, requestsPerWeek: 25 }
    });

    expect(result.verdict).toBe("WORTH_TRIAL_WITH_RESTRICTIONS");
    expect(result.recommendedOperatingMode).toBe("safe");
  });

  it("rejects highly cached workload with low marginal value", () => {
    const result = recommendContextDiet({
      ...base,
      cacheIntensity: "high",
      projectedUsage: { averageEligibleTokensPerRequest: 2_000, requestsPerWeek: 20 }
    });

    expect(result.verdict).toBe("NOT_WORTH_ENABLING");
    expect(result.message).toBe("Context Diet is not worth enabling for this simulated setup.");
  });

  it("keeps code-heavy workload restricted and does not weaken protected-content rules", () => {
    const result = recommendContextDiet({
      ...base,
      accuracyRiskLevel: "high",
      codeHeavy: true,
      projectedUsage: { averageEligibleTokensPerRequest: 20_000, requestsPerWeek: 200 }
    });

    expect(result.verdict).toBe("WORTH_TRIAL_WITH_RESTRICTIONS");
    expect(result.topReasons.join("\n")).toContain("Protected values must remain native");
  });

  it("rejects negative net saving", () => {
    const result = recommendContextDiet({
      ...base,
      costAssumptions: {
        imageCostPerRender: 1,
        retrievalCostPerUse: 0.5,
        textCostPerThousandTokens: 0.001
      }
    });

    expect(result.verdict).toBe("NOT_WORTH_ENABLING");
    expect(result.netProjection.weekly).toBeLessThan(0);
  });

  it("requires missing evidence to be collected", () => {
    const result = recommendContextDiet({ ...base, evidenceAvailable: false });

    expect(result.verdict).toBe("MISSING_EVIDENCE");
    expect(result.recommendedOperatingMode).toBe("safe");
  });

  it("rejects unsupported model", () => {
    const result = recommendContextDiet({ ...base, modelProfileStatus: "unsupported" });

    expect(result.verdict).toBe("UNSUPPORTED");
    expect(result.recommendedOperatingMode).toBe("bypass");
  });

  it("requires re-test for expired profile", () => {
    const result = recommendContextDiet({ ...base, modelProfileStatus: "expired" });

    expect(result.verdict).toBe("MISSING_EVIDENCE");
    expect(result.retestCondition).toContain("Re-test");
  });
});

describe("createProviderCostReport", () => {
  const baseline: ProviderCostRun = {
    addedLatencyMs: 0,
    cacheTreatment: "none",
    modelVersion: "synthetic-model-2026-07",
    price: price("2026-07-01"),
    provider: "openai",
    status: "success",
    tokens: {
      availability: "available",
      cachedInputTokens: 0,
      imageTokens: 0,
      measuredInputTokens: 100_000,
      outputTokens: 4_000
    }
  };
  const candidate: ProviderCostRun = {
    ...baseline,
    addedLatencyMs: 250,
    cacheTreatment: "context_diet_cache",
    tokens: {
      availability: "available",
      cachedInputTokens: 20_000,
      imageTokens: 2_000,
      measuredInputTokens: 30_000,
      outputTokens: 4_000
    }
  };

  it("reports profitable comparison", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      baseline,
      candidate
    });

    expect(report.savingsAmount).toBeGreaterThan(0);
    expect(report.savingsPercentage).toBeGreaterThan(0);
    expect(report.negativeResult).toBe(false);
    expect(report.confidence).toBe("high");
  });

  it("reports unprofitable comparison honestly", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      baseline,
      candidate: {
        ...candidate,
        tokens: { ...candidate.tokens, imageTokens: 300_000 }
      }
    });

    expect(report.savingsAmount).toBeLessThan(0);
    expect(report.negativeResult).toBe(true);
    expect(report.reasons.join("\n")).toContain("costs more");
  });

  it("shows highly cached workload treatment", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      baseline: { ...baseline, cacheTreatment: "provider_cache" },
      candidate
    });

    expect(report.cacheTreatment).toEqual({
      baseline: "provider_cache",
      candidate: "context_diet_cache",
      changed: true
    });
  });

  it("omits savings percentage when baseline is missing", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      candidate
    });

    expect(report.baselineTotalEstimatedCost).toBeNull();
    expect(report.savingsPercentage).toBeNull();
    expect(report.reasons.join("\n")).toContain("No comparable baseline");
  });

  it("invalidates changed model comparison unless normalised", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      baseline,
      candidate: { ...candidate, modelVersion: "synthetic-model-2026-08" }
    });

    expect(report.comparisonValid).toBe(false);
    expect(report.savingsPercentage).toBeNull();
    expect(report.reasons.join("\n")).toContain("Different model versions");
  });

  it("labels stale changed price", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      baseline,
      candidate: { ...candidate, price: price("2026-01-01") }
    });

    expect(report.priceStale).toBe(true);
    expect(report.reasons.join("\n")).toContain("Price data is stale");
  });

  it("does not use failed run as successful comparison", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      baseline,
      candidate: { ...candidate, status: "failed" }
    });

    expect(report.totalEstimatedCost).toBeNull();
    expect(report.savingsPercentage).toBeNull();
    expect(report.confidence).toBe("unavailable");
  });

  it("reports unavailable token counts", () => {
    const report = createProviderCostReport({
      asOfDate: "2026-07-16",
      baseline,
      candidate: { ...candidate, tokens: { availability: "unavailable" } }
    });

    expect(report.totalEstimatedCost).toBeNull();
    expect(report.availability).toBe("unavailable");
    expect(report.reasons.join("\n")).toContain("Token counts are unavailable");
  });
});

function price(date: string) {
  return {
    cachedInputPerMillion: 0.2,
    date,
    imagePerMillion: 5,
    inputPerMillion: 2,
    outputPerMillion: 8,
    source: "synthetic price sheet",
    staleAfterDays: 30
  };
}
