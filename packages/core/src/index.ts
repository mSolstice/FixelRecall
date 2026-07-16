export type ProviderFamily = "openai" | "anthropic" | "unknown";

export type ContextDietMode = "safe" | "balanced" | "max" | "bypass";

export type PolicyMode = ContextDietMode;

export type ProductPolicyPreset = "Observe Only" | "Protect First" | "Save More" | "Lab Mode";

export interface ProductPolicyPresetDefinition {
  readonly preset: ProductPolicyPreset;
  readonly internalMode: PolicyMode;
  readonly eligibleSources: readonly SourceCategory[];
  readonly blockAgeThresholdMs: number;
  readonly minimumSaving: number;
  readonly recoveryRequired: boolean;
  readonly allowedProfileStatus: readonly ModelProfileStatus["kind"][];
  readonly languageSupport: readonly string[];
  readonly maximumAddedLatencyMs: number;
  readonly adaptationPermission: "none" | "conservative" | "adaptive" | "experimental";
}

export interface ProductPolicyPresetSelectionInput {
  readonly requestedPreset?: ProductPolicyPreset;
  readonly syntheticSession?: boolean;
  readonly experimentalSession?: boolean;
  readonly organisationForbiddenPresets?: readonly ProductPolicyPreset[];
}

export interface ProductPolicyPresetSelection {
  readonly preset: ProductPolicyPreset;
  readonly definition: ProductPolicyPresetDefinition;
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

export type SourceCategory =
  | "current_instruction"
  | "conversation_history"
  | "tool_call"
  | "tool_result"
  | "source_code"
  | "terminal_output"
  | "documentation"
  | "external_content"
  | "unknown";

export type ExactnessRisk =
  | "gist_safe"
  | "structure_sensitive"
  | "verbatim_critical"
  | "secret_sensitive"
  | "unknown_risk";

export type Recoverability =
  | { readonly kind: "not_recoverable"; readonly reason: ReasonCode }
  | { readonly kind: "recoverable"; readonly vaultScope: RecoverableVaultScope };

export type TransformationDecision =
  | { readonly action: "KEEP_NATIVE"; readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode> }
  | { readonly action: "REDACT_AND_KEEP"; readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode> }
  | {
      readonly action: "REDACT_AND_RENDER";
      readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
      readonly recoverability: Extract<Recoverability, { readonly kind: "recoverable" }>;
    }
  | {
      readonly action: "RENDER_RECOVERABLE";
      readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
      readonly recoverability: Extract<Recoverability, { readonly kind: "recoverable" }>;
    }
  | {
      readonly action: "REFERENCE_ONLY";
      readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
      readonly recoverability: Extract<Recoverability, { readonly kind: "recoverable" }>;
    }
  | { readonly action: "DEDUPLICATE"; readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode> }
  | { readonly action: "DROP_STALE"; readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode> }
  | {
      readonly action: "PASS_THROUGH_UNKNOWN";
      readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
    };

export type ReasonCode =
  | "current_context"
  | "exact_value"
  | "code_or_command"
  | "secret_sensitive"
  | "unknown_risk"
  | "unsupported_format"
  | "unsupported_glyphs"
  | "profile_disabled"
  | "profile_expired"
  | "unprofitable_conversion"
  | "renderer_failure"
  | "vault_unavailable"
  | "user_keep_native"
  | "user_allow_transform"
  | "stale_duplicate"
  | "eligible_gist_safe"
  | "safe_mode"
  | "recoverable"
  | "unknown_shape"
  | "transport_feasibility";

export type ReasonGroup =
  | "current_context"
  | "exact_value"
  | "code_or_command"
  | "secret_sensitive"
  | "unknown_risk"
  | "unsupported_format"
  | "unsupported_glyphs"
  | "profile_disabled_or_expired"
  | "unprofitable_conversion"
  | "renderer_failure"
  | "vault_unavailable"
  | "user_override"
  | "stale_duplicate"
  | "eligible_gist_safe"
  | "system_safety"
  | "recoverability"
  | "transport";

export interface ReasonDefinition {
  readonly code: ReasonCode;
  readonly group: ReasonGroup;
  readonly title: string;
  readonly cliText: string;
  readonly dashboardText: string;
}

export type DecisionAction = TransformationDecision["action"];

export interface DecisionRecord {
  readonly blockId: BlockId;
  readonly decision: DecisionAction;
  readonly reasons: NonEmptyReadonlyArray<ReasonCode>;
  readonly policyMode: PolicyMode;
  readonly timestamp: IsoTimestamp;
  readonly profileId?: string;
  readonly originalContentPreserved: boolean;
  readonly recoveryAvailable: boolean;
}

export type TaskExactnessRequirement = "gist_ok" | "structure_matters" | "exact_required";

export type ModelProfileStatus =
  | { readonly kind: "enabled"; readonly profileId: string }
  | { readonly kind: "disabled"; readonly profileId: string }
  | { readonly kind: "expired"; readonly profileId: string };

export interface PolicyScannerResult {
  readonly riskClass: ExactnessRisk;
  readonly reasonCodes: NonEmptyReadonlyArray<ReasonCode>;
  readonly renderEligible: boolean;
  readonly protectedSpans: readonly unknown[];
  readonly secretSensitiveSpans: readonly unknown[];
}

export interface PolicyCostEstimate {
  readonly textCost: number;
  readonly imageCost: number;
  readonly sidecarCost: number;
}

export type PolicyRendererResult =
  | { readonly status: "not_attempted" }
  | { readonly status: "succeeded" }
  | { readonly status: "failed"; readonly reason: "renderer_failure" };

export interface PolicyEvaluationInput {
  readonly block: NormalizedBlock;
  readonly scannerResult: PolicyScannerResult;
  readonly contextAgeMs: number;
  readonly sourceCategory: SourceCategory;
  readonly taskExactnessRequirement: TaskExactnessRequirement;
  readonly recoverability: Recoverability;
  readonly modelProfileStatus: ModelProfileStatus;
  readonly estimatedCost: PolicyCostEstimate;
  readonly rendererResult?: PolicyRendererResult;
  readonly mode: PolicyMode;
  readonly timestamp: IsoTimestamp;
}

export type EvidenceOrigin = "synthetic" | "measured" | "mixed";

export type CompatibilityVerdict =
  | "recommended"
  | "recommended_with_restrictions"
  | "audit_only"
  | "not_worth_using"
  | "unsupported"
  | "retest_required";

export type RendererHealthStatus = "healthy" | "degraded" | "unsafe" | "unsupported";

export interface ModelProfileSummary {
  readonly profileId: string;
  readonly provider: ProviderFamily;
  readonly modelFamily: string;
  readonly modelVersion?: string;
  readonly status: ModelProfileStatus["kind"] | "canary" | "retest_required";
  readonly origin: EvidenceOrigin;
  readonly issuedAt: IsoTimestamp;
  readonly expiresAt: IsoTimestamp;
  readonly signatureStatus?: "not_required" | "verified" | "invalid";
}

export type ImageTokenAccountingRule =
  | { readonly kind: "fixed_per_image"; readonly tokensPerImage: number }
  | { readonly kind: "pixels"; readonly baseTokens: number; readonly tokensPerMegapixel: number };

export interface ImageDimensionLimits {
  readonly maxWidthPx: number;
  readonly maxHeightPx: number;
  readonly maxPages: number;
}

export interface GlyphDensityProfile {
  readonly maxGlyphsPerPage: number;
  readonly maxGlyphsPerSquareInch: number;
}

export interface LanguageCoverage {
  readonly primaryLanguages: readonly string[];
  readonly partiallySupportedLanguages: readonly string[];
  readonly unsupportedLanguages: readonly string[];
}

export interface ModelProfileScores {
  readonly gist: number;
  readonly structure: number;
  readonly exactString: number;
}

export interface ModelProfileThresholds {
  readonly minimumGist: number;
  readonly minimumStructure: number;
  readonly minimumExactString: number;
}

export const defaultProductPolicyPreset: ProductPolicyPreset = "Protect First";

export const productPolicyPresets = {
  "Observe Only": {
    adaptationPermission: "none",
    allowedProfileStatus: ["enabled", "disabled", "expired"],
    blockAgeThresholdMs: 0,
    eligibleSources: [
      "conversation_history",
      "tool_result",
      "documentation",
      "terminal_output",
      "external_content"
    ],
    internalMode: "bypass",
    languageSupport: ["all"],
    maximumAddedLatencyMs: 0,
    minimumSaving: 0,
    preset: "Observe Only",
    recoveryRequired: false
  },
  "Protect First": {
    adaptationPermission: "conservative",
    allowedProfileStatus: ["enabled"],
    blockAgeThresholdMs: 5 * 60 * 1000,
    eligibleSources: ["conversation_history", "tool_result", "documentation"],
    internalMode: "safe",
    languageSupport: ["latin", "devanagari", "cjk", "mixed"],
    maximumAddedLatencyMs: 500,
    minimumSaving: 0.01,
    preset: "Protect First",
    recoveryRequired: true
  },
  "Save More": {
    adaptationPermission: "adaptive",
    allowedProfileStatus: ["enabled"],
    blockAgeThresholdMs: 30 * 60 * 1000,
    eligibleSources: ["conversation_history", "tool_result", "documentation", "external_content"],
    internalMode: "balanced",
    languageSupport: ["latin", "devanagari", "cjk", "mixed"],
    maximumAddedLatencyMs: 1_500,
    minimumSaving: 0.05,
    preset: "Save More",
    recoveryRequired: true
  },
  "Lab Mode": {
    adaptationPermission: "experimental",
    allowedProfileStatus: ["enabled"],
    blockAgeThresholdMs: 60 * 60 * 1000,
    eligibleSources: [
      "conversation_history",
      "tool_result",
      "documentation",
      "external_content",
      "terminal_output"
    ],
    internalMode: "max",
    languageSupport: ["latin", "devanagari", "cjk", "mixed"],
    maximumAddedLatencyMs: 3_000,
    minimumSaving: 0.1,
    preset: "Lab Mode",
    recoveryRequired: true
  }
} as const satisfies Record<ProductPolicyPreset, ProductPolicyPresetDefinition>;

export function selectProductPolicyPreset(
  input: ProductPolicyPresetSelectionInput = {}
): ProductPolicyPresetSelection {
  const preset = input.requestedPreset ?? defaultProductPolicyPreset;
  const definition = productPolicyPresets[preset];
  const reasons: string[] = [];
  if (input.organisationForbiddenPresets?.includes(preset) === true) {
    reasons.push("Organisation policy forbids this preset.");
  }
  if (
    preset === "Lab Mode" &&
    input.syntheticSession !== true &&
    input.experimentalSession !== true
  ) {
    reasons.push("Lab Mode requires a synthetic or explicitly experimental session.");
  }
  reasons.push(
    "Preset selection maps to an existing internal mode and never weakens the safety floor."
  );
  return { allowed: reasons.length === 1, definition, preset, reasons };
}

export function productPresetToPolicyMode(preset: ProductPolicyPreset): PolicyMode {
  return productPolicyPresets[preset].internalMode;
}

export interface VersionedModelProfile {
  readonly profileId: string;
  readonly provider: ProviderFamily;
  readonly modelFamily: string;
  readonly modelVersion: string;
  readonly status: ModelProfileStatus["kind"] | "canary" | "retest_required";
  readonly lastTestedAt: IsoTimestamp;
  readonly expiresAt: IsoTimestamp;
  readonly imageDimensions: ImageDimensionLimits;
  readonly glyphDensity: GlyphDensityProfile;
  readonly languageCoverage: LanguageCoverage;
  readonly imageTokenAccountingRule: ImageTokenAccountingRule;
  readonly scores: ModelProfileScores;
  readonly thresholds: ModelProfileThresholds;
  readonly origin: EvidenceOrigin;
  readonly approval: {
    readonly approvedBy: "synthetic_canary" | "manual_review" | "benchmark";
    readonly approvedAt: IsoTimestamp;
    readonly notes: string;
  };
}

export type CanaryWorkloadKind =
  | "prose"
  | "code_like_structure"
  | "tables"
  | "paths"
  | "uuids"
  | "hashes"
  | "numbers"
  | "mixed_punctuation";

export interface CanaryWorkload {
  readonly kind: CanaryWorkloadKind;
  readonly label: string;
  readonly syntheticOrigin: true;
  readonly content: string;
  readonly expectedFragments: readonly string[];
}

export interface CanaryEvaluationResult {
  readonly profileId: string;
  readonly evaluatedAt: IsoTimestamp;
  readonly passed: boolean;
  readonly scores: ModelProfileScores;
  readonly failedWorkloads: readonly CanaryWorkloadKind[];
  readonly syntheticOrigin: true;
}

export interface ModelProfileRegistry {
  readonly profiles: readonly VersionedModelProfile[];
  findProfile(input: {
    readonly provider: ProviderFamily;
    readonly modelFamily: string;
    readonly modelVersion: string;
    readonly at: IsoTimestamp;
  }): VersionedModelProfile | null;
  resolveStatus(input: {
    readonly provider: ProviderFamily;
    readonly modelFamily: string;
    readonly modelVersion: string;
    readonly at: IsoTimestamp;
    readonly canary?: CanaryEvaluationResult;
  }): ModelProfileStatus;
  getSummary(profileId: string): ModelProfileSummary | null;
}

export interface PolicyBundleSummary {
  readonly policyId: string;
  readonly source: "built_in" | "local_user" | "local_project" | "team" | "organisation";
  readonly version: string;
  readonly mode: ContextDietMode;
  readonly mandatory: boolean;
  readonly origin: EvidenceOrigin;
  readonly expiresAt?: IsoTimestamp;
  readonly signatureStatus?: "not_required" | "verified" | "invalid";
}

export interface UsageHistorySummary {
  readonly historyId: string;
  readonly origin: EvidenceOrigin;
  readonly periodStart: IsoTimestamp;
  readonly periodEnd: IsoTimestamp;
  readonly requestCount: number;
  readonly eligibleTokenEstimate: number;
  readonly cachedTokenEstimate: number;
}

export interface BenchmarkEvidenceSummary {
  readonly evidenceId: string;
  readonly origin: EvidenceOrigin;
  readonly createdAt: IsoTimestamp;
  readonly profileId: string;
  readonly workloadId: string;
  readonly passed: boolean;
  readonly protectedValuesImaged: number;
}

export interface AuditEvent {
  readonly eventId: string;
  readonly timestamp: IsoTimestamp;
  readonly eventType: string;
  readonly origin: EvidenceOrigin;
  readonly reasonCodes: readonly ReasonCode[];
  readonly contentIncluded: false;
}

export interface CompatibilityInput {
  readonly host: "codex" | "claude_code" | "both";
  readonly profile: ModelProfileSummary;
  readonly usageHistory: UsageHistorySummary;
  readonly policy: PolicyBundleSummary;
  readonly exactnessSensitivity: "low" | "medium" | "high" | "critical";
}

export interface CompatibilityReport {
  readonly verdict: CompatibilityVerdict;
  readonly score: number;
  readonly reasons: NonEmptyReadonlyArray<ReasonCode>;
  readonly origin: EvidenceOrigin;
}

export interface SavingsProjectionInput {
  readonly usageHistory: UsageHistorySummary;
  readonly benchmarkEvidence: BenchmarkEvidenceSummary;
  readonly period: "weekly" | "monthly" | "annual";
}

export interface SavingsProjection {
  readonly origin: EvidenceOrigin;
  readonly period: "weekly" | "monthly" | "annual";
  readonly netSavingEstimate: number;
  readonly confidence: "low" | "medium" | "high";
  readonly labelledSynthetic: boolean;
}

export interface RendererHealthReport {
  readonly status: RendererHealthStatus;
  readonly profileId: string;
  readonly checkedAt: IsoTimestamp;
  readonly reasons: NonEmptyReadonlyArray<ReasonCode>;
  readonly origin: EvidenceOrigin;
}

export interface ModelProfileSource {
  getProfile(profileId: string): Promise<ModelProfileSummary | null>;
}

export interface PolicySource {
  getPolicy(policyId: string): Promise<PolicyBundleSummary | null>;
}

export interface UsageHistorySource {
  getUsageHistory(historyId: string): Promise<UsageHistorySummary | null>;
}

export interface BenchmarkEvidenceStore {
  putEvidence(evidence: BenchmarkEvidenceSummary): Promise<void>;
  getEvidence(evidenceId: string): Promise<BenchmarkEvidenceSummary | null>;
}

export interface AuditEventSink {
  append(event: AuditEvent): Promise<void>;
}

export interface CompatibilityEvaluator {
  evaluate(input: CompatibilityInput): Promise<CompatibilityReport>;
}

export interface SavingsProjectionEngine {
  project(input: SavingsProjectionInput): Promise<SavingsProjection>;
}

export interface RendererHealthService {
  check(profile: ModelProfileSummary): Promise<RendererHealthReport>;
}

export type NormalizedRole = "system" | "developer" | "user" | "assistant" | "tool" | "unknown";

export type BlockKind =
  | "text"
  | "image"
  | "tool_call"
  | "tool_result"
  | "json"
  | "binary"
  | "unknown";

export type NormalizedBlock = NormalizedKnownBlock | NormalizedUnknownBlock;

export interface NormalizedKnownBlock extends NormalizedBlockBase {
  readonly kind: Exclude<BlockKind, "unknown">;
  readonly text?: string;
}

export interface NormalizedUnknownBlock extends NormalizedBlockBase {
  readonly kind: "unknown";
  readonly passThrough: OriginalPassThroughFragment;
  readonly decision: Extract<TransformationDecision, { readonly action: "PASS_THROUGH_UNKNOWN" }>;
}

export interface NormalizedBlockBase {
  readonly id: BlockId;
  readonly order: OrderIndex;
  readonly sourceCategory: SourceCategory;
  readonly exactnessRisk: ExactnessRisk;
  readonly recoverability: Recoverability;
  readonly providerMetadata: ProviderMetadata;
  readonly passThrough?: OriginalPassThroughFragment;
  readonly decision: TransformationDecision;
}

export interface NormalizedMessage {
  readonly id: MessageId;
  readonly order: OrderIndex;
  readonly role: NormalizedRole;
  readonly blocks: readonly NormalizedBlock[];
  readonly providerMetadata: ProviderMetadata;
}

export interface NormalizedRequest {
  readonly id: RequestId;
  readonly provider: ProviderFamily;
  readonly mode: ContextDietMode;
  readonly messages: readonly NormalizedMessage[];
  readonly providerMetadata: ProviderMetadata;
}

export interface ProviderMetadata {
  readonly provider: ProviderFamily;
  readonly endpoint?: string;
  readonly model?: string;
  readonly streaming?: boolean;
  readonly cacheSensitive?: boolean;
  readonly preservedHeaders: readonly string[];
  readonly rawShape: "openai_responses" | "anthropic_messages" | "unknown";
}

export interface OriginalPassThroughFragment {
  readonly encoding: "json";
  readonly raw: JsonValue;
  readonly integrity: {
    readonly algorithm: "sha256";
    readonly digest: string;
  };
}

export interface RecoverableVaultScope {
  readonly projectId: string;
  readonly sessionId: string;
  readonly blockId: BlockId;
}

export type RequestId = BrandedString<"RequestId">;
export type MessageId = BrandedString<"MessageId">;
export type BlockId = BrandedString<"BlockId">;
export type OrderIndex = Brand<number, "OrderIndex">;
export type IsoTimestamp = BrandedString<"IsoTimestamp">;

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

type BrandedString<Name extends string> = Brand<string, Name>;

type Brand<T, Name extends string> = T & { readonly __brand: Name };

export const reasonCatalogue = {
  current_context: {
    code: "current_context",
    group: "current_context",
    title: "Current context",
    cliText: "Kept because it is current context needed for the next action.",
    dashboardText: "Current task context stays native."
  },
  exact_value: {
    code: "exact_value",
    group: "exact_value",
    title: "Exact value",
    cliText: "Kept because exact characters, numbers, paths or IDs may matter.",
    dashboardText: "Exact values are protected from lossy conversion."
  },
  code_or_command: {
    code: "code_or_command",
    group: "code_or_command",
    title: "Code or command",
    cliText: "Kept because code, commands, patches or queries must remain exact.",
    dashboardText: "Executable or patchable content stays as text."
  },
  secret_sensitive: {
    code: "secret_sensitive",
    group: "secret_sensitive",
    title: "Secret-sensitive",
    cliText: "Protected because it may contain a secret or credential.",
    dashboardText: "Secret-sensitive content is not render-eligible."
  },
  unknown_risk: {
    code: "unknown_risk",
    group: "unknown_risk",
    title: "Unknown risk",
    cliText: "Kept because the safety risk could not be established.",
    dashboardText: "Unknown-risk content is passed through conservatively."
  },
  unsupported_format: {
    code: "unsupported_format",
    group: "unsupported_format",
    title: "Unsupported format",
    cliText: "Kept because the content format is not supported yet.",
    dashboardText: "Unsupported formats remain unchanged."
  },
  unsupported_glyphs: {
    code: "unsupported_glyphs",
    group: "unsupported_glyphs",
    title: "Unsupported glyphs",
    cliText: "Kept because glyph coverage is uncertain.",
    dashboardText: "Text with uncertain glyph coverage stays native."
  },
  profile_disabled: {
    code: "profile_disabled",
    group: "profile_disabled_or_expired",
    title: "Profile disabled",
    cliText: "Kept because the model profile is disabled.",
    dashboardText: "Disabled model profiles prevent conversion."
  },
  profile_expired: {
    code: "profile_expired",
    group: "profile_disabled_or_expired",
    title: "Profile expired",
    cliText: "Kept because the model profile has expired and needs revalidation.",
    dashboardText: "Expired profiles require fresh validation."
  },
  unprofitable_conversion: {
    code: "unprofitable_conversion",
    group: "unprofitable_conversion",
    title: "Unprofitable conversion",
    cliText: "Kept because conversion is not expected to produce a meaningful saving.",
    dashboardText: "Conversion was skipped because expected savings were too low."
  },
  renderer_failure: {
    code: "renderer_failure",
    group: "renderer_failure",
    title: "Renderer failure",
    cliText: "Passed through because rendering failed.",
    dashboardText: "Renderer failure caused original content to be preserved."
  },
  vault_unavailable: {
    code: "vault_unavailable",
    group: "vault_unavailable",
    title: "Vault unavailable",
    cliText: "Kept because recoverable storage is unavailable.",
    dashboardText: "Vault unavailability disables recoverable conversion."
  },
  user_keep_native: {
    code: "user_keep_native",
    group: "user_override",
    title: "User override: keep native",
    cliText: "Kept because the user requested native text.",
    dashboardText: "User override kept this content native."
  },
  user_allow_transform: {
    code: "user_allow_transform",
    group: "user_override",
    title: "User override: allow transform",
    cliText: "Eligible because the user allowed transformation.",
    dashboardText: "User override allowed this content to be considered."
  },
  stale_duplicate: {
    code: "stale_duplicate",
    group: "stale_duplicate",
    title: "Stale duplicate",
    cliText: "Reduced because the content is stale or duplicated.",
    dashboardText: "Stale duplicate content can be reduced when safe."
  },
  eligible_gist_safe: {
    code: "eligible_gist_safe",
    group: "eligible_gist_safe",
    title: "Eligible gist-safe content",
    cliText: "Eligible because meaning matters more than exact characters.",
    dashboardText: "Gist-safe content may be transformed when recoverable and worthwhile."
  },
  safe_mode: {
    code: "safe_mode",
    group: "system_safety",
    title: "Safe mode",
    cliText: "Safe mode selected the conservative action.",
    dashboardText: "Safe mode applies conservative defaults."
  },
  recoverable: {
    code: "recoverable",
    group: "recoverability",
    title: "Recoverable",
    cliText: "Allowed because exact original content can be recovered.",
    dashboardText: "Recovery is available through an authorised local reference."
  },
  unknown_shape: {
    code: "unknown_shape",
    group: "unknown_risk",
    title: "Unknown shape",
    cliText: "Passed through because the provider shape is unknown.",
    dashboardText: "Unknown provider shapes are preserved unchanged."
  },
  transport_feasibility: {
    code: "transport_feasibility",
    group: "transport",
    title: "Transport feasibility",
    cliText: "Used for fake transport feasibility checks.",
    dashboardText: "Transport spike metadata only; no production optimisation was applied."
  }
} as const satisfies { readonly [Code in ReasonCode]: ReasonDefinition & { readonly code: Code } };

export const decisionDefaultReasons = {
  KEEP_NATIVE: ["safe_mode"],
  REDACT_AND_KEEP: ["secret_sensitive"],
  REDACT_AND_RENDER: ["secret_sensitive", "recoverable"],
  RENDER_RECOVERABLE: ["eligible_gist_safe", "recoverable"],
  REFERENCE_ONLY: ["recoverable"],
  DEDUPLICATE: ["stale_duplicate"],
  DROP_STALE: ["stale_duplicate"],
  PASS_THROUGH_UNKNOWN: ["unknown_shape"]
} as const satisfies { readonly [Action in DecisionAction]: NonEmptyReadonlyArray<ReasonCode> };

export function requestId(value: string): RequestId {
  return brandNonEmptyString(value, "request id") as RequestId;
}

export function messageId(value: string): MessageId {
  return brandNonEmptyString(value, "message id") as MessageId;
}

export function blockId(value: string): BlockId {
  return brandNonEmptyString(value, "block id") as BlockId;
}

export function orderIndex(value: number): OrderIndex {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("order index must be a non-negative integer");
  }
  return value as OrderIndex;
}

