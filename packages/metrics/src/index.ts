import {
  createSyntheticUsageHistory,
  type SyntheticUsageDay,
  type SyntheticUsageHistory
} from "@fixel-recall/test-data";

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

export interface FixelRecallRecommendation {
  readonly dataOrigin: "synthetic";
  readonly verdict: RecommendationVerdict;
  readonly message: string;
  readonly netProjection: RecommendationProjection;
  readonly breakEvenUsage: number | null;
  readonly topReasons: readonly string[];
  readonly recommendedOperatingMode: RecommendationOperatingMode;
  readonly retestCondition: string;
}

export type CostProvider = "openai" | "anthropic" | "unknown";
export type TokenAvailability = "available" | "estimated" | "unavailable";
export type CostConfidence = "high" | "medium" | "low" | "unavailable";

export interface ProviderTokenBreakdown {
  readonly measuredInputTokens?: number;
  readonly estimatedInputTokens?: number;
  readonly cachedInputTokens?: number;
  readonly imageTokens?: number;
  readonly outputTokens?: number;
  readonly availability: TokenAvailability;
}

export interface ProviderPriceInfo {
  readonly source: string;
  readonly date: string;
  readonly inputPerMillion: number;
  readonly cachedInputPerMillion: number;
  readonly imagePerMillion: number;
  readonly outputPerMillion: number;
  readonly staleAfterDays: number;
}

export interface ProviderCostRun {
  readonly provider: CostProvider;
  readonly modelVersion: string;
  readonly cacheTreatment: "none" | "provider_cache" | "fixel_recall_cache";
  readonly status: "success" | "failed";
  readonly tokens: ProviderTokenBreakdown;
  readonly price: ProviderPriceInfo;
  readonly addedLatencyMs: number;
  readonly normalisedModelComparison?: boolean;
}

export interface ProviderCostReportInput {
  readonly baseline?: ProviderCostRun;
  readonly candidate: ProviderCostRun;
  readonly asOfDate: string;
}

export interface ProviderCostTotal {
  readonly input: number;
  readonly cachedInput: number;
  readonly image: number;
  readonly output: number;
  readonly total: number;
}

export interface ProviderCostReport {
  readonly dataOrigin: "synthetic";
  readonly provider: CostProvider;
  readonly modelVersion: string;
  readonly measuredInputTokens: number | null;
  readonly estimatedInputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly imageTokens: number | null;
  readonly outputTokens: number | null;
  readonly priceSource: string;
  readonly priceDate: string;
  readonly priceStale: boolean;
  readonly addedLatencyMs: number;
  readonly totalEstimatedCost: number | null;
  readonly confidence: CostConfidence;
  readonly availability: TokenAvailability;
  readonly baselineTotalEstimatedCost: number | null;
  readonly savingsAmount: number | null;
  readonly savingsPercentage: number | null;
  readonly negativeResult: boolean;
  readonly comparisonValid: boolean;
  readonly cacheTreatment: {
    readonly baseline: string | null;
    readonly candidate: string;
    readonly changed: boolean;
  };
  readonly reasons: readonly string[];
}

export type ProjectionScenarioName = "conservative" | "expected" | "high-usage";
export type ProjectionEvidenceOrigin = "synthetic" | "measured";

export interface SavingsProjectionCostAssumptions {
  readonly inputPerMillion: number;
  readonly imagePerMillion: number;
  readonly cachedInputPerMillion: number;
  readonly retrievalPerCall: number;
  readonly localProcessingPerRequest: number;
}

export interface SavingsProjectionInput {
  readonly seed: number;
  readonly days: 30 | 90;
  readonly costAssumptions: SavingsProjectionCostAssumptions;
  readonly baselineAvailable?: boolean;
  readonly evidenceOrigin?: ProjectionEvidenceOrigin;
  readonly benchmarkDate?: string;
}

export interface SavingsProjectionPeriod {
  readonly originalInputCost: number;
  readonly imageCost: number;
  readonly cacheEffect: number;
  readonly localProcessingCost: number;
  readonly retrievalOverhead: number;
  readonly netSaving: number;
  readonly addedLatencyMs: number;
  readonly breakEvenRequests: number | null;
  readonly savingsPercentage: number | null;
}

export interface SavingsProjectionScenario {
  readonly scenario: ProjectionScenarioName;
  readonly weekly: SavingsProjectionPeriod;
  readonly monthly: SavingsProjectionPeriod;
  readonly annual: SavingsProjectionPeriod;
}

export interface SavingsProjectionReport {
  readonly dataNotice: "SYNTHETIC DATA";
  readonly evidenceOrigin: "synthetic";
  readonly seed: number;
  readonly historyDays: 30 | 90;
  readonly benchmarkDate: string;
  readonly baselineAvailable: boolean;
  readonly comparisonValid: boolean;
  readonly confidence: CostConfidence;
  readonly scenarios: readonly SavingsProjectionScenario[];
  readonly reasons: readonly string[];
}

