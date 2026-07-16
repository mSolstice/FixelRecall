import { describe, expect, it } from "vitest";

import {
  blockId,
  createDecisionRecord,
  createMessage,
  createNormalizedRequest,
  createProviderMetadata,
  createTextBlock,
  createUnknownBlock,
  evaluatePolicyDecision,
  decisionDefaultReasons,
  explainDecisionRecordForCli,
  explainReasonForCli,
  keepNativeDecision,
  isoTimestamp,
  messageId,
  notRecoverable,
  orderIndex,
  reasonCatalogue,
  recoverable,
  requestId,
  sortByOrder,
  type AuditEventSink,
  type BenchmarkEvidenceStore,
  type CompatibilityEvaluator,
  type DecisionAction,
  type ExactnessRisk,
  type ModelProfileSource,
  type OriginalPassThroughFragment,
  type PolicyMode,
  type PolicyScannerResult,
  type PolicySource,
  type RendererHealthService,
  type SavingsProjectionEngine,
  type UsageHistorySource,
  type ReasonCode
} from "./index.js";

const metadata = createProviderMetadata("unknown", "unknown", {
  endpoint: "/v1/unknown",
  preservedHeaders: ["x-fake-cache-control"]
});

const passThrough: OriginalPassThroughFragment = {
  encoding: "json",
  raw: {
    type: "future_provider_block",
    nested: { value: "preserve me exactly" }
  },
  integrity: {
    algorithm: "sha256",
    digest: "fake-sha256-digest-for-fixture"
  }
};

describe("provider-neutral construction", () => {
  it("defaults requests to safe mode and preserves provider metadata", () => {
    const request = createNormalizedRequest({
      id: requestId("request-1"),
      provider: "unknown",
      messages: [],
      providerMetadata: metadata
    });

    expect(request).toEqual({
      id: "request-1",
      mode: "safe",
      provider: "unknown",
      messages: [],
      providerMetadata: metadata
    });
  });

  it("sorts messages and blocks by original order", () => {
    const secondBlock = createTextBlock({
      id: blockId("block-2"),
      order: orderIndex(1),
      text: "second",
      sourceCategory: "conversation_history",
      exactnessRisk: "gist_safe",
      recoverability: notRecoverable("safe_mode"),
      providerMetadata: metadata,
      decision: keepNativeDecision(["safe_mode"])
    });

    const firstBlock = createTextBlock({
      id: blockId("block-1"),
      order: orderIndex(0),
      text: "first",
      sourceCategory: "current_instruction",
      exactnessRisk: "verbatim_critical",
      recoverability: notRecoverable("current_context"),
      providerMetadata: metadata,
      decision: keepNativeDecision(["current_context"])
    });

    const secondMessage = createMessage({
      id: messageId("message-2"),
      order: orderIndex(1),
      role: "assistant",
      blocks: [secondBlock, firstBlock],
      providerMetadata: metadata
    });

    const firstMessage = createMessage({
      id: messageId("message-1"),
      order: orderIndex(0),
      role: "user",
      blocks: [],
      providerMetadata: metadata
    });

    const request = createNormalizedRequest({
      id: requestId("request-ordering"),
      provider: "unknown",
      messages: [secondMessage, firstMessage],
      providerMetadata: metadata
    });

    expect(request.messages.map((message) => message.id)).toEqual(["message-1", "message-2"]);
    expect(secondMessage.blocks.map((block) => block.id)).toEqual(["block-1", "block-2"]);
  });

  it("requires unknown blocks to carry pass-through metadata", () => {
    const unknownBlock = createUnknownBlock({
      id: blockId("block-unknown"),
      order: orderIndex(0),
      sourceCategory: "unknown",
      exactnessRisk: "unknown_risk",
      recoverability: notRecoverable("unknown_shape"),
      providerMetadata: metadata,
      passThrough
    });

    expect(unknownBlock).toMatchObject({
      kind: "unknown",
      decision: { action: "PASS_THROUGH_UNKNOWN", reasonCodes: ["unknown_shape"] },
      passThrough
    });
  });

  it("rejects invalid ids and order indexes", () => {
    expect(() => requestId(" ")).toThrow("request id must be non-empty");
    expect(() => orderIndex(-1)).toThrow("order index must be a non-negative integer");
    expect(() => orderIndex(1.5)).toThrow("order index must be a non-negative integer");
  });
});