export function isoTimestamp(value: string): IsoTimestamp {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("timestamp must be an ISO-8601 UTC timestamp");
  }
  return value as IsoTimestamp;
}

export function createProviderMetadata(
  provider: ProviderFamily,
  rawShape: ProviderMetadata["rawShape"],
  options: {
    readonly endpoint?: string;
    readonly model?: string;
    readonly streaming?: boolean;
    readonly cacheSensitive?: boolean;
    readonly preservedHeaders?: readonly string[];
  } = {}
): ProviderMetadata {
  return {
    provider,
    rawShape,
    preservedHeaders: options.preservedHeaders ?? [],
    ...(options.endpoint === undefined ? {} : { endpoint: options.endpoint }),
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.streaming === undefined ? {} : { streaming: options.streaming }),
    ...(options.cacheSensitive === undefined ? {} : { cacheSensitive: options.cacheSensitive })
  };
}

export function keepNativeDecision(
  reasonCodes: NonEmptyReadonlyArray<ReasonCode>
): Extract<TransformationDecision, { readonly action: "KEEP_NATIVE" }> {
  return { action: "KEEP_NATIVE", reasonCodes };
}

export function passThroughUnknownDecision(): Extract<
  TransformationDecision,
  { readonly action: "PASS_THROUGH_UNKNOWN" }
