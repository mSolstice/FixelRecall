export interface SafeMetric {
  readonly name: string;
  readonly value: number;
}

export type RecommendationVerdict =
  | "STRONG_POSITIVE_VALUE"
  | "WORTH_TRIAL_WITH_RESTRICTIONS"
  | "NOT_WORTH_ENABLING"
  | "MISSING_EVIDENCE"
  | "UNSUPPORTED";

export type RecommendationOperatingMode = "safe" | "balanced" | "max" | "bypass";
export type RecommendationRiskLevel = "low" | "medium" | "high" | "critical";
export type RecommendationCacheIntensity = "low" | "medium" | "high";
export type RecommendationRiskTolerance = "conservative" | "balanced" | "aggressive";
export type RecommendationProfileStatus = "enabled" | "expired" | "unsupported";

export interface RecommendationCostAssumptions {
  readonly textCostPerThousandTokens: number;
  readonly imageCostPerRender: number;
  readonly retrievalCostPerUse: number;
  readonly localComputeCostPerRequest?: number;
}

export interface ProjectedUsage {
  readonly requestsPerWeek: number;
  readonly averageEligibleTokensPerRequest: number;
}

export interface RecommendationInput {
  readonly eligibleContextTokens: number;
  readonly cacheIntensity: RecommendationCacheIntensity;
  readonly costAssumptions: RecommendationCostAssumptions;
  readonly addedLatencyMs: number;
  readonly retrievalFrequency: number;
  readonly accuracyRiskLevel: RecommendationRiskLevel;
  readonly userRiskTolerance: RecommendationRiskTolerance;
  readonly projectedUsage: ProjectedUsage;
  readonly optionalLocalComputeCost?: number;
  readonly modelProfileStatus?: RecommendationProfileStatus;
  readonly evidenceAvailable?: boolean;
  readonly codeHeavy?: boolean;
}

export interface RecommendationProjection {
  readonly weekly: number;
  readonly monthly: number;
  readonly annual: number;
}

export interface ContextDietRecommendation {
  readonly dataOrigin: "synthetic";
  readonly verdict: RecommendationVerdict;
  readonly message: string;
  readonly netProjection: RecommendationProjection;
  readonly breakEvenUsage: number | null;
  readonly topReasons: readonly string[];
  readonly recommendedOperatingMode: RecommendationOperatingMode;
  readonly retestCondition: string;
}

export function createSafeMetric(name: string, value: number): SafeMetric {
  return { name, value };
}

export function recommendContextDiet(input: RecommendationInput): ContextDietRecommendation {
  const evidenceAvailable = input.evidenceAvailable ?? true;
  const profileStatus = input.modelProfileStatus ?? "enabled";
  const weekly = weeklyNetProjection(input);
  const projection = {
    weekly,
    monthly: roundMoney(weekly * 4.345),
    annual: roundMoney(weekly * 52)
  };
  const protectedRuleBlocked =
    input.accuracyRiskLevel === "critical" ||
    (input.accuracyRiskLevel === "high" && input.userRiskTolerance === "conservative") ||
    input.codeHeavy === true;

  if (!evidenceAvailable) {
    return recommendation(input, "MISSING_EVIDENCE", projection, [
      "Missing comparable synthetic evidence, so the recommendation cannot rely on projected savings.",
      "Protected-content rules remain unchanged while evidence is collected."
    ]);
  }
  if (profileStatus === "unsupported") {
    return recommendation(input, "UNSUPPORTED", projection, [
      "The simulated model profile is unsupported.",
      "Context Diet should stay disabled until a supported profile is approved."
    ]);
  }
  if (profileStatus === "expired") {
    return recommendation(input, "MISSING_EVIDENCE", projection, [
      "The simulated model profile has expired and needs fresh canaries.",
      "Re-test the profile before enabling Context Diet."
    ]);
  }
  if (protectedRuleBlocked && weekly <= 0) {
    return recommendation(input, "NOT_WORTH_ENABLING", projection, [
      "Context Diet is not worth enabling for this simulated setup.",
      "The workload has high exactness risk, and projected savings are not positive.",
      "Protected-content rules were not weakened to improve the verdict."
    ]);
  }
  if (protectedRuleBlocked) {
    return recommendation(input, "WORTH_TRIAL_WITH_RESTRICTIONS", projection, [
      "Projected savings are positive, but exactness risk requires Safe mode restrictions.",
      "Protected values must remain native even if that lowers savings."
    ]);
  }
  if (weekly <= 0) {
    return recommendation(input, "NOT_WORTH_ENABLING", projection, [
      "Context Diet is not worth enabling for this simulated setup.",
      "Projected image, retrieval, latency or compute costs exceed text savings."
    ]);
  }
  if (input.cacheIntensity === "high" && weekly < 10) {
    return recommendation(input, "NOT_WORTH_ENABLING", projection, [
      "Context Diet is not worth enabling for this simulated setup.",
      "The workload is already highly cached, leaving little new saving."
    ]);
  }
  if (weekly < 5 || input.accuracyRiskLevel === "high") {
    return recommendation(input, "WORTH_TRIAL_WITH_RESTRICTIONS", projection, [
      "Projected value is small or risk-sensitive, so start with a restricted trial.",
      "Use canaries before widening the operating mode."
    ]);
  }
  return recommendation(input, "STRONG_POSITIVE_VALUE", projection, [
    "Synthetic projections show clear positive savings.",
    "Accuracy risk is low enough for the recommended operating mode."
  ]);
}

