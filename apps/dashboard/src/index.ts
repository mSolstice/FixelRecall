export interface DashboardBoundary {
  readonly rawContentHiddenByDefault: true;
  readonly rawContextApiAvailable: false;
  readonly remoteAnalyticsEnabledByDefault: false;
}

export type DashboardMode = "Safe" | "Balanced" | "Max" | "Bypass";
export type DashboardStateKind = "ready" | "empty" | "error";

export interface DashboardViewModel {
  readonly state: DashboardStateKind;
  readonly providerPath: string;
  readonly safetyMode: DashboardMode;
  readonly killSwitchEnabled: boolean;
  readonly rawContextVisible: false;
  readonly analyticsEnabled: false;
  readonly contextXray: {
    readonly blockCount: number;
    readonly protectedBlockCount: number;
    readonly retrievalEligibleCount: number;
    readonly currentContextHidden: true;
  };
  readonly safeSavings: {
    readonly measuredInputTokens: number | null;
    readonly estimatedInputTokens: number | null;
    readonly cachedInputTokens: number | null;
    readonly imageTokens: number | null;
    readonly totalEstimatedCost: number | null;
    readonly confidence: "high" | "medium" | "low" | "unavailable";
  };
  readonly riskLedger: {
    readonly entries: readonly RiskLedgerEntry[];
  };
  readonly modelHealth: {
    readonly profileId: string;
    readonly status: "healthy" | "degraded" | "unsafe" | "unsupported";
    readonly lastTested: string;
    readonly nextAction: string;
  };
  readonly sessionControl: {
    readonly sessionId: string | null;
    readonly canDeleteSession: boolean;
    readonly dryRunByDefault: true;
  };
  readonly errorMessage?: string;
}

export interface RiskLedgerEntry {
  readonly label: string;
  readonly severity: "info" | "warning" | "blocker";
  readonly reason: string;
}

export interface DashboardRenderOptions {
  readonly model?: Partial<DashboardViewModel>;
}

export interface DashboardSmokeResult {
  readonly passed: boolean;
  readonly checkedCards: readonly string[];
  readonly remoteAnalyticsEnabled: false;
  readonly rawContextApiAvailable: false;
}

const cardTitles = [
  "Context X-ray",
  "Safe savings",
  "Risk ledger",
  "Model health",
  "Session control"
] as const;

export function dashboardBoundary(): DashboardBoundary {
  return {
    rawContentHiddenByDefault: true,
    rawContextApiAvailable: false,
    remoteAnalyticsEnabledByDefault: false
  };
}

export function createDashboardViewModel(
  override: Partial<DashboardViewModel> = {}
): DashboardViewModel {
  return {
    analyticsEnabled: false,
    contextXray: {
      blockCount: 12,
      currentContextHidden: true,
      protectedBlockCount: 5,
      retrievalEligibleCount: 3,
      ...override.contextXray
    },
    errorMessage: override.errorMessage,
    killSwitchEnabled: override.killSwitchEnabled ?? false,
    modelHealth: {
      lastTested: "2026-07-17",
      nextAction: "Run renderer doctor before enabling a wider mode.",
      profileId: "synthetic-safe-profile-v1",
      status: "healthy",
      ...override.modelHealth
    },
    providerPath: sanitiseProviderPath(override.providerPath ?? "https://provider.example.test/v1"),
    rawContextVisible: false,
    riskLedger: {
      entries: [
        {
          label: "Protected values",
          reason: "Current instructions, secrets, code and exact values stay native in Safe mode.",
          severity: "info"
        }
      ],
      ...override.riskLedger
    },
    safeSavings: {
      cachedInputTokens: 1_200,
      confidence: "medium",
      estimatedInputTokens: 4_800,
      imageTokens: 600,
      measuredInputTokens: 7_000,
      totalEstimatedCost: 0.03,
      ...override.safeSavings
    },
    safetyMode: override.safetyMode ?? "Safe",
    sessionControl: {
      canDeleteSession: true,
      dryRunByDefault: true,
      sessionId: "session_synthetic_local",
      ...override.sessionControl
    },
    state: override.state ?? "ready"
  };
}