> {
  return { action: "PASS_THROUGH_UNKNOWN", reasonCodes: ["unknown_shape"] };
}

export function createDecisionRecord(input: {
  readonly blockId: BlockId;
  readonly decision: TransformationDecision;
  readonly policyMode: PolicyMode;
  readonly timestamp: IsoTimestamp;
  readonly profileId?: string;
  readonly originalContentPreserved: boolean;
  readonly recoveryAvailable: boolean;
}): DecisionRecord {
  assertNonEmptyReasons(input.decision.reasonCodes);
  return {
    blockId: input.blockId,
    decision: input.decision.action,
    reasons: input.decision.reasonCodes,
    policyMode: input.policyMode,
    timestamp: input.timestamp,
    originalContentPreserved: input.originalContentPreserved,
    recoveryAvailable: input.recoveryAvailable,
    ...(input.profileId === undefined ? {} : { profileId: input.profileId })
  };
}

export function evaluatePolicyDecision(input: PolicyEvaluationInput): DecisionRecord {
  const decision = selectTransformationDecision(input);
  return createDecisionRecord({
    blockId: input.block.id,
    decision,
    policyMode: input.mode,
    timestamp: input.timestamp,
    profileId: input.modelProfileStatus.profileId,
    originalContentPreserved: originalContentIsPreserved(decision),
    recoveryAvailable: input.recoverability.kind === "recoverable"
  });
}

