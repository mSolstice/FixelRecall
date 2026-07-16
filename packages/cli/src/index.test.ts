import { describe, expect, it } from "vitest";

import {
  describeCli,
  renderCompatibilityAuditJson,
  renderCompatibilityAuditMarkdown,
  runCliCommand,
  runCompatibilityAudit,
  runRendererDoctor,
  type CompatibilityAuditVerdict
} from "./index.js";

describe("describeCli", () => {
  it("names the local operator", () => {
    expect(describeCli()).toBe("context-diet local operator");
  });
});

describe("context-diet renderer doctor", () => {
  it.each([
    ["healthy", "HEALTHY"],
    ["degraded", "DEGRADED"],
    ["unsafe", "UNSAFE"],
    ["unsupported", "UNSUPPORTED"]
  ] as const)("produces %s status", async (seed, expectedStatus) => {
    const report = await runRendererDoctor({ seed });

    expect(report.command).toBe("context-diet renderer doctor");
    expect(report.status).toBe(expectedStatus);
    expect(report.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "adapter installed",
        "upstream pxpipe version or pinned commit",
        "licence notice",
        "required native dependencies",
        "temp directory write and cleanup",
        "font availability",
        "deterministic golden render",
        "supported image dimensions",
        "glyph coverage",
        "exact-sidecar output",
        "protected-span exclusion",
        "fake secret-canary absence",
        "model-profile compatibility",
        "simulated image-token cost",
        "renderer timeout",
        "crash cleanup"
      ])
    );
    for (const check of report.checks) {
      expect(check.nextAction.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("context-diet compatibility-audit", () => {
  it.each([
    "RECOMMENDED",
    "RECOMMENDED_WITH_RESTRICTIONS",
    "AUDIT_ONLY",
    "NOT_WORTH_USING",
    "UNSUPPORTED",
    "RETEST_REQUIRED"
  ] as const satisfies readonly CompatibilityAuditVerdict[])("produces %s verdict", (seed) => {
    const report = runCompatibilityAudit({ seed });

    expect(report.verdict).toBe(seed);
    expect(report.dataNotice).toBe("SYNTHETIC TEST DATA");
    expect(report.compatibilityScore).toBeGreaterThanOrEqual(0);
    expect(report.compatibilityScore).toBeLessThanOrEqual(100);
    expect(report.reasons.join("\n")).toContain("SYNTHETIC TEST DATA");
    expect(report.dashboard).toMatchObject({
      dataOrigin: "synthetic",
      kind: "compatibility_audit",
      verdict: seed
    });
    expect(renderCompatibilityAuditJson(report)).toContain('"SYNTHETIC TEST DATA"');
    expect(renderCompatibilityAuditMarkdown(report)).toContain("**SYNTHETIC TEST DATA**");
  });

  it.each(["codex", "claude_code", "both"] as const)("supports %s host fixtures", (seed) => {
    const report = runCompatibilityAudit({ seed });

    expect(report.input.host).toBe(seed);
    expect(report.requiredCanaries.join("\n")).toContain(
      seed === "both" ? "Codex route canary" : `${seed} route canary`
    );
  });

  it("does not let a blended score hide failed exactness or safety thresholds", () => {
    const report = runCompatibilityAudit({
      fixture: {
        averageRequestSize: 500_000,
        averageSessionSize: 2_000_000,
        cacheIntensity: "high",
        exactnessSensitivity: "critical"
      }
    });

    expect(report.compatibilityScore).toBeGreaterThan(50);
    expect(report.verdict).toBe("AUDIT_ONLY");
    expect(report.reasons.join("\n")).toContain("not allowed to hide");
  });
});

describe("context-diet CLI commands", () => {
  it.each([
    "doctor",
    "audit",
    "start",
    "stop",
    "status",
    "explain",
    "benchmark",
    "retrieve",
    "delete-session",
    "uninstall"
  ] as const)("prints safe output for %s", async (command) => {
    const result = await runCliCommand([command], {
      env: {
        fakeProviderDevelopmentMode: true,
        gatewayRunning: true,
        sessionId: "session_test_123",
        upstreamBaseUrl: "https://token:SECRET_VALUE@provider.example.test/v1?api_key=SECRET_VALUE"
      }
    });

    expect(result.exitCode).toBeGreaterThanOrEqual(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatchSnapshot();
    expect(result.stdout).not.toContain("SECRET_VALUE");
    expect(result.stdout).not.toContain("token:SECRET");
  });

  it("uses helpful exit code for unknown commands", async () => {
    const result = await runCliCommand(["nope"]);

    expect(result.exitCode).toBe(64);
    expect(result.stderr).toContain("Unknown command");
  });

  it("requires confirmation before destructive actions", async () => {
    const dryRun = await runCliCommand(["delete-session"], { env: { sessionId: "session_safe" } });
    const confirmed = await runCliCommand(["delete-session", "--confirm"], {
      env: { sessionId: "session_safe" }
    });

    expect(dryRun.stdout).toContain("Dry run");
    expect(confirmed.stdout).toContain("Confirmed");
  });

  it("supports JSON benchmark output", async () => {
    const result = await runCliCommand(["benchmark", "--json"]);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      comparison: { comparable: true },
      dataOrigin: "synthetic"
    });
  });
});
