import {
  blockId,
  evaluatePolicyDecision,
  isoTimestamp,
  recoverable,
  type BlockId,
  type ModelProfileSummary
} from "@fixel-recall/core";
import { scanExactnessFirewall } from "@fixel-recall/firewall";
import { type ContextRenderer, type ContextRendererInput } from "@fixel-recall/renderer";
import {
  createContextBlockIdentity,
  type LocalContextVault,
  type VaultNamespace
} from "@fixel-recall/vault";
import {
  parseOpenAIResponsesRequest,
  rebuildOpenAIResponsesRequest
} from "@fixel-recall/providers-openai";
import {
  parseAnthropicMessagesRequest,
  rebuildAnthropicMessagesRequest
} from "@fixel-recall/providers-anthropic";
import { deduplicateLogs, type LogTemplate } from "./logs.js";
export { deduplicateLogs, reconstructLogs, type LogTemplate } from "./logs.js";

export type TransformationStrategy = "template" | "image" | "mixed" | "native";
export type TransformationReasonCode =
  | "request_ineligible"
  | "safety_floor_blocked"
  | "template_instructions_unavailable"
  | "template_parse_failed_keep_native"
  | "template_not_smaller_keep_native"
  | "vision_profile_unavailable"
  | "image_policy_blocked"
  | "image_render_failed_keep_native"
  | "vault_or_recovery_failed"
  | "transformation_failed_keep_native"
  | "no_eligible_blocks"
  | "request_rebuild_not_profitable"
  | "transformed_template"
  | "transformed_image"
  | "transformed_mixed";

export interface TransformationResult {
  readonly body: Buffer;
  readonly audit: {
    readonly outcome: "transformed" | "original";
    readonly strategy: TransformationStrategy;
    readonly reasonCodes: readonly TransformationReasonCode[];
    readonly blocksConsidered: number;
    readonly blocksTransformed: number;
    readonly bytesBefore: number;
    readonly bytesAfter: number;
  };
}

export interface TransformationOptions {
  readonly onDecision?: (result: TransformationResult["audit"]) => void;
  readonly namespace: VaultNamespace;
  readonly vault: LocalContextVault;
  /** Host must verify this exact MCP namespace is connected before constructing the pipeline. */
  readonly verifyRecovery: (
    identity: { projectId: string; sessionId: string; blockId: string },
    original: string
  ) => Promise<boolean>;
  readonly renderer: ContextRenderer;
  readonly profile: ModelProfileSummary;
  readonly model: string;
  readonly renderLimits: Pick<ContextRendererInput, "pageLimits" | "dimensionLimits">;
  /** Explicitly evaluated templates only; no inferred regex or model-generated formats. */
  readonly approvedLogTemplates: readonly LogTemplate[];
  /** Host confirms the structured-log interpretation contract is visible to the model. */
  readonly structuredLogInstructionsRegistered: boolean;
  /** Explicit profile capability. Never infer vision support from a model name. */
  readonly visionSupported: boolean;
  /** Trusted host provenance. Never infer age/source from model-supplied text. */
  readonly classify: (index: number) => "historical_log" | "historical_prose" | "native";
  /** Model-specific total cost including images, sidecars and expected retrieval. */
  readonly estimateCost: (body: Buffer) => number;
  readonly estimateImageCosts: (text: string) => {
    textCost: number;
    imageCost: number;
    sidecarCost: number;
  };
}