export function explainReasonForCli(reason: ReasonCode): string {
  return reasonCatalogue[reason].cliText;
}

export function explainReasonForDashboard(reason: ReasonCode): string {
  return reasonCatalogue[reason].dashboardText;
}

export function explainDecisionRecordForCli(record: DecisionRecord): string {
  const reasonText = record.reasons.map(explainReasonForCli).join(" ");
  return `${record.decision} for ${record.blockId}: ${reasonText}`;
}

export function notRecoverable(
  reason: ReasonCode
): Extract<Recoverability, { kind: "not_recoverable" }> {
  return { kind: "not_recoverable", reason };
}

export function recoverable(
  projectId: string,
  sessionId: string,
  recoverableBlockId: BlockId
): Extract<Recoverability, { kind: "recoverable" }> {
  return {
    kind: "recoverable",
    vaultScope: { projectId, sessionId, blockId: recoverableBlockId }
  };
}

export function createTextBlock(input: {
  readonly id: BlockId;
  readonly order: OrderIndex;
  readonly text: string;
  readonly sourceCategory: SourceCategory;
  readonly exactnessRisk: ExactnessRisk;
  readonly recoverability: Recoverability;
  readonly providerMetadata: ProviderMetadata;
  readonly decision: TransformationDecision;
  readonly passThrough?: OriginalPassThroughFragment;
}): NormalizedKnownBlock {
  return {
    exactnessRisk: input.exactnessRisk,
    id: input.id,
    kind: "text",
    order: input.order,
    providerMetadata: input.providerMetadata,
    recoverability: input.recoverability,
    sourceCategory: input.sourceCategory,
    text: input.text,
    decision: input.decision,
    ...(input.passThrough === undefined ? {} : { passThrough: input.passThrough })
  };
}

