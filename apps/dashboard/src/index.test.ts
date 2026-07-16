import { describe, expect, it } from "vitest";

import {
  createContextXrayDemoStory,
  createDashboardViewModel,
  dashboardBoundary,
  renderCompatibilityLeaderboardPage,
  renderDashboard,
  runLocalDashboardSmokeTest
} from "./index.js";

describe("dashboardBoundary", () => {
  it("keeps raw content hidden and analytics disabled by default", () => {
    expect(dashboardBoundary()).toEqual({
      rawContentHiddenByDefault: true,
      rawContextApiAvailable: false,
      remoteAnalyticsEnabledByDefault: false
    });
  });
});

describe("local dashboard components", () => {
  it("renders the five main cards", () => {
    const html = renderDashboard();

    expect(html).toContain("Context X-ray");
    expect(html).toContain("Safe savings");
    expect(html).toContain("Risk ledger");
    expect(html).toContain("Model health");
    expect(html).toContain("Session control");
    expect(html).toContain("Compatibility leaderboard");
  });

  it("renders upgraded Context X-ray sections without a misleading combined score", () => {
    const html = renderDashboard({ syntheticDemoData: true });

    for (const label of [
      "Request composition",
      "Current versus old context",
      "Exact versus semantic",
      "Code and command content",
      "Secret-sensitive counts",
      "Completed versus active tool state",
      "Repeated content",
      "Cache-sensitive content",
      "Recovery availability",
      "Renderer candidates",
      "Fallback events",
      "Exact retrieval events",
      "Policy reasons",
      "Before and after comparison",
      "Session trend",
      "Provider comparison"
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Separate X-ray signals are shown without a combined score.");
    expect(html).not.toContain("X-ray score");
    expect(html).not.toContain("combined score</span><strong>");
  });

  it("shows clear reason-code explanations from policy records", () => {
    const html = renderDashboard({ demoStory: "U2" });

    expect(html).toContain("code_or_command");
    expect(html).toContain("secret_sensitive");
    expect(html).toContain("Safe mode");
    expect(html).toContain("Decision records");
    expect(html).toContain("KEEP_NATIVE");
  });

  it.each(["U1", "U2", "U3"] as const)("provides seeded demo story %s", (story) => {
    const xray = createContextXrayDemoStory(story);
    const html = renderDashboard({ demoStory: story });

    expect(xray.currentContextHidden).toBe(true);
    expect(xray.requestComposition.length).toBeGreaterThan(0);
    expect(xray.policyReasons.length).toBeGreaterThan(0);
    expect(html).toContain("SYNTHETIC DATA");
    expect(html).toContain(String(xray.blockCount));
  });

  it("keeps raw context hidden and exposes no raw-context API in the MVP", () => {
    const model = createDashboardViewModel();
    const html = renderDashboard({ model });

    expect(model.rawContextVisible).toBe(false);
    expect(html).toContain("Raw context is hidden by default");
    expect(html).toContain("Raw context</span><strong>hidden</strong>");
    expect(html).not.toContain("rawContextBody");
    expect(html).not.toContain("/raw-context");
    expect(html).not.toContain("raw-content");
  });

  it("labels measured versus estimated savings clearly", () => {
    const html = renderDashboard({
      model: {
        safeSavings: {
          cachedInputTokens: 9_000,
          confidence: "high",
          estimatedInputTokens: 5_000,
          imageTokens: 700,
          measuredInputTokens: 10_000,
          totalEstimatedCost: 0.04
        }
      }
    });

    expect(html).toContain("Measured input tokens");
    expect(html).toContain("Estimated input tokens");
    expect(html).toContain("Total estimated cost");
  });

  it("shows Safe mode, kill switch and provider path without credentials", () => {
    const html = renderDashboard({
      model: {
        killSwitchEnabled: true,
        providerPath: "https://user:SECRET@example.test/v1?api_key=SECRET&safe=true",
        safetyMode: "Safe"
      }
    });

    expect(html).toContain("Mode: Safe");
    expect(html).toContain("Kill switch: on");
    expect(html).toContain("https://example.test/v1?safe=true");
    expect(html).not.toContain("SECRET");
    expect(html).not.toContain("api_key");
  });

  it("shows the product policy preset selector with Protect First by default", () => {
    const html = renderDashboard();

    expect(html).toContain("Preset: Protect First");
    expect(html).toContain("Policy preset selector");
    expect(html).toContain("Protect First maps to safe");
    expect(html).toContain("Presets map to existing internal modes");
  });

  it("disables Lab Mode outside synthetic or experimental sessions", () => {
    const blocked = renderDashboard({
      model: { policyPreset: "Lab Mode", syntheticSession: false }
    });
    const allowed = renderDashboard({
      model: { policyPreset: "Lab Mode", syntheticSession: false, experimentalSession: true }
    });

    expect(blocked).toContain("Lab Mode maps to max (not available)");
    expect(blocked).toContain("Current preset is blocked");
    expect(allowed).toContain("Lab Mode maps to max");
    expect(allowed).toContain("Current preset is allowed");
  });

  it("supports accessible keyboard navigation and responsive local layout", () => {
    const html = renderDashboard();

    expect(html).toContain('aria-label="Dashboard cards"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain(":focus-visible");
    expect(html).toContain("@media (max-width: 980px)");
    expect(html).toContain("@media (max-width: 620px)");
  });

  it("renders empty and error states", () => {
    const empty = renderDashboard({ model: { state: "empty" } });
    const error = renderDashboard({
      model: { errorMessage: "Local gateway status timed out.", state: "error" }
    });

    expect(empty).toContain("No session data yet");
    expect(empty).toContain('role="status"');
    expect(error).toContain("Dashboard could not load local status");
    expect(error).toContain("Local gateway status timed out.");
    expect(error).toContain('role="alert"');
  });

  it("does not enable remote analytics by default", () => {
    const model = createDashboardViewModel();
    const html = renderDashboard({ model });

    expect(model.analyticsEnabled).toBe(false);
    expect(html).not.toContain("analytics.open");
    expect(html).not.toContain("telemetry");
  });

  it("renders the local synthetic compatibility leaderboard without a combined winner score", () => {
    const html = renderDashboard();

    expect(html).toContain("LOCAL SIMULATOR");
    expect(html).toContain("SYNTHETIC RESULTS");
    expect(html).toContain("Gist Accuracy");
    expect(html).toContain("Structural Accuracy");
    expect(html).toContain("Exact String Accuracy");
    expect(html).toContain("Token Efficiency");
    expect(html).toContain("Retrieval Dependency");
    expect(html).toContain("Safe Mode Recommendation");
    expect(html).toContain("Expired evidence</span><strong>1</strong>");
    expect(html).not.toContain("winnerScore");
    expect(html).not.toContain("profile-synthetic-expired</strong>");
  });

  it("renders a standalone local-only leaderboard page", () => {
    const html = renderCompatibilityLeaderboardPage();

    expect(html).toContain("Local compatibility leaderboard");
    expect(html).toContain("No public network endpoint");
    expect(html).not.toContain("/api/");
    expect(html).not.toContain("raw-context");
  });
});

describe("local dashboard smoke test", () => {
  it("passes against safe local markup", () => {
    const result = runLocalDashboardSmokeTest();

    expect(result).toEqual({
      checkedCards: [
        "Context X-ray",
        "Safe savings",
        "Risk ledger",
        "Model health",
        "Session control",
        "Compatibility leaderboard"
      ],
      passed: true,
      rawContextApiAvailable: false,
      remoteAnalyticsEnabled: false
    });
  });
});