export function createSafeMetric(name: string, value: number): SafeMetric {
  return { name, value };
}

export function createSavingsProjectionReport(
  input: SavingsProjectionInput
): SavingsProjectionReport {
  const history = createSyntheticUsageHistory(input.seed, input.days);
  const evidenceOrigin = input.evidenceOrigin ?? "synthetic";
  const baselineAvailable = input.baselineAvailable ?? true;
  const mixedEvidence = evidenceOrigin !== history.dataOrigin;
  const comparisonValid = baselineAvailable && !mixedEvidence;
  const reasons: string[] = ["SYNTHETIC DATA: projections use seeded synthetic usage history."];
  if (!baselineAvailable) {
    reasons.push("Missing baseline means no savings percentage is reported.");
  }
  if (mixedEvidence) {
    reasons.push("Measured and simulated data cannot be mixed silently; comparison is invalid.");
  }

  return {
    baselineAvailable,
    benchmarkDate: input.benchmarkDate ?? "2026-07-17",
    comparisonValid,
    confidence: mixedEvidence ? "unavailable" : input.days === 90 ? "medium" : "low",
    dataNotice: "SYNTHETIC DATA",
    evidenceOrigin: "synthetic",
    historyDays: input.days,
    reasons,
    scenarios: [
      projectionScenario("conservative", history, input.costAssumptions, 0.75, comparisonValid),
      projectionScenario("expected", history, input.costAssumptions, 1, comparisonValid),
      projectionScenario("high-usage", history, input.costAssumptions, 1.4, comparisonValid)
    ],
    seed: input.seed
  };
}

export function createProviderCostReport(input: ProviderCostReportInput): ProviderCostReport {
  const candidate = input.candidate;
  const candidateTotal = costTotal(candidate);
  const baselineTotal =
    input.baseline === undefined || input.baseline.status === "failed"
      ? null
      : costTotal(input.baseline);
  const comparability = comparable(input);
  const savingsAmount =
    baselineTotal === null || candidateTotal === null || !comparability.valid
      ? null
      : roundMoney(baselineTotal.total - candidateTotal.total);
  const savingsPercentage =
    baselineTotal === null ||
    candidateTotal === null ||
    !comparability.valid ||
    baselineTotal.total === 0
      ? null
      : roundMoney(((baselineTotal.total - candidateTotal.total) / baselineTotal.total) * 100);
  const priceStale = isPriceStale(candidate.price, input.asOfDate);
  const reasons = costReportReasons({
    baselineTotal,
    candidate,
    candidateTotal,
    comparability,
    priceStale,
    savingsAmount
  });

  return {
    addedLatencyMs: candidate.addedLatencyMs,
    availability: candidate.tokens.availability,
    baselineTotalEstimatedCost: baselineTotal?.total ?? null,
    cachedInputTokens: candidate.tokens.cachedInputTokens ?? null,
    cacheTreatment: {
      baseline: input.baseline?.cacheTreatment ?? null,
      candidate: candidate.cacheTreatment,
      changed:
        input.baseline !== undefined && input.baseline.cacheTreatment !== candidate.cacheTreatment
    },
    comparisonValid: comparability.valid,
    confidence: confidenceFor(candidate, input.baseline, comparability.valid),
    dataOrigin: "synthetic",
    estimatedInputTokens: candidate.tokens.estimatedInputTokens ?? null,
    imageTokens: candidate.tokens.imageTokens ?? null,
    measuredInputTokens: candidate.tokens.measuredInputTokens ?? null,
    modelVersion: candidate.modelVersion,
    negativeResult: savingsAmount !== null && savingsAmount < 0,
    outputTokens: candidate.tokens.outputTokens ?? null,
    priceDate: candidate.price.date,
    priceSource: candidate.price.source,
    priceStale,
    provider: candidate.provider,
    reasons,
    savingsAmount,
    savingsPercentage,
    totalEstimatedCost: candidateTotal?.total ?? null
  };
}