export function createUnknownBlock(input: {
  readonly id: BlockId;
  readonly order: OrderIndex;
  readonly sourceCategory: SourceCategory;
  readonly exactnessRisk: ExactnessRisk;
  readonly recoverability: Recoverability;
  readonly providerMetadata: ProviderMetadata;
  readonly passThrough: OriginalPassThroughFragment;
}): NormalizedUnknownBlock {
  return {
    decision: passThroughUnknownDecision(),
    exactnessRisk: input.exactnessRisk,
    id: input.id,
    kind: "unknown",
    order: input.order,
    passThrough: input.passThrough,
    providerMetadata: input.providerMetadata,
    recoverability: input.recoverability,
    sourceCategory: input.sourceCategory
  };
}

export function createMessage(input: {
  readonly id: MessageId;
  readonly order: OrderIndex;
  readonly role: NormalizedRole;
  readonly blocks: readonly NormalizedBlock[];
  readonly providerMetadata: ProviderMetadata;
}): NormalizedMessage {
  return {
    blocks: sortByOrder(input.blocks),
    id: input.id,
    order: input.order,
    providerMetadata: input.providerMetadata,
    role: input.role
  };
}

export function createNormalizedRequest(input: {
  readonly id: RequestId;
  readonly provider: ProviderFamily;
  readonly messages: readonly NormalizedMessage[];
  readonly providerMetadata: ProviderMetadata;
  readonly mode?: ContextDietMode;
}): NormalizedRequest {
  return {
    id: input.id,
    messages: sortByOrder(input.messages),
    mode: input.mode ?? "safe",
    provider: input.provider,
    providerMetadata: input.providerMetadata
  };
}