function recommendation(
  input: RecommendationInput,
  verdict: RecommendationVerdict,
  projection: RecommendationProjection,
  reasons: readonly string[]
): ContextDietRecommendation {
  return {
    breakEvenUsage: breakEvenUsage(input),
    dataOrigin: "synthetic",
    message:
      verdict === "NOT_WORTH_ENABLING"
        ? "Context Diet is not worth enabling for this simulated setup."
        : "Synthetic recommendation generated for this simulated setup.",
    netProjection: projection,
    recommendedOperatingMode: operatingMode(input, verdict),
    retestCondition: retestCondition(input, verdict),
    topReasons: reasons,
    verdict
  };
}

function weeklyNetProjection(input: RecommendationInput): number {
  const weeklyEligibleTokens =
    Math.min(input.eligibleContextTokens, input.projectedUsage.averageEligibleTokensPerRequest) *
    input.projectedUsage.requestsPerWeek;
  const cacheMultiplier =
    input.cacheIntensity === "high" ? 0.2 : input.cacheIntensity === "medium" ? 0.55 : 1;
  const textSaving =
    (weeklyEligibleTokens / 1_000) *
    input.costAssumptions.textCostPerThousandTokens *
    cacheMultiplier;
  const renderCost =
    input.projectedUsage.requestsPerWeek * input.costAssumptions.imageCostPerRender;
  const retrievalCost =
    input.projectedUsage.requestsPerWeek *
    input.retrievalFrequency *
    input.costAssumptions.retrievalCostPerUse;
  const latencyCost = input.projectedUsage.requestsPerWeek * (input.addedLatencyMs / 1_000) * 0.001;
  const computeCost =
    input.projectedUsage.requestsPerWeek *
    (input.optionalLocalComputeCost ?? input.costAssumptions.localComputeCostPerRequest ?? 0);
  return roundMoney(textSaving - renderCost - retrievalCost - latencyCost - computeCost);
}

function breakEvenUsage(input: RecommendationInput): number | null {
  const perRequestSaving =
    (Math.min(input.eligibleContextTokens, input.projectedUsage.averageEligibleTokensPerRequest) /
      1_000) *
    input.costAssumptions.textCostPerThousandTokens *
    (input.cacheIntensity === "high" ? 0.2 : input.cacheIntensity === "medium" ? 0.55 : 1);
  const perRequestCost =
    input.costAssumptions.imageCostPerRender +
    input.retrievalFrequency * input.costAssumptions.retrievalCostPerUse +
    (input.addedLatencyMs / 1_000) * 0.001 +
    (input.optionalLocalComputeCost ?? input.costAssumptions.localComputeCostPerRequest ?? 0);
  if (perRequestSaving <= perRequestCost) {
    return null;
  }
  return Math.ceil(perRequestCost / (perRequestSaving - perRequestCost));
}

function operatingMode(
  input: RecommendationInput,
  verdict: RecommendationVerdict
): RecommendationOperatingMode {
  if (verdict === "NOT_WORTH_ENABLING" || verdict === "UNSUPPORTED") {
    return "bypass";
  }
  if (
    verdict === "MISSING_EVIDENCE" ||
    input.accuracyRiskLevel === "high" ||
    input.accuracyRiskLevel === "critical" ||
    input.userRiskTolerance === "conservative"
  ) {
    return "safe";
  }
  if (input.userRiskTolerance === "aggressive" && input.accuracyRiskLevel === "low") {
    return "max";
  }
  return "balanced";
}

function retestCondition(input: RecommendationInput, verdict: RecommendationVerdict): string {
  if (verdict === "MISSING_EVIDENCE") {
    return "Re-test when synthetic canaries and comparable baseline evidence are available.";
  }
  if (input.modelProfileStatus === "unsupported") {
    return "Re-test only after a supported local model profile is approved.";
  }
  return "Re-test when usage, pricing, cache intensity, model profile or exactness mix changes.";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
