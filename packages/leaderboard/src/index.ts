import { createHmac, timingSafeEqual } from "node:crypto";

export type LeaderboardDimension =
  | "gist_accuracy"
  | "structural_accuracy"
  | "exact_string_accuracy"
  | "token_efficiency"
  | "latency"
  | "multilingual_coverage"
  | "retrieval_dependency"
  | "safe_mode_recommendation";

export interface LeaderboardScores {
  readonly gistAccuracy: number;
  readonly structuralAccuracy: number;
  readonly exactStringAccuracy: number;
  readonly tokenEfficiency: number;
  readonly latencyMs: number;
  readonly multilingualCoverage: number;
  readonly retrievalDependency: number;
  readonly safeModeRecommendation: number;
}

export interface SyntheticLeaderboardEvidencePayload {
  readonly evidenceKind: "fixel_recall_local_leaderboard_evidence";
  readonly dataOrigin: "synthetic";
  readonly simulatorNotice: "LOCAL SIMULATOR";
  readonly resultNotice: "SYNTHETIC RESULTS";
  readonly profileId: string;
  readonly providerSimulator: "openai" | "anthropic" | "both";
  readonly modelSimulatorVersion: string;
  readonly rendererVersion: string;
  readonly fontProfile: string;
  readonly corpusVersion: string;
  readonly runDate: string;
  readonly expiresAt: string;
  readonly reproducibilityStatus: "reproducible" | "partial" | "failed";
  readonly scores: LeaderboardScores;
}

export interface EvidenceSignature {
  readonly algorithm: "HMAC-SHA256";
  readonly keyId: "local-synthetic-leaderboard-v1";
  readonly value: string;
}

export interface SignedSyntheticLeaderboardEvidence {
  readonly payload: SyntheticLeaderboardEvidencePayload;
  readonly signature: EvidenceSignature;
}

export interface EvidenceVerification {
  readonly accepted: boolean;
  readonly current: boolean;
  readonly reason:
    | "accepted"
    | "not_synthetic"
    | "wrong_key"
    | "invalid_signature"
    | "expired"
    | "invalid_reproducibility";
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly profileId: string;
  readonly providerSimulator: SyntheticLeaderboardEvidencePayload["providerSimulator"];
  readonly modelSimulatorVersion: string;
  readonly rendererVersion: string;
  readonly fontProfile: string;
  readonly corpusVersion: string;
  readonly runDate: string;
  readonly expiresAt: string;
  readonly reproducibilityStatus: SyntheticLeaderboardEvidencePayload["reproducibilityStatus"];
  readonly value: number;
  readonly valueLabel: string;
  readonly evidenceSignature: string;
}

export interface LocalCompatibilityLeaderboard {
  readonly serviceKind: "local_only_compatibility_leaderboard";
  readonly simulatorNotice: "LOCAL SIMULATOR";
  readonly resultNotice: "SYNTHETIC RESULTS";
  readonly currentRunDate: string;
  readonly rejectedEvidenceCount: number;
  readonly expiredEvidenceCount: number;
  readonly rankings: Readonly<Record<LeaderboardDimension, readonly LeaderboardEntry[]>>;
  readonly note: string;
}

const signingSecret = "fixel-recall-local-synthetic-leaderboard-fixture-key";

export const leaderboardDimensions = [
  "gist_accuracy",
  "structural_accuracy",
  "exact_string_accuracy",
  "token_efficiency",
  "latency",
  "multilingual_coverage",
  "retrieval_dependency",
  "safe_mode_recommendation"
] as const satisfies readonly LeaderboardDimension[];

export function signSyntheticLeaderboardEvidence(
  payload: SyntheticLeaderboardEvidencePayload
): SignedSyntheticLeaderboardEvidence {
  return {
    payload,
    signature: {
      algorithm: "HMAC-SHA256",
      keyId: "local-synthetic-leaderboard-v1",
      value: hmac(canonicalJson(payload))
    }
  };
}

