import { describe, expect, it } from "vitest";

import {
  createDashboardViewModel,
  dashboardBoundary,
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
  });

  it("keeps raw context hidden and exposes no raw-context API in the MVP", () => {
    const model = createDashboardViewModel();
    const html = renderDashboard({ model });

    expect(model.rawContextVisible).toBe(false);
    expect(html).toContain("Raw context is hidden by default");
    expect(html).toContain("Raw context</span><strong>hidden</strong>");
    expect(html).not.toContain("rawContextBody");
    expect(html).not.toContain("/raw-context");
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
        "Session control"
      ],
      passed: true,
      rawContextApiAvailable: false,
      remoteAnalyticsEnabled: false
    });
  });
});