export function createModelProfileRegistry(
  profiles: readonly VersionedModelProfile[]
): ModelProfileRegistry {
  const stableProfiles = [...profiles].sort((left, right) =>
    left.profileId.localeCompare(right.profileId)
  );
  return {
    profiles: stableProfiles,
    findProfile: (input) =>
      stableProfiles.find(
        (profile) =>
          profile.provider === input.provider &&
          profile.modelFamily === input.modelFamily &&
          profile.modelVersion === input.modelVersion &&
          profile.status !== "disabled" &&
          profile.status !== "retest_required" &&
          profile.status !== "canary" &&
          !profileIsExpired(profile, input.at)
      ) ?? null,
    resolveStatus: (input) => {
      const profile = stableProfiles.find(
        (candidate) =>
          candidate.provider === input.provider &&
          candidate.modelFamily === input.modelFamily &&
          candidate.modelVersion === input.modelVersion
      );
      if (profile === undefined) {
        return { kind: "disabled", profileId: unknownProfileId(input) };
      }
      if (profileIsExpired(profile, input.at)) {
        return { kind: "expired", profileId: profile.profileId };
      }
      if (profile.status !== "enabled") {
        return { kind: "disabled", profileId: profile.profileId };
      }
      if (profileScoresPass(profile.scores, profile.thresholds) !== true) {
        return { kind: "disabled", profileId: profile.profileId };
      }
      if (input.canary !== undefined && canaryPassesProfile(profile, input.canary) !== true) {
        return { kind: "disabled", profileId: profile.profileId };
      }
      return { kind: "enabled", profileId: profile.profileId };
    },
    getSummary: (profileId) => {
      const profile = stableProfiles.find((candidate) => candidate.profileId === profileId);
      if (profile === undefined) {
        return null;
      }
      return summarizeModelProfile(profile);
    }
  };
}