describe("reason catalogue", () => {
  it("defines at least one reason for every decision action", () => {
    const decisions = Object.keys(decisionDefaultReasons) as DecisionAction[];

    expect(decisions).toEqual([
      "KEEP_NATIVE",
      "REDACT_AND_KEEP",
      "REDACT_AND_RENDER",
      "RENDER_RECOVERABLE",
      "REFERENCE_ONLY",
      "DEDUPLICATE",
      "DROP_STALE",
      "PASS_THROUGH_UNKNOWN"
    ]);

    for (const decision of decisions) {
      expect(decisionDefaultReasons[decision].length).toBeGreaterThan(0);
    }
  });

  it("defines safe display text for every reason", () => {
    const forbiddenDisplayValues = [
      "fake-openai-header-value",
      "fake-openai-smoke-key",
      "fake-anthropic-header-value",
      "fake-anthropic-smoke-key",
      "BODY_CANARY_OPENAI_DO_NOT_LOG",
      "BODY_CANARY_ANTHROPIC_DO_NOT_LOG"
    ];

    for (const reason of Object.values(reasonCatalogue)) {
      expect(reason.title.trim().length).toBeGreaterThan(0);
      expect(reason.cliText.trim().length).toBeGreaterThan(0);
      expect(reason.dashboardText.trim().length).toBeGreaterThan(0);
      for (const forbidden of forbiddenDisplayValues) {
        expect(reason.cliText).not.toContain(forbidden);
        expect(reason.dashboardText).not.toContain(forbidden);
      }
    }
  });
});

describe("DecisionRecord", () => {
  it("captures policy decision metadata and explanations", () => {
    const record = createDecisionRecord({
      blockId: blockId("block-record"),
      decision: keepNativeDecision(["exact_value"]),
      policyMode: "safe",
      timestamp: isoTimestamp("2026-07-16T00:00:00.000Z"),
      profileId: "profile-safe-text-v1",
      originalContentPreserved: true,
      recoveryAvailable: false
    });

    expect(record).toEqual({
      blockId: "block-record",
      decision: "KEEP_NATIVE",
      reasons: ["exact_value"],
      policyMode: "safe",
      timestamp: "2026-07-16T00:00:00.000Z",
      profileId: "profile-safe-text-v1",
      originalContentPreserved: true,
      recoveryAvailable: false
    });
    expect(explainReasonForCli("exact_value")).toContain("exact characters");
    expect(explainDecisionRecordForCli(record)).toContain("KEEP_NATIVE for block-record");
  });

  it("rejects invalid timestamps", () => {
    expect(() => isoTimestamp("2026-07-16")).toThrow("timestamp must be an ISO-8601 UTC timestamp");
  });
});

describe("sortByOrder", () => {
  it("does not mutate the source array", () => {
    const source = [{ order: orderIndex(1) }, { order: orderIndex(0) }] as const;
    const sorted = sortByOrder(source);

    expect(sorted.map((item) => item.order)).toEqual([0, 1]);
    expect(source.map((item) => item.order)).toEqual([1, 0]);
  });
});