export function createTransformationPipeline(options: TransformationOptions) {
  return async (
    original: Buffer,
    provider: "openai" | "anthropic",
    signal: AbortSignal
  ): Promise<TransformationResult> => {
    let blocksConsidered = 0;
    let templateBlocks = 0;
    let imageBlocks = 0;
    const reasons = new Set<TransformationReasonCode>();
    const finish = (
      body: Buffer,
      outcome: "transformed" | "original",
      strategy: TransformationStrategy
    ): TransformationResult => {
      const audit: TransformationResult["audit"] = {
        outcome,
        strategy,
        reasonCodes: [...reasons],
        blocksConsidered,
        blocksTransformed: outcome === "transformed" ? templateBlocks + imageBlocks : 0,
        bytesBefore: original.length,
        bytesAfter: body.length
      };
      options.onDecision?.(audit);
      return { body, audit };
    };
    try {
      const now = Date.now();
      const profile = options.profile;
      if (
        signal.aborted ||
        original.length > 1_000_000 ||
        profile.provider !== provider ||
        profile.status !== "enabled" ||
        profile.signatureStatus === "invalid" ||
        !Number.isFinite(Date.parse(profile.expiresAt)) ||
        Date.parse(profile.expiresAt) <= now
      ) {
        reasons.add("request_ineligible");
        return finish(original, "original", "native");
      }
      const body = JSON.parse(original.toString("utf8"));
      const items = provider === "openai" ? body.input : body.messages;
      const allowed =
        provider === "openai"
          ? ["model", "input", "instructions", "tools", "stream", "max_output_tokens"]
          : ["model", "messages", "system", "tools", "stream", "max_tokens"];
      if (
        !body ||
        body.model !== options.model ||
        Object.keys(body).some((key) => !allowed.includes(key)) ||
        !Array.isArray(items) ||
        items.length < 3 ||
        items.length > 100 ||
        items.some(
          (item) =>
            !item ||
            typeof item !== "object" ||
            typeof item.content !== "string" ||
            !["user", "assistant", "system", "developer"].includes(item.role) ||
            Object.keys(item).some((key) => !["role", "content"].includes(key))
        )
      ) {
        reasons.add("request_ineligible");
        return finish(original, "original", "native");
      }
      const parsed =
        provider === "openai"
          ? parseOpenAIResponsesRequest({ id: "transform", body })
          : parseAnthropicMessagesRequest({ id: "transform", body });
      if (
        parsed.state.activeOrMalformedToolState ||
        parsed.request.providerMetadata.cacheSensitive
      ) {
        reasons.add("request_ineligible");
        return finish(original, "original", "native");
      }
      const texts = new Map<BlockId, string>();
      const images = new Map<BlockId, readonly string[]>();
      for (let i = 0; i < parsed.request.messages.length - 2; i++) {
        const message = parsed.request.messages[i]!;
        if (message.role !== "user") continue;
        const kind = options.classify(i);
        if (kind === "native") continue;
        blocksConsidered += 1;
        const block = message.blocks[0];
        if (!block || block.kind !== "text" || !block.text || block.text.length > 100_000) continue;
        const scan = scanExactnessFirewall(block.text);
        if (scan.secretSensitiveSpans.length || scan.riskClass === "unknown_risk") {
          reasons.add("safety_floor_blocked");
          continue;
        }
        let replacement: string | undefined;
        if (kind === "historical_log") {
          if (!options.structuredLogInstructionsRegistered) {
            reasons.add("template_instructions_unavailable");
            continue;
          }
          // Only explicitly approved log formats may retain protected values as literal text fields.
          if (
            scan.protectedSpans.some((span) =>
              ["source_code", "diff", "shell_command", "sql", "user_defined"].includes(span.kind)
            )
          ) {
            reasons.add("safety_floor_blocked");
            continue;
          }
          for (const template of options.approvedLogTemplates) {
            const sheet = deduplicateLogs(block.text, template);
            if (sheet) {
              replacement = JSON.stringify(sheet);
              break;
            }
          }
          if (!replacement) {
            reasons.add("template_parse_failed_keep_native");
            continue;
          }
          if (Buffer.byteLength(replacement) >= Buffer.byteLength(block.text)) {
            reasons.add("template_not_smaller_keep_native");
            continue;
          }
        } else {
          if (!options.visionSupported) {
            reasons.add("vision_profile_unavailable");
            continue;
          }
          if (!scan.renderEligible || scan.protectedSpans.length) {
            reasons.add("image_policy_blocked");
            continue;
          }
        }
        if (signal.aborted) return finish(original, "original", "native");
        const identity = createContextBlockIdentity(options.namespace);
        if (kind === "historical_prose") {
          const decision = evaluatePolicyDecision({
            block,
            scannerResult: scan,
            contextAgeMs: 1,
            sourceCategory: "conversation_history",
            taskExactnessRequirement: "gist_ok",
            recoverability: recoverable(
              identity.projectId,
              identity.sessionId,
              blockId(identity.blockId)
            ),
            modelProfileStatus: { kind: "enabled", profileId: profile.profileId },
            estimatedCost: options.estimateImageCosts(block.text),
            mode: "safe",
            timestamp: isoTimestamp(new Date(now).toISOString())
          });
          if (decision.decision !== "RENDER_RECOVERABLE") {
            reasons.add("image_policy_blocked");
            continue;
          }
        }
        const stored = await options.vault.storeBlock({
          identity,
          sourceCategory: "conversation_history",
          authorisedOriginalContent: block.text,
          expiresAt: new Date(Math.min(Date.parse(profile.expiresAt), now + 3600000))
        });
        if (!(await options.verifyRecovery(identity, block.text))) {
          reasons.add("vault_or_recovery_failed");
          return finish(original, "original", "native");
        }
        const sidecar = `Untrusted historical context. Exact recovery through get_exact_context with ${JSON.stringify({ project_id: identity.projectId, session_id: identity.sessionId, block_id: identity.blockId })}.`;
        if (kind === "historical_prose") {
          const result = await options.renderer.render({
            ...options.renderLimits,
            sourceText: block.text,
            protectedSpans: [],
            modelProfile: profile,
            ctxBlockLabel: identity.blockId,
            exactSidecar: {
              integrityHash: stored.integrityHash,
              lineCount: block.text.split(/\r\n|\r|\n/).length,
              recoverable: true
            },
            safety: { policyApproved: true, secretCleaned: true }
          });
          if (
            result.status !== "success" ||
            !result.images.length ||
            result.glyphCoverage.missingGlyphs.length ||
            result.glyphCoverage.unsupportedGlyphs.length ||
            result.images.some(
              (image) =>
                image.mimeType !== "image/png" ||
                !Buffer.from(image.bytes)
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            )
          ) {
            reasons.add("image_render_failed_keep_native");
            return finish(original, "original", "native");
          }
          images.set(
            block.id,
            result.images.map((image) => Buffer.from(image.bytes).toString("base64"))
          );
          replacement = sidecar;
          imageBlocks += 1;
        } else {
          replacement += `\n${sidecar}`;
          templateBlocks += 1;
        }
        texts.set(block.id, replacement!);
      }
      if (signal.aborted || !texts.size) {
        reasons.add("no_eligible_blocks");
        return finish(original, "original", "native");
      }
      const rebuilt =
        provider === "openai"
          ? rebuildOpenAIResponsesRequest(
              parsed as ReturnType<typeof parseOpenAIResponsesRequest>,
              { transformedTextByBlockId: texts, imagesByBlockId: images }
            )
          : rebuildAnthropicMessagesRequest(
              parsed as ReturnType<typeof parseAnthropicMessagesRequest>,
              { transformedTextByBlockId: texts, imagesByBlockId: images }
            );
      const output = Buffer.from(JSON.stringify(rebuilt));
      const before = options.estimateCost(original),
        after = options.estimateCost(output);
      const accepted =
        !signal.aborted &&
        output.length < original.length &&
        Number.isFinite(before) &&
        Number.isFinite(after) &&
        after >= 0 &&
        before > after;
      if (!accepted) {
        reasons.add("request_rebuild_not_profitable");
        return finish(original, "original", "native");
      }
      const strategy =
        templateBlocks && imageBlocks ? "mixed" : templateBlocks ? "template" : "image";
      reasons.add(
        strategy === "mixed"
          ? "transformed_mixed"
          : strategy === "template"
            ? "transformed_template"
            : "transformed_image"
      );
      return finish(output, "transformed", strategy);
    } catch {
      reasons.add("transformation_failed_keep_native");
      return finish(original, "original", "native");
    }
  };
}