export function verifySyntheticLeaderboardEvidence(
  evidence: SignedSyntheticLeaderboardEvidence,
  currentDate = "2026-07-17"
): EvidenceVerification {
  if (evidence.payload.dataOrigin !== "synthetic") {
    return { accepted: false, current: false, reason: "not_synthetic" };
  }
  if (evidence.signature.keyId !== "local-synthetic-leaderboard-v1") {
    return { accepted: false, current: false, reason: "wrong_key" };
  }
  if (!constantTimeEqual(evidence.signature.value, hmac(canonicalJson(evidence.payload)))) {
    return { accepted: false, current: false, reason: "invalid_signature" };
  }
  if (evidence.payload.reproducibilityStatus === "failed") {
    return { accepted: false, current: false, reason: "invalid_reproducibility" };
  }
  const current = Date.parse(evidence.payload.expiresAt) >= Date.parse(currentDate);
  if (!current) {
    return { accepted: true, current: false, reason: "expired" };
  }
  return { accepted: true, current: true, reason: "accepted" };
}

export function createLocalCompatibilityLeaderboard(
  evidence: readonly SignedSyntheticLeaderboardEvidence[],
  currentDate = "2026-07-17"
): LocalCompatibilityLeaderboard {
  const acceptedCurrent: SignedSyntheticLeaderboardEvidence[] = [];
  let rejectedEvidenceCount = 0;
  let expiredEvidenceCount = 0;
  for (const item of evidence) {
    const verification = verifySyntheticLeaderboardEvidence(item, currentDate);
    if (!verification.accepted) {
      rejectedEvidenceCount += 1;
      continue;
    }
    if (!verification.current) {
      expiredEvidenceCount += 1;
      continue;
    }
    acceptedCurrent.push(item);
  }

  return {
    currentRunDate: currentDate,
    expiredEvidenceCount,
    note: "Dimensions are ranked separately; Fixel Recall does not combine them into one winner score.",
    rankings: Object.fromEntries(
      leaderboardDimensions.map((dimension) => [
        dimension,
        rankDimension(acceptedCurrent, dimension)
      ])
    ) as Readonly<Record<LeaderboardDimension, readonly LeaderboardEntry[]>>,
    rejectedEvidenceCount,
    resultNotice: "SYNTHETIC RESULTS",
    serviceKind: "local_only_compatibility_leaderboard",
    simulatorNotice: "LOCAL SIMULATOR"
  };
}

export function createSeededLeaderboardEvidence(
  seed = 1
): readonly SignedSyntheticLeaderboardEvidence[] {
  const baseDate = "2026-07-17";
  const profiles = [
    payload(seed, "profile-synthetic-balanced", "both", "sim-2026.7", {
      exactStringAccuracy: 91,
      gistAccuracy: 96,
      latencyMs: 680,
      multilingualCoverage: 88,
      retrievalDependency: 22,
      safeModeRecommendation: 94,
      structuralAccuracy: 93,
      tokenEfficiency: 52
    }),
    payload(seed + 1, "profile-synthetic-fast", "openai", "sim-2026.7-fast", {
      exactStringAccuracy: 84,
      gistAccuracy: 92,
      latencyMs: 430,
      multilingualCoverage: 74,
      retrievalDependency: 34,
      safeModeRecommendation: 88,
      structuralAccuracy: 86,
      tokenEfficiency: 61
    }),
    payload(seed + 2, "profile-synthetic-exact", "anthropic", "sim-2026.7-exact", {
      exactStringAccuracy: 97,
      gistAccuracy: 94,
      latencyMs: 820,
      multilingualCoverage: 81,
      retrievalDependency: 15,
      safeModeRecommendation: 96,
      structuralAccuracy: 95,
      tokenEfficiency: 43
    }),
    {
      ...payload(seed + 3, "profile-synthetic-expired", "both", "sim-2026.6", {
        exactStringAccuracy: 99,
        gistAccuracy: 99,
        latencyMs: 300,
        multilingualCoverage: 99,
        retrievalDependency: 5,
        safeModeRecommendation: 99,
        structuralAccuracy: 99,
        tokenEfficiency: 80
      }),
      expiresAt: "2026-07-01"
    }
  ] as const;

  return profiles.map((item) =>
    signSyntheticLeaderboardEvidence({
      ...item,
      runDate: baseDate
    })
  );
}