export function createSyntheticCanaryWorkloads(): readonly CanaryWorkload[] {
  return [
    {
      kind: "prose",
      label: "Synthetic prose",
      syntheticOrigin: true,
      content: "A calm paragraph explains a local cache without requiring exact wording.",
      expectedFragments: ["local cache", "exact wording"]
    },
    {
      kind: "code_like_structure",
      label: "Synthetic code-like structure",
      syntheticOrigin: true,
      content: "function fakeExample(input) { return input.value ?? 'fallback'; }",
      expectedFragments: ["function", "fallback"]
    },
    {
      kind: "tables",
      label: "Synthetic table",
      syntheticOrigin: true,
      content: "| name | count |\n| alpha | 12 |\n| beta | 34 |",
      expectedFragments: ["alpha", "34"]
    },
    {
      kind: "paths",
      label: "Synthetic paths",
      syntheticOrigin: true,
      content: "/tmp/context-diet/synthetic-file.ts and C:\\temp\\synthetic-file.ts",
      expectedFragments: ["/tmp/context-diet", "C:\\temp"]
    },
    {
      kind: "uuids",
      label: "Synthetic UUIDs",
      syntheticOrigin: true,
      content: "00000000-1111-2222-3333-444444444444",
      expectedFragments: ["00000000-1111-2222-3333-444444444444"]
    },
    {
      kind: "hashes",
      label: "Synthetic hashes",
      syntheticOrigin: true,
      content: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedFragments: ["sha256:", "aaaaaaaa"]
    },
    {
      kind: "numbers",
      label: "Synthetic numbers",
      syntheticOrigin: true,
      content: "42 files, 19.5 ms, $12.34, and 87%",
      expectedFragments: ["42", "19.5", "$12.34", "87%"]
    },
    {
      kind: "mixed_punctuation",
      label: "Synthetic mixed punctuation",
      syntheticOrigin: true,
      content: "alpha_beta::gamma/delta?x=1&y=(2)[3]{4}",
      expectedFragments: ["alpha_beta::gamma", "(2)[3]{4}"]
    }
  ];
}

export function evaluateSyntheticCanaries(input: {
  readonly profile: VersionedModelProfile;
  readonly observedFragmentsByKind: Readonly<Record<CanaryWorkloadKind, readonly string[]>>;
  readonly evaluatedAt: IsoTimestamp;
  readonly workloads?: readonly CanaryWorkload[];
}): CanaryEvaluationResult {
  const workloads = input.workloads ?? createSyntheticCanaryWorkloads();
  const failedWorkloads = workloads
    .filter((workload) => {
      const observed = input.observedFragmentsByKind[workload.kind];
      return workload.expectedFragments.some((fragment) => !observed.includes(fragment));
    })
    .map((workload) => workload.kind);
  const coverage = (workloads.length - failedWorkloads.length) / workloads.length;
  const exactFailures = failedWorkloads.filter((kind) =>
    ["paths", "uuids", "hashes", "numbers", "mixed_punctuation"].includes(kind)
  ).length;
  const structureFailures = failedWorkloads.filter((kind) =>
    ["code_like_structure", "tables"].includes(kind)
  ).length;
  const scores = {
    gist: Math.round(coverage * 100),
    structure: Math.round(((workloads.length - structureFailures) / workloads.length) * 100),
    exactString: Math.round(((workloads.length - exactFailures) / workloads.length) * 100)
  };

  return {
    profileId: input.profile.profileId,
    evaluatedAt: input.evaluatedAt,
    passed: failedWorkloads.length === 0 && profileScoresPass(scores, input.profile.thresholds),
    scores,
    failedWorkloads,
    syntheticOrigin: true
  };
}

export function sortByOrder<T extends { readonly order: OrderIndex }>(
  items: readonly T[]
): readonly T[] {
  return [...items].sort((left, right) => left.order - right.order);
}

function selectTransformationDecision(input: PolicyEvaluationInput): TransformationDecision {
  if (input.mode === "bypass") {
    return keepNativeDecision(["user_keep_native"]);
  }
  if (input.block.kind === "unknown") {
    return passThroughUnknownDecision();
  }
  if (input.scannerResult.riskClass === "secret_sensitive") {
    return {
      action: "REDACT_AND_KEEP",
      reasonCodes: mergeReasonCodes(["secret_sensitive"], input)
    };
  }
  if (input.scannerResult.riskClass === "unknown_risk") {
    return keepNativeDecision(mergeReasonCodes(["unknown_risk"], input));
  }
  if (input.modelProfileStatus.kind === "disabled") {
    return keepNativeDecision(mergeReasonCodes(["profile_disabled"], input));
  }
  if (input.modelProfileStatus.kind === "expired") {
    return keepNativeDecision(mergeReasonCodes(["profile_expired"], input));
  }
  if (input.rendererResult?.status === "failed") {
    return keepNativeDecision(mergeReasonCodes([input.rendererResult.reason], input));
  }
  if (safeModeBlocks(input)) {
    return keepNativeDecision(mergeReasonCodes(safeModeBlockReasons(input), input));
  }
  if (input.taskExactnessRequirement === "exact_required") {
    return keepNativeDecision(mergeReasonCodes(["exact_value"], input));
  }
  if (input.recoverability.kind !== "recoverable") {
    return keepNativeDecision(mergeReasonCodes([input.recoverability.reason], input));
  }
  if (!input.scannerResult.renderEligible) {
    return keepNativeDecision(mergeReasonCodes(input.scannerResult.reasonCodes, input));
  }
  if (netSaving(input.estimatedCost) <= 0) {
    return keepNativeDecision(mergeReasonCodes(["unprofitable_conversion"], input));
  }
  if (!modeAllowsRisk(input.mode, input.scannerResult.riskClass, input.taskExactnessRequirement)) {
    return keepNativeDecision(mergeReasonCodes(input.scannerResult.reasonCodes, input));
  }
  return {
    action: "RENDER_RECOVERABLE",
    reasonCodes: mergeReasonCodes(["eligible_gist_safe", "recoverable"], input),
    recoverability: input.recoverability
  };
}

