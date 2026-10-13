import { createHash } from "node:crypto";
import { openAICanaryOutputLimit } from "@fixel-recall/providers-openai";
import { anthropicCanaryOutputLimit } from "@fixel-recall/providers-anthropic";

export interface CanaryLimits {
  readonly provider: "openai" | "anthropic";
  readonly model: string;
  readonly maxRequestBytes: number;
  readonly maxOutputTokens: number;
  readonly maxCostUsd: number;
  /** Trusted operator-reviewed evidence, never supplied by the incoming client. */
  readonly evidence?: {
    readonly requestSha256: string;
    readonly inputTokenUpperBound: number;
    readonly inputUsdPerMillion: number;
    readonly outputUsdPerMillion: number;
    readonly outputLimitVerified: boolean;
    readonly expiresAtMs: number;
  };
}

export class CanaryAdmissionError extends Error {
  constructor(readonly code: string) {
    super("Canary request blocked before forwarding; review local budget evidence");
  }
}

/** Reserves one request before fetch; failures and runtime resume never refund it. */
export function createCanaryAdmission(limits: CanaryLimits) {
  const config = structuredClone(limits);
  if (
    !["openai", "anthropic"].includes(config.provider) ||
    !config.model ||
    !Number.isSafeInteger(config.maxRequestBytes) ||
    config.maxRequestBytes < 1 ||
    !Number.isSafeInteger(config.maxOutputTokens) ||
    config.maxOutputTokens < 1 ||
    !Number.isFinite(config.maxCostUsd) ||
    config.maxCostUsd <= 0 ||
    config.maxCostUsd > 0.1
  )
    throw new Error("Invalid canary limits");
  let reserved = false;
  return (provider: string, mode: string, body: Buffer): void => {
    const deny = (code: string): never => {
      throw new CanaryAdmissionError(code);
    };
    if (mode !== "safe") deny("canary_safe_mode_required");
    if (provider !== config.provider) deny("canary_provider_mismatch");
    if (reserved) deny("canary_request_limit");
    if (body.length > config.maxRequestBytes) deny("canary_request_size_limit");
    const parsed: unknown = JSON.parse(body.toString("utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      deny("canary_invalid_request");
    const request = parsed as Record<string, unknown>;
    if (request["model"] !== config.model) deny("canary_model_mismatch");
    const output =
      config.provider === "openai"
        ? openAICanaryOutputLimit(request)
        : anthropicCanaryOutputLimit(request);
    if (
      typeof output !== "number" ||
      !Number.isSafeInteger(output) ||
      output < 1 ||
      output > config.maxOutputTokens
    )
      deny("canary_output_limit_required");
    const evidence = config.evidence;
    if (
      !evidence ||
      evidence.outputLimitVerified !== true ||
      evidence.expiresAtMs <= Date.now() ||
      !Number.isFinite(evidence.expiresAtMs)
    )
      deny("canary_budget_evidence_required");
    if (!evidence) return;
    if (createHash("sha256").update(body).digest("hex") !== evidence.requestSha256)
      deny("canary_request_not_approved");
    if (
      !Number.isSafeInteger(evidence.inputTokenUpperBound) ||
      evidence.inputTokenUpperBound < 1 ||
      !Number.isFinite(evidence.inputUsdPerMillion) ||
      evidence.inputUsdPerMillion <= 0 ||
      !Number.isFinite(evidence.outputUsdPerMillion) ||
      evidence.outputUsdPerMillion <= 0
    )
      deny("canary_budget_evidence_required");
    const upperCost =
      (evidence.inputTokenUpperBound * evidence.inputUsdPerMillion +
        config.maxOutputTokens * evidence.outputUsdPerMillion) /
      1_000_000;
    if (!Number.isFinite(upperCost) || upperCost > config.maxCostUsd) deny("canary_cost_limit");
    reserved = true;
  };
}