describe("provider-neutral policy engine", () => {
  const timestamp = isoTimestamp("2026-07-16T00:00:00.000Z");

  function scanner(
    riskClass: ExactnessRisk,
    renderEligible = riskClass === "gist_safe"
  ): PolicyScannerResult {
    const reasonByRisk = {
      gist_safe: "eligible_gist_safe",
      structure_sensitive: "exact_value",
      verbatim_critical: "code_or_command",
      secret_sensitive: "secret_sensitive",
      unknown_risk: "unknown_risk"
    } as const satisfies Record<ExactnessRisk, ReasonCode>;

    return {
      riskClass,
      reasonCodes: [reasonByRisk[riskClass]],
      renderEligible,
      protectedSpans: riskClass === "gist_safe" ? [] : [{}],
      secretSensitiveSpans: riskClass === "secret_sensitive" ? [{}] : []
    };
  }

  function policyBlock(riskClass: ExactnessRisk = "gist_safe") {
    return createTextBlock({
      id: blockId(`policy-${riskClass}`),
      order: orderIndex(0),
      text: "Older historical design notes can be rendered.",
      sourceCategory: "conversation_history",
      exactnessRisk: riskClass,
      recoverability: recoverable("project-1", "session-1", blockId(`policy-${riskClass}`)),
      providerMetadata: metadata,
      decision: keepNativeDecision(["safe_mode"])
    });
  }

  const expectedByModeAndRisk = [
    ["safe", "gist_safe", "RENDER_RECOVERABLE"],
    ["safe", "structure_sensitive", "KEEP_NATIVE"],
    ["safe", "verbatim_critical", "KEEP_NATIVE"],
    ["safe", "secret_sensitive", "REDACT_AND_KEEP"],
    ["safe", "unknown_risk", "KEEP_NATIVE"],
    ["balanced", "gist_safe", "RENDER_RECOVERABLE"],
    ["balanced", "structure_sensitive", "RENDER_RECOVERABLE"],
    ["balanced", "verbatim_critical", "KEEP_NATIVE"],
    ["balanced", "secret_sensitive", "REDACT_AND_KEEP"],
    ["balanced", "unknown_risk", "KEEP_NATIVE"],
    ["max", "gist_safe", "RENDER_RECOVERABLE"],
    ["max", "structure_sensitive", "RENDER_RECOVERABLE"],
    ["max", "verbatim_critical", "KEEP_NATIVE"],
    ["max", "secret_sensitive", "REDACT_AND_KEEP"],
    ["max", "unknown_risk", "KEEP_NATIVE"],
    ["bypass", "gist_safe", "KEEP_NATIVE"],
    ["bypass", "structure_sensitive", "KEEP_NATIVE"],
    ["bypass", "verbatim_critical", "KEEP_NATIVE"],
    ["bypass", "secret_sensitive", "KEEP_NATIVE"],
    ["bypass", "unknown_risk", "KEEP_NATIVE"]
  ] as const satisfies readonly (readonly [PolicyMode, ExactnessRisk, DecisionAction])[];

  it.each(expectedByModeAndRisk)("returns %s/%s as %s", (mode, riskClass, expectedDecision) => {
    const result = evaluatePolicyDecision({
      block: policyBlock(riskClass),
      scannerResult: scanner(
        riskClass,
        riskClass !== "secret_sensitive" && riskClass !== "unknown_risk"
      ),
      contextAgeMs: 3_600_000,
      sourceCategory: "conversation_history",
      taskExactnessRequirement: "gist_ok",
      recoverability: recoverable(
        "project-1",
        "session-1",
        blockId(`recover-${mode}-${riskClass}`)
      ),
      modelProfileStatus: { kind: "enabled", profileId: "profile-safe-image-v1" },
      estimatedCost: { textCost: 100, imageCost: 40, sidecarCost: 10 },
      mode,
      timestamp
    });

    expect(result.decision).toBe(expectedDecision);
    expect(result.policyMode).toBe(mode);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("passes unknown input through unchanged", () => {
    const result = evaluatePolicyDecision({
      block: createUnknownBlock({
        id: blockId("policy-unknown-block"),
        order: orderIndex(0),
        sourceCategory: "unknown",
        exactnessRisk: "unknown_risk",
        recoverability: notRecoverable("unknown_shape"),
        providerMetadata: metadata,
        passThrough
      }),
      scannerResult: scanner("unknown_risk", false),
      contextAgeMs: 0,
      sourceCategory: "unknown",
      taskExactnessRequirement: "exact_required",
      recoverability: notRecoverable("unknown_shape"),
      modelProfileStatus: { kind: "enabled", profileId: "profile-safe-image-v1" },
      estimatedCost: { textCost: 10_000, imageCost: 1, sidecarCost: 1 },
      mode: "max",
      timestamp
    });

    expect(result.decision).toBe("PASS_THROUGH_UNKNOWN");
    expect(result.originalContentPreserved).toBe(true);
    expect(result.reasons).toEqual(["unknown_shape"]);
  });

  it("requires positive saving after sidecars and image cost", () => {
    const result = evaluatePolicyDecision({
      block: policyBlock("gist_safe"),
      scannerResult: scanner("gist_safe"),
      contextAgeMs: 3_600_000,
      sourceCategory: "conversation_history",
      taskExactnessRequirement: "gist_ok",
      recoverability: recoverable("project-1", "session-1", blockId("unprofitable")),
      modelProfileStatus: { kind: "enabled", profileId: "profile-safe-image-v1" },
      estimatedCost: { textCost: 100, imageCost: 80, sidecarCost: 20 },
      mode: "max",
      timestamp
    });

    expect(result.decision).toBe("KEEP_NATIVE");
    expect(result.reasons).toContain("unprofitable_conversion");
  });

  it("proves higher claimed savings cannot override a safety block", () => {
    const blockedCases = [
      { riskClass: "secret_sensitive", expected: "REDACT_AND_KEEP" },
      { riskClass: "verbatim_critical", expected: "KEEP_NATIVE" },
      { riskClass: "unknown_risk", expected: "KEEP_NATIVE" }
    ] as const satisfies readonly (readonly {
      readonly riskClass: ExactnessRisk;
      readonly expected: DecisionAction;
    })[];

    for (const blockedCase of blockedCases) {
      const result = evaluatePolicyDecision({
        block: policyBlock(blockedCase.riskClass),
        scannerResult: scanner(blockedCase.riskClass, false),
        contextAgeMs: 999_999_999,
        sourceCategory:
          blockedCase.riskClass === "verbatim_critical" ? "source_code" : "conversation_history",
        taskExactnessRequirement: "gist_ok",
        recoverability: recoverable(
          "project-1",
          "session-1",
          blockId(`huge-${blockedCase.riskClass}`)
        ),
        modelProfileStatus: { kind: "enabled", profileId: "profile-safe-image-v1" },
        estimatedCost: { textCost: 1_000_000, imageCost: 1, sidecarCost: 1 },
        mode: "max",
        timestamp
      });

      expect(result.decision).toBe(blockedCase.expected);
      expect(result.decision).not.toBe("RENDER_RECOVERABLE");
    }
  });

  it("blocks disabled and expired model profiles", () => {
    for (const status of [
      { kind: "disabled", reason: "profile_disabled" },
      { kind: "expired", reason: "profile_expired" }
    ] as const) {
      const result = evaluatePolicyDecision({
        block: policyBlock("gist_safe"),
        scannerResult: scanner("gist_safe"),
        contextAgeMs: 3_600_000,
        sourceCategory: "conversation_history",
        taskExactnessRequirement: "gist_ok",
        recoverability: recoverable("project-1", "session-1", blockId(`profile-${status.kind}`)),
        modelProfileStatus: { kind: status.kind, profileId: "profile-safe-image-v1" },
        estimatedCost: { textCost: 100, imageCost: 10, sidecarCost: 10 },
        mode: "max",
        timestamp
      });

      expect(result.decision).toBe("KEEP_NATIVE");
      expect(result.reasons).toContain(status.reason);
    }
  });
});

describe("Blueprint 2 bridge interfaces", () => {
  it("supports local synthetic implementations without provider wire types", async () => {
    const issuedAt = isoTimestamp("2026-07-16T00:00:00.000Z");
    const expiresAt = isoTimestamp("2026-08-16T00:00:00.000Z");
    const profile = {
      profileId: "synthetic-profile",
      provider: "unknown",
      modelFamily: "synthetic-model",
      status: "enabled",
      origin: "synthetic",
      issuedAt,
      expiresAt,
      signatureStatus: "not_required"
    } as const;
    const policy = {
      policyId: "protect-first",
      source: "built_in",
      version: "1.0.0",
      mode: "safe",
      mandatory: true,
      origin: "synthetic"
    } as const;
    const usage = {
      historyId: "synthetic-history",
      origin: "synthetic",
      periodStart: issuedAt,
      periodEnd: expiresAt,
      requestCount: 10,
      eligibleTokenEstimate: 1_000,
      cachedTokenEstimate: 100
    } as const;
    const evidence = {
      evidenceId: "synthetic-evidence",
      origin: "synthetic",
      createdAt: issuedAt,
      profileId: profile.profileId,
      workloadId: "synthetic-workload",
      passed: true,
      protectedValuesImaged: 0
    } as const;

    const profileSource: ModelProfileSource = {
      getProfile: async () => profile
    };
    const policySource: PolicySource = {
      getPolicy: async () => policy
    };
    const usageSource: UsageHistorySource = {
      getUsageHistory: async () => usage
    };
    const evidenceStore: BenchmarkEvidenceStore = {
      putEvidence: async () => undefined,
      getEvidence: async () => evidence
    };
    const auditSink: AuditEventSink = {
      append: async (event) => {
        expect(event.contentIncluded).toBe(false);
      }
    };
    const evaluator: CompatibilityEvaluator = {
      evaluate: async () => ({
        verdict: "recommended",
        score: 80,
        reasons: ["eligible_gist_safe"],
        origin: "synthetic"
      })
    };
    const projectionEngine: SavingsProjectionEngine = {
      project: async () => ({
        origin: "synthetic",
        period: "monthly",
        netSavingEstimate: 12,
        confidence: "low",
        labelledSynthetic: true
      })
    };
    const rendererHealth: RendererHealthService = {
      check: async () => ({
        status: "healthy",
        profileId: profile.profileId,
        checkedAt: issuedAt,
        reasons: ["eligible_gist_safe"],
        origin: "synthetic"
      })
    };

    await expect(profileSource.getProfile(profile.profileId)).resolves.toEqual(profile);
    await expect(policySource.getPolicy(policy.policyId)).resolves.toEqual(policy);
    await expect(usageSource.getUsageHistory(usage.historyId)).resolves.toEqual(usage);
    await evidenceStore.putEvidence(evidence);
    await expect(evidenceStore.getEvidence(evidence.evidenceId)).resolves.toEqual(evidence);
    await auditSink.append({
      eventId: "synthetic-audit-event",
      timestamp: issuedAt,
      eventType: "compatibility_audit",
      origin: "synthetic",
      reasonCodes: ["eligible_gist_safe"],
      contentIncluded: false
    });
    await expect(
      evaluator.evaluate({
        host: "both",
        profile,
        usageHistory: usage,
        policy,
        exactnessSensitivity: "medium"
      })
    ).resolves.toMatchObject({ verdict: "recommended", origin: "synthetic" });
    await expect(
      projectionEngine.project({
        usageHistory: usage,
        benchmarkEvidence: evidence,
        period: "monthly"
      })
    ).resolves.toMatchObject({ labelledSynthetic: true });
    await expect(rendererHealth.check(profile)).resolves.toMatchObject({ status: "healthy" });
  });
});