function safeModeBlocks(input: PolicyEvaluationInput): boolean {
  return (
    input.mode === "safe" &&
    (input.sourceCategory === "current_instruction" ||
      input.sourceCategory === "tool_call" ||
      input.sourceCategory === "source_code" ||
      input.scannerResult.riskClass === "structure_sensitive" ||
      input.scannerResult.riskClass === "verbatim_critical")
  );
}

function safeModeBlockReasons(input: PolicyEvaluationInput): NonEmptyReadonlyArray<ReasonCode> {
  if (input.sourceCategory === "current_instruction") {
    return ["current_context"];
  }
  if (input.sourceCategory === "source_code" || input.sourceCategory === "tool_call") {
    return ["code_or_command"];
  }
  if (input.scannerResult.riskClass === "verbatim_critical") {
    return ["code_or_command"];
  }
  return ["exact_value"];
}

function modeAllowsRisk(
  mode: Exclude<PolicyMode, "bypass">,
  risk: ExactnessRisk,
  exactness: TaskExactnessRequirement
): boolean {
  if (risk === "secret_sensitive" || risk === "unknown_risk") {
    return false;
  }
  if (exactness === "exact_required") {
    return false;
  }
  if (mode === "safe") {
    return risk === "gist_safe" && exactness === "gist_ok";
  }
  if (mode === "balanced") {
    return risk === "gist_safe" || (risk === "structure_sensitive" && exactness === "gist_ok");
  }
  return risk === "gist_safe" || risk === "structure_sensitive";
}

function netSaving(cost: PolicyCostEstimate): number {
  return cost.textCost - cost.imageCost - cost.sidecarCost;
}

function mergeReasonCodes(
  primary: NonEmptyReadonlyArray<ReasonCode>,
  input: PolicyEvaluationInput
): NonEmptyReadonlyArray<ReasonCode> {
  const reasons = new Set<ReasonCode>(primary);
  for (const reason of input.scannerResult.reasonCodes) {
    reasons.add(reason);
  }
  if (input.mode === "safe") {
    reasons.add("safe_mode");
  }
  if (input.recoverability.kind === "recoverable") {
    reasons.add("recoverable");
  }
  return toNonEmptyReasons(Array.from(reasons));
}

function originalContentIsPreserved(decision: TransformationDecision): boolean {
  return (
    decision.action === "KEEP_NATIVE" ||
    decision.action === "REDACT_AND_KEEP" ||
    decision.action === "PASS_THROUGH_UNKNOWN" ||
    decision.action === "RENDER_RECOVERABLE" ||
    decision.action === "REFERENCE_ONLY"
  );
}

function summarizeModelProfile(profile: VersionedModelProfile): ModelProfileSummary {
  return {
    profileId: profile.profileId,
    provider: profile.provider,
    modelFamily: profile.modelFamily,
    modelVersion: profile.modelVersion,
    status: profile.status,
    origin: profile.origin,
    issuedAt: profile.lastTestedAt,
    expiresAt: profile.expiresAt,
    signatureStatus: "not_required"
  };
}

function profileIsExpired(profile: VersionedModelProfile, at: IsoTimestamp): boolean {
  return Date.parse(profile.expiresAt) <= Date.parse(at);
}

function profileScoresPass(
  scores: ModelProfileScores,
  thresholds: ModelProfileThresholds
): boolean {
  return (
    scores.gist >= thresholds.minimumGist &&
    scores.structure >= thresholds.minimumStructure &&
    scores.exactString >= thresholds.minimumExactString
  );
}

function canaryPassesProfile(
  profile: VersionedModelProfile,
  canary: CanaryEvaluationResult
): boolean {
  return (
    canary.profileId === profile.profileId &&
    canary.passed === true &&
    profileScoresPass(canary.scores, profile.thresholds)
  );
}

function unknownProfileId(input: {
  readonly provider: ProviderFamily;
  readonly modelFamily: string;
  readonly modelVersion: string;
}): string {
  return `unknown:${input.provider}:${input.modelFamily}:${input.modelVersion}`;
}

function assertNonEmptyReasons(
  reasons: readonly ReasonCode[]
): asserts reasons is NonEmptyReadonlyArray<ReasonCode> {
  if (reasons.length === 0) {
    throw new Error("decision must include at least one reason");
  }
}

function toNonEmptyReasons(reasons: readonly ReasonCode[]): NonEmptyReadonlyArray<ReasonCode> {
  const [first, ...rest] = reasons;
  if (first === undefined) {
    throw new Error("expected at least one reason code");
  }
  return [first, ...rest];
}

function brandNonEmptyString(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value;
}