export function createTamperedLeaderboardEvidence(
  evidence: SignedSyntheticLeaderboardEvidence
): SignedSyntheticLeaderboardEvidence {
  return {
    ...evidence,
    payload: {
      ...evidence.payload,
      scores: { ...evidence.payload.scores, tokenEfficiency: 100 }
    }
  };
}

function rankDimension(
  evidence: readonly SignedSyntheticLeaderboardEvidence[],
  dimension: LeaderboardDimension
): readonly LeaderboardEntry[] {
  return evidence
    .map((item) => toEntry(item, dimension))
    .sort(
      (left, right) =>
        compareDimension(dimension, left.value, right.value) ||
        left.profileId.localeCompare(right.profileId)
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function toEntry(
  evidence: SignedSyntheticLeaderboardEvidence,
  dimension: LeaderboardDimension
): LeaderboardEntry {
  const payload = evidence.payload;
  const value = scoreFor(payload.scores, dimension);
  return {
    corpusVersion: payload.corpusVersion,
    evidenceSignature: evidence.signature.value.slice(0, 12),
    expiresAt: payload.expiresAt,
    fontProfile: payload.fontProfile,
    modelSimulatorVersion: payload.modelSimulatorVersion,
    profileId: payload.profileId,
    providerSimulator: payload.providerSimulator,
    rank: 0,
    rendererVersion: payload.rendererVersion,
    reproducibilityStatus: payload.reproducibilityStatus,
    runDate: payload.runDate,
    value,
    valueLabel: dimension === "latency" ? `${value} ms` : `${value}`
  };
}

function scoreFor(scores: LeaderboardScores, dimension: LeaderboardDimension): number {
  const map: Record<LeaderboardDimension, number> = {
    exact_string_accuracy: scores.exactStringAccuracy,
    gist_accuracy: scores.gistAccuracy,
    latency: scores.latencyMs,
    multilingual_coverage: scores.multilingualCoverage,
    retrieval_dependency: scores.retrievalDependency,
    safe_mode_recommendation: scores.safeModeRecommendation,
    structural_accuracy: scores.structuralAccuracy,
    token_efficiency: scores.tokenEfficiency
  };
  return map[dimension];
}

function compareDimension(dimension: LeaderboardDimension, left: number, right: number): number {
  if (dimension === "latency" || dimension === "retrieval_dependency") {
    return left - right;
  }
  return right - left;
}

function payload(
  seed: number,
  profileId: string,
  providerSimulator: SyntheticLeaderboardEvidencePayload["providerSimulator"],
  modelSimulatorVersion: string,
  scores: LeaderboardScores
): SyntheticLeaderboardEvidencePayload {
  return {
    corpusVersion: `synthetic-corpus-v${1 + (seed % 3)}`,
    dataOrigin: "synthetic",
    evidenceKind: "fixel_recall_local_leaderboard_evidence",
    expiresAt: "2026-12-31",
    fontProfile: `synthetic-font-profile-${1 + (seed % 2)}`,
    modelSimulatorVersion,
    profileId,
    providerSimulator,
    rendererVersion: "synthetic-renderer-v1",
    reproducibilityStatus: "reproducible",
    resultNotice: "SYNTHETIC RESULTS",
    runDate: "2026-07-17",
    scores,
    simulatorNotice: "LOCAL SIMULATOR"
  };
}

function hmac(value: string): string {
  return createHmac("sha256", signingSecret).update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
    .join(",")}}`;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