export function recommendFixelRecall(input: RecommendationInput): FixelRecallRecommendation {
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
      "Fixel Recall should stay disabled until a supported profile is approved."
    ]);
  }
  if (profileStatus === "expired") {
    return recommendation(input, "MISSING_EVIDENCE", projection, [
      "The simulated model profile has expired and needs fresh canaries.",
      "Re-test the profile before enabling Fixel Recall."
    ]);
  }
  if (protectedRuleBlocked && weekly <= 0) {
    return recommendation(input, "NOT_WORTH_ENABLING", projection, [
      "Fixel Recall is not worth enabling for this simulated setup.",
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
      "Fixel Recall is not worth enabling for this simulated setup.",
      "Projected image, retrieval, latency or compute costs exceed text savings."
    ]);
  }
  if (input.cacheIntensity === "high" && weekly < 10) {
    return recommendation(input, "NOT_WORTH_ENABLING", projection, [
      "Fixel Recall is not worth enabling for this simulated setup.",
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
): FixelRecallRecommendation {
  return {
    breakEvenUsage: breakEvenUsage(input),
    dataOrigin: "synthetic",
    message:
      verdict === "NOT_WORTH_ENABLING"
        ? "Fixel Recall is not worth enabling for this simulated setup."
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

function projectionScenario(
  scenario: ProjectionScenarioName,
  history: SyntheticUsageHistory,
  costs: SavingsProjectionCostAssumptions,
  multiplier: number,
  comparisonValid: boolean
): SavingsProjectionScenario {
  const base = periodFromDays(history.days, costs, multiplier, comparisonValid);
  return {
    annual: scaleProjection(base, 365 / history.days.length, comparisonValid),
    monthly: scaleProjection(base, 30 / history.days.length, comparisonValid),
    scenario,
    weekly: scaleProjection(base, 7 / history.days.length, comparisonValid)
  };
}

function periodFromDays(
  days: readonly SyntheticUsageDay[],
  costs: SavingsProjectionCostAssumptions,
  multiplier: number,
  comparisonValid: boolean
): SavingsProjectionPeriod {
  const totals = days.reduce(
    (acc, day) => {
      const requests = day.sessions * day.requestsPerSession * multiplier;
      const originalTokens = day.originalTokenEstimate * requests;
      const eligibleTokens = day.eligibleTokenEstimate * requests;
      const cachedTokens = Math.min(day.cachedTokens * requests, originalTokens);
      const imageTokens = day.imageTokens * requests;
      const retrievalCalls = day.retrievalCalls * requests;
      return {
        addedLatencyMs: acc.addedLatencyMs + day.addedLatencyMs * requests,
        cachedTokens: acc.cachedTokens + cachedTokens,
        eligibleTokens: acc.eligibleTokens + eligibleTokens,
        imageTokens: acc.imageTokens + imageTokens,
        originalTokens: acc.originalTokens + originalTokens,
        requests: acc.requests + requests,
        retrievalCalls: acc.retrievalCalls + retrievalCalls
      };
    },
    {
      addedLatencyMs: 0,
      cachedTokens: 0,
      eligibleTokens: 0,
      imageTokens: 0,
      originalTokens: 0,
      requests: 0,
      retrievalCalls: 0
    }
  );
  const originalInputCost = (totals.originalTokens / 1_000_000) * costs.inputPerMillion;
  const transformedInputCost =
    (Math.max(0, totals.originalTokens - totals.eligibleTokens - totals.cachedTokens) / 1_000_000) *
    costs.inputPerMillion;
  const cacheEffect =
    (totals.cachedTokens / 1_000_000) * (costs.inputPerMillion - costs.cachedInputPerMillion);
  const imageCost = (totals.imageTokens / 1_000_000) * costs.imagePerMillion;
  const localProcessingCost = totals.requests * costs.localProcessingPerRequest;
  const retrievalOverhead = totals.retrievalCalls * costs.retrievalPerCall;
  const grossSaving = originalInputCost - transformedInputCost;
  const netSaving = grossSaving + cacheEffect - imageCost - localProcessingCost - retrievalOverhead;
  const perRequestNet = totals.requests === 0 ? 0 : netSaving / totals.requests;

  return {
    addedLatencyMs: Math.round(totals.requests === 0 ? 0 : totals.addedLatencyMs / totals.requests),
    breakEvenRequests:
      perRequestNet <= 0
        ? null
        : Math.ceil((imageCost + localProcessingCost + retrievalOverhead) / perRequestNet),
    cacheEffect: roundMoney(cacheEffect),
    imageCost: roundMoney(imageCost),
    localProcessingCost: roundMoney(localProcessingCost),
    netSaving: roundMoney(netSaving),
    originalInputCost: roundMoney(originalInputCost),
    retrievalOverhead: roundMoney(retrievalOverhead),
    savingsPercentage:
      comparisonValid && originalInputCost > 0
        ? roundMoney((netSaving / originalInputCost) * 100)
        : null
  };
}

function scaleProjection(
  period: SavingsProjectionPeriod,
  factor: number,
  comparisonValid: boolean
): SavingsProjectionPeriod {
  return {
    addedLatencyMs: period.addedLatencyMs,
    breakEvenRequests: period.breakEvenRequests,
    cacheEffect: roundMoney(period.cacheEffect * factor),
    imageCost: roundMoney(period.imageCost * factor),
    localProcessingCost: roundMoney(period.localProcessingCost * factor),
    netSaving: roundMoney(period.netSaving * factor),
    originalInputCost: roundMoney(period.originalInputCost * factor),
    retrievalOverhead: roundMoney(period.retrievalOverhead * factor),
    savingsPercentage:
      comparisonValid && period.originalInputCost > 0
        ? roundMoney((period.netSaving / period.originalInputCost) * 100)
        : null
  };
}

function costTotal(run: ProviderCostRun): ProviderCostTotal | null {
  if (run.status === "failed" || run.tokens.availability === "unavailable") {
    return null;
  }
  const measuredOrEstimatedInput =
    run.tokens.measuredInputTokens ?? run.tokens.estimatedInputTokens ?? null;
  if (measuredOrEstimatedInput === null) {
    return null;
  }
  const cachedInput = run.tokens.cachedInputTokens ?? 0;
  const billableInput = Math.max(0, measuredOrEstimatedInput - cachedInput);
  const imageTokens = run.tokens.imageTokens ?? 0;
  const outputTokens = run.tokens.outputTokens ?? 0;
  const total = {
    cachedInput: (cachedInput / 1_000_000) * run.price.cachedInputPerMillion,
    image: (imageTokens / 1_000_000) * run.price.imagePerMillion,
    input: (billableInput / 1_000_000) * run.price.inputPerMillion,
    output: (outputTokens / 1_000_000) * run.price.outputPerMillion
  };
  return {
    cachedInput: roundMoney(total.cachedInput),
    image: roundMoney(total.image),
    input: roundMoney(total.input),
    output: roundMoney(total.output),
    total: roundMoney(total.input + total.cachedInput + total.image + total.output)
  };
}

function comparable(input: ProviderCostReportInput): {
  readonly valid: boolean;
  readonly reasons: readonly string[];
} {
  const baseline = input.baseline;
  const reasons: string[] = [];
  if (baseline === undefined) {
    reasons.push("No comparable baseline was provided, so savings percentage is not reported.");
  } else {
    if (baseline.status === "failed" || input.candidate.status === "failed") {
      reasons.push("Failed runs cannot be used as successful cost comparisons.");
    }
    if (
      baseline.modelVersion !== input.candidate.modelVersion &&
      input.candidate.normalisedModelComparison !== true
    ) {
      reasons.push("Different model versions invalidate comparison unless explicitly normalised.");
    }
  }
  return { reasons, valid: reasons.length === 0 };
}

function isPriceStale(price: ProviderPriceInfo, asOfDate: string): boolean {
  const priceDate = Date.parse(price.date);
  const reportDate = Date.parse(asOfDate);
  if (Number.isNaN(priceDate) || Number.isNaN(reportDate)) {
    return true;
  }
  const ageDays = (reportDate - priceDate) / 86_400_000;
  return ageDays > price.staleAfterDays;
}

function confidenceFor(
  candidate: ProviderCostRun,
  baseline: ProviderCostRun | undefined,
  comparisonValid: boolean
): CostConfidence {
  if (candidate.tokens.availability === "unavailable" || candidate.status === "failed") {
    return "unavailable";
  }
  if (!comparisonValid || baseline === undefined) {
    return "low";
  }
  return candidate.tokens.availability === "estimated" ? "medium" : "high";
}

function costReportReasons(input: {
  readonly candidate: ProviderCostRun;
  readonly candidateTotal: ProviderCostTotal | null;
  readonly baselineTotal: ProviderCostTotal | null;
  readonly comparability: { readonly valid: boolean; readonly reasons: readonly string[] };
  readonly priceStale: boolean;
  readonly savingsAmount: number | null;
}): readonly string[] {
  const reasons = [...input.comparability.reasons];
  if (input.candidate.tokens.availability === "unavailable") {
    reasons.push("Token counts are unavailable, so total estimated cost is unavailable.");
  }
  if (input.candidate.status === "failed") {
    reasons.push("The candidate run failed and is not counted as a successful comparison.");
  }
  if (input.priceStale) {
    reasons.push("Price data is stale and must be labelled before using the estimate.");
  }
  if (input.baselineTotal !== null && input.candidateTotal !== null) {
    const baselineCacheTreatment =
      input.comparability.valid && input.candidate.cacheTreatment !== "none"
        ? "a comparable setup"
        : "a native setup";
    reasons.push(
      `Cache treatment: baseline uses ${baselineCacheTreatment}; candidate uses ${input.candidate.cacheTreatment}.`
    );
  }
  if (input.savingsAmount !== null && input.savingsAmount < 0) {
    reasons.push("The comparison is negative; the candidate costs more than the baseline.");
  }
  if (reasons.length === 0) {
    reasons.push("Comparable provider-aware cost report is available.");
  }
  return reasons;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