export function renderDashboard(options: DashboardRenderOptions = {}): string {
  const model = createDashboardViewModel(options.model);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Context Diet Dashboard</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #f7f8fa; color: #16181d; }
    a, button { outline-offset: 3px; }
    .shell { max-width: 1180px; margin: 0 auto; padding: 24px; }
    .topbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
    .title { margin: 0; font-size: 1.45rem; line-height: 1.2; }
    .status-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .pill { border: 1px solid #c9d1db; border-radius: 999px; padding: 6px 10px; background: #fff; font-size: .9rem; }
    .safe { border-color: #2f7d4f; color: #175c35; font-weight: 700; }
    .kill { border-color: #9c2f2f; color: #7a2020; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid #d8dde5; border-radius: 8px; padding: 16px; min-height: 210px; }
    .card h2 { margin: 0 0 12px; font-size: 1rem; }
    .metric { display: flex; justify-content: space-between; gap: 12px; margin: 9px 0; border-bottom: 1px solid #eef1f5; padding-bottom: 8px; }
    .metric span:first-child { color: #4d5663; }
    .muted { color: #606a78; }
    .warning { color: #8a5200; }
    .blocker { color: #9c2f2f; }
    .controls { display: flex; flex-direction: column; gap: 8px; }
    button { border: 1px solid #aeb8c6; border-radius: 6px; background: #fff; color: #16181d; padding: 9px 10px; text-align: left; font: inherit; }
    button:focus-visible, a:focus-visible { outline: 3px solid #1d6fdc; }
    .empty, .error { border: 1px dashed #aeb8c6; border-radius: 8px; background: #fff; padding: 16px; margin-bottom: 12px; }
    .error { border-color: #9c2f2f; }
    @media (max-width: 980px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 620px) { .shell { padding: 16px; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="shell">
    <section class="topbar" aria-labelledby="dashboard-title">
      <div>
        <h1 id="dashboard-title" class="title">Context Diet local dashboard</h1>
        <p class="muted">Raw context is hidden by default. The MVP exposes no raw-context API.</p>
      </div>
      <div class="status-row" aria-label="Current routing and safety">
        <span class="pill safe">Mode: ${escapeHtml(model.safetyMode)}</span>
        <span class="pill kill">Kill switch: ${model.killSwitchEnabled ? "on" : "off"}</span>
        <span class="pill">Upstream: ${escapeHtml(model.providerPath)}</span>
      </div>
    </section>
    ${renderStateMessage(model)}
    <nav aria-label="Dashboard cards" class="status-row">
      ${cardTitles.map((title) => `<a class="pill" href="#${slug(title)}">${title}</a>`).join("\n      ")}
    </nav>
    <section class="grid" aria-label="Dashboard summary cards">
      ${renderContextXray(model)}
      ${renderSafeSavings(model)}
      ${renderRiskLedger(model)}
      ${renderModelHealth(model)}
      ${renderSessionControl(model)}
    </section>
  </main>
</body>
</html>`;
}

export function runLocalDashboardSmokeTest(html = renderDashboard()): DashboardSmokeResult {
  const checkedCards = cardTitles.filter((title) => html.includes(title));
  return {
    checkedCards,
    passed:
      checkedCards.length === cardTitles.length &&
      html.includes("Raw context is hidden by default") &&
      !html.includes("analytics.open") &&
      !html.includes("/raw-context") &&
      !html.includes("rawContext"),
    rawContextApiAvailable: false,
    remoteAnalyticsEnabled: false
  };
}

function renderStateMessage(model: DashboardViewModel): string {
  if (model.state === "empty") {
    return `<section class="empty" role="status" tabindex="0"><strong>No session data yet.</strong><br><span class="muted">Start the local gateway or run a synthetic benchmark to populate the dashboard.</span></section>`;
  }
  if (model.state === "error") {
    return `<section class="error" role="alert" tabindex="0"><strong>Dashboard could not load local status.</strong><br><span>${escapeHtml(model.errorMessage ?? "Check the local gateway and try again.")}</span></section>`;
  }
  return "";
}

function renderContextXray(model: DashboardViewModel): string {
  return card(
    "Context X-ray",
    [
      metric("Blocks seen", String(model.contextXray.blockCount)),
      metric("Protected blocks", String(model.contextXray.protectedBlockCount)),
      metric("Retrieval eligible", String(model.contextXray.retrievalEligibleCount)),
      metric("Raw context", "hidden")
    ].join("")
  );
}

function renderSafeSavings(model: DashboardViewModel): string {
  return card(
    "Safe savings",
    [
      metric("Measured input tokens", formatNumber(model.safeSavings.measuredInputTokens)),
      metric("Estimated input tokens", formatNumber(model.safeSavings.estimatedInputTokens)),
      metric("Cached input tokens", formatNumber(model.safeSavings.cachedInputTokens)),
      metric("Image tokens", formatNumber(model.safeSavings.imageTokens)),
      metric("Total estimated cost", formatMoney(model.safeSavings.totalEstimatedCost)),
      metric("Confidence", model.safeSavings.confidence)
    ].join("")
  );
}

function renderRiskLedger(model: DashboardViewModel): string {
  const entries =
    model.riskLedger.entries.length === 0
      ? `<p class="muted">No policy risks recorded for this local session.</p>`
      : model.riskLedger.entries
          .map(
            (entry) =>
              `<p class="${entry.severity === "blocker" ? "blocker" : entry.severity === "warning" ? "warning" : "muted"}"><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.reason)}</p>`
          )
          .join("");
  return card("Risk ledger", entries);
}

function renderModelHealth(model: DashboardViewModel): string {
  return card(
    "Model health",
    [
      metric("Profile", escapeHtml(model.modelHealth.profileId)),
      metric("Status", escapeHtml(model.modelHealth.status)),
      metric("Last tested", escapeHtml(model.modelHealth.lastTested)),
      `<p class="muted">${escapeHtml(model.modelHealth.nextAction)}</p>`
    ].join("")
  );
}

function renderSessionControl(model: DashboardViewModel): string {
  return card(
    "Session control",
    [
      metric("Session", escapeHtml(model.sessionControl.sessionId ?? "none")),
      metric(
        "Delete",
        model.sessionControl.canDeleteSession ? "available with confirmation" : "unavailable"
      ),
      `<div class="controls" aria-label="Session controls">
        <button type="button">Copy safe status</button>
        <button type="button">Dry-run delete session</button>
        <button type="button">Restore direct routing</button>
      </div>`
    ].join("")
  );
}

function card(title: (typeof cardTitles)[number], body: string): string {
  return `<article id="${slug(title)}" class="card" tabindex="0" aria-labelledby="${slug(title)}-title"><h2 id="${slug(title)}-title">${title}</h2>${body}</article>`;
}

function metric(label: string, value: string): string {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function formatNumber(value: number | null): string {
  return value === null ? "unavailable" : new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number | null): string {
  return value === null ? "unavailable" : `$${value.toFixed(2)} estimated`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitiseProviderPath(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      const lowered = key.toLowerCase();
      if (lowered.includes("key") || lowered.includes("token") || lowered.includes("secret")) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value.replace(/(api[_-]?key|token|secret|password)=([^&\s]+)/gi, "$1=REDACTED");
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
