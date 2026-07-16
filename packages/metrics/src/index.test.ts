import { describe, expect, it } from "vitest";

import { createSafeMetric, recommendContextDiet, type RecommendationInput } from "./index.js";

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
