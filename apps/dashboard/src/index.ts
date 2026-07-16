import {
  explainReasonForDashboard,
  productPolicyPresets,
  selectProductPolicyPreset,
  type DecisionAction,
  type ProductPolicyPreset,
  type ReasonCode
} from "@context-diet/core";
import {
  createLocalCompatibilityLeaderboard,
  createSeededLeaderboardEvidence,
  type LocalCompatibilityLeaderboard
} from "@context-diet/leaderboard";

export interface DashboardBoundary {
  readonly rawContentHiddenByDefault: true;
  readonly rawContextApiAvailable: false;
  readonly remoteAnalyticsEnabledByDefault: false;
}

export type DashboardMode = "Safe" | "Balanced" | "Max" | "Bypass";
export type DashboardStateKind = "ready" | "empty" | "error";
export type DemoStoryId = "U1" | "U2" | "U3";

export interface XrayMetric {
  readonly label: string;
  readonly value: number;
  readonly description: string;
}

export interface XrayComparison {
  readonly before: number;
  readonly after: number;
  readonly label: string;
  readonly description: string;
}

export interface XrayReasonSummary {
  readonly code: ReasonCode;
  readonly count: number;
  readonly explanation: string;
}

export interface XrayDecisionSummary {
  readonly action: DecisionAction;
  readonly count: number;
}

export interface ContextXrayDetails {
  readonly blockCount: number;
  readonly protectedBlockCount: number;
  readonly retrievalEligibleCount: number;
  readonly currentContextHidden: true;
  readonly requestComposition: readonly XrayMetric[];
  readonly currentVsOldContext: readonly XrayMetric[];
  readonly exactVsSemantic: readonly XrayMetric[];
  readonly codeAndCommandContent: readonly XrayMetric[];
  readonly secretSensitiveCounts: readonly XrayMetric[];
  readonly completedVsActiveToolState: readonly XrayMetric[];
  readonly repeatedContent: readonly XrayMetric[];
  readonly cacheSensitiveContent: readonly XrayMetric[];
  readonly recoveryAvailability: readonly XrayMetric[];
  readonly rendererCandidates: readonly XrayMetric[];
  readonly fallbackEvents: readonly XrayMetric[];
  readonly exactRetrievalEvents: readonly XrayMetric[];
  readonly beforeAfterComparison: readonly XrayComparison[];
  readonly sessionTrend: readonly XrayMetric[];
  readonly providerComparison: readonly XrayMetric[];
  readonly policyReasons: readonly XrayReasonSummary[];
  readonly decisionRecords: readonly XrayDecisionSummary[];
}

export interface DashboardViewModel {
  readonly state: DashboardStateKind;
  readonly providerPath: string;
  readonly safetyMode: DashboardMode;
  readonly policyPreset: ProductPolicyPreset;
  readonly syntheticSession: boolean;
  readonly experimentalSession: boolean;
  readonly organisationForbiddenPresets: readonly ProductPolicyPreset[];
  readonly killSwitchEnabled: boolean;
  readonly rawContextVisible: false;
  readonly analyticsEnabled: false;
  readonly contextXray: ContextXrayDetails;
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
  readonly compatibilityLeaderboard: LocalCompatibilityLeaderboard;
  readonly errorMessage?: string;
}

export interface RiskLedgerEntry {
  readonly label: string;
  readonly severity: "info" | "warning" | "blocker";
  readonly reason: string;
}

export interface DashboardRenderOptions {
  readonly model?: Partial<DashboardViewModel>;
  readonly demoStory?: DemoStoryId;
  readonly syntheticDemoData?: boolean;
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
  "Session control",
  "Compatibility leaderboard"
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
  const storyXray = createContextXrayDemoStory("U1");
  return {
    analyticsEnabled: false,
    contextXray: { ...storyXray, ...override.contextXray },
    errorMessage: override.errorMessage,
    killSwitchEnabled: override.killSwitchEnabled ?? false,
    experimentalSession: override.experimentalSession ?? false,
    modelHealth: {
      lastTested: "2026-07-17",
      nextAction: "Run renderer doctor before enabling a wider mode.",
      profileId: "synthetic-safe-profile-v1",
      status: "healthy",
      ...override.modelHealth
    },
    providerPath: sanitiseProviderPath(override.providerPath ?? "https://provider.example.test/v1"),
    rawContextVisible: false,
    organisationForbiddenPresets: override.organisationForbiddenPresets ?? [],
    policyPreset: override.policyPreset ?? "Protect First",
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
    compatibilityLeaderboard:
      override.compatibilityLeaderboard ??
      createLocalCompatibilityLeaderboard(createSeededLeaderboardEvidence(1)),
    sessionControl: {
      canDeleteSession: true,
      dryRunByDefault: true,
      sessionId: "session_synthetic_local",
      ...override.sessionControl
    },
    state: override.state ?? "ready",
    syntheticSession: override.syntheticSession ?? true
  };
}

export function renderDashboard(options: DashboardRenderOptions = {}): string {
  const demoModel =
    options.syntheticDemoData === true || options.demoStory !== undefined
      ? { contextXray: createContextXrayDemoStory(options.demoStory ?? "U1") }
      : {};
  const model = createDashboardViewModel({ ...demoModel, ...options.model });
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
    .wide { grid-column: 1 / -1; }
    .card { background: #fff; border: 1px solid #d8dde5; border-radius: 8px; padding: 16px; min-height: 210px; }
    .card h2 { margin: 0 0 12px; font-size: 1rem; }
    .metric { display: flex; justify-content: space-between; gap: 12px; margin: 9px 0; border-bottom: 1px solid #eef1f5; padding-bottom: 8px; }
    .metric span:first-child { color: #4d5663; }
    .xray-section { border-top: 1px solid #eef1f5; padding-top: 10px; margin-top: 10px; }
    .xray-section h3 { font-size: .86rem; margin: 0 0 6px; }
    .xray-list { margin: 0; padding-left: 18px; color: #4d5663; }
    .xray-list li { margin: 4px 0; }
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
        <p class="muted">SYNTHETIC DATA. Raw context is hidden by default. The MVP exposes no raw-context API.</p>
      </div>
      <div class="status-row" aria-label="Current routing and safety">
        <span class="pill safe">Mode: ${escapeHtml(model.safetyMode)}</span>
        <span class="pill">Preset: ${escapeHtml(model.policyPreset)}</span>
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
      ${renderCompatibilityLeaderboard(model)}
    </section>
  </main>
</body>
</html>`;
}

export function renderCompatibilityLeaderboardPage(
  leaderboard: LocalCompatibilityLeaderboard = createLocalCompatibilityLeaderboard(
    createSeededLeaderboardEvidence(1)
  )
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Context Diet Compatibility Leaderboard</title>
</head>
<body>
  <main>
    <h1>Local compatibility leaderboard</h1>
    <p>LOCAL SIMULATOR. SYNTHETIC RESULTS. No public network endpoint is exposed.</p>
    ${renderCompatibilityLeaderboardContent(leaderboard)}
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
  const xray = model.contextXray;
  return card(
    "Context X-ray",
    [
      `<p class="muted">SYNTHETIC DATA. Separate X-ray signals are shown without a combined score.</p>`,
      metric("Blocks seen", String(xray.blockCount)),
      metric("Protected blocks", String(xray.protectedBlockCount)),
      metric("Retrieval eligible", String(xray.retrievalEligibleCount)),
      metric("Raw context", "hidden"),
      renderMetricSection("Request composition", xray.requestComposition),
      renderMetricSection("Current versus old context", xray.currentVsOldContext),
      renderMetricSection("Exact versus semantic", xray.exactVsSemantic),
      renderMetricSection("Code and command content", xray.codeAndCommandContent),
      renderMetricSection("Secret-sensitive counts", xray.secretSensitiveCounts),
      renderMetricSection("Completed versus active tool state", xray.completedVsActiveToolState),
      renderMetricSection("Repeated content", xray.repeatedContent),
      renderMetricSection("Cache-sensitive content", xray.cacheSensitiveContent),
      renderMetricSection("Recovery availability", xray.recoveryAvailability),
      renderMetricSection("Renderer candidates", xray.rendererCandidates),
      renderMetricSection("Fallback events", xray.fallbackEvents),
      renderMetricSection("Exact retrieval events", xray.exactRetrievalEvents),
      renderComparisonSection("Before and after comparison", xray.beforeAfterComparison),
      renderMetricSection("Session trend", xray.sessionTrend),
      renderMetricSection("Provider comparison", xray.providerComparison),
      renderReasonSection(xray.policyReasons),
      renderDecisionSection(xray.decisionRecords)
    ].join("")
  );
}

export function createContextXrayDemoStory(story: DemoStoryId): ContextXrayDetails {
  const offset = story === "U1" ? 0 : story === "U2" ? 3 : 6;
  const reasonCodes: readonly ReasonCode[] =
    story === "U1"
      ? ["current_context", "exact_value", "eligible_gist_safe"]
      : story === "U2"
        ? ["code_or_command", "secret_sensitive", "safe_mode"]
        : ["stale_duplicate", "renderer_failure", "recoverable"];
  return {
    beforeAfterComparison: [
      xrayComparison(
        "Input tokens",
        18_000 + offset * 500,
        11_200 + offset * 350,
        "Token count before and after Safe-mode decisions."
      ),
      xrayComparison(
        "Native blocks",
        9 + offset,
        6 + offset,
        "Blocks kept as provider-native text before and after policy."
      )
    ],
    blockCount: 12 + offset,
    cacheSensitiveContent: [
      xrayMetric(
        "Provider cached",
        3 + offset,
        "Blocks whose provider cache status affects savings."
      ),
      xrayMetric("Context Diet cache", 2 + offset, "Blocks eligible for local reuse accounting.")
    ],
    codeAndCommandContent: [
      xrayMetric(
        "Code blocks",
        2 + offset,
        "Source-like blocks kept native unless explicitly safe."
      ),
      xrayMetric(
        "Shell commands",
        1 + (offset % 2),
        "Command content treated as exact and action-sensitive."
      )
    ],
    completedVsActiveToolState: [
      xrayMetric(
        "Completed tool results",
        2 + offset,
        "Tool results no longer active in the host state."
      ),
      xrayMetric(
        "Active tool state",
        story === "U2" ? 2 : 1,
        "Active or incomplete tool state preserved as native."
      )
    ],
    currentContextHidden: true,
    currentVsOldContext: [
      xrayMetric(
        "Current context",
        4 + offset,
        "Current user/developer instructions and active turn content."
      ),
      xrayMetric("Old context", 8 + offset, "Earlier history eligible for policy review.")
    ],
    decisionRecords: [
      decisionMetric("KEEP_NATIVE", 5 + offset),
      decisionMetric("RENDER_RECOVERABLE", 3 + offset),
      decisionMetric("DEDUPLICATE", story === "U3" ? 3 : 1)
    ],
    exactRetrievalEvents: [
      xrayMetric(
        "Retrieval calls",
        story === "U1" ? 1 : story === "U2" ? 2 : 4,
        "Authorised exact-context recovery events."
      )
    ],
    exactVsSemantic: [
      xrayMetric(
        "Exact required",
        story === "U1" ? 5 : 7 + offset,
        "Values that require exact native representation or recovery."
      ),
      xrayMetric(
        "Semantic gist-safe",
        4 + offset,
        "Content eligible for semantic rendering decisions."
      )
    ],
    fallbackEvents: [
      xrayMetric(
        "Fallbacks",
        story === "U3" ? 4 : 1,
        "Events where original content stayed native after a failed or blocked transform."
      )
    ],
    policyReasons: reasonCodes.map((code, index) => ({
      code,
      count: index + 1 + offset,
      explanation: explainReasonForDashboard(code)
    })),
    protectedBlockCount: 5 + offset,
    providerComparison: [
      xrayMetric("OpenAI-shaped", 6 + offset, "Blocks observed on the OpenAI Responses path."),
      xrayMetric("Anthropic-shaped", 6 + offset, "Blocks observed on the Anthropic Messages path.")
    ],
    recoveryAvailability: [
      xrayMetric("Recoverable", 5 + offset, "Blocks with authorised exact sidecar recovery."),
      xrayMetric("Native only", 3 + offset, "Blocks intentionally unavailable for image recovery.")
    ],
    rendererCandidates: [
      xrayMetric("Candidates", 4 + offset, "Blocks that reached renderer eligibility checks."),
      xrayMetric(
        "Rejected candidates",
        story === "U2" ? 3 : 1,
        "Candidates rejected by safety, profile or renderer constraints."
      )
    ],
    repeatedContent: [
      xrayMetric(
        "Duplicates",
        story === "U3" ? 5 : 2,
        "Repeated content that may be deduplicated only when stale and safe."
      )
    ],
    requestComposition: [
      xrayMetric("Messages", 7 + offset, "Provider-neutral message blocks in request order."),
      xrayMetric("Tool items", 3 + offset, "Tool calls and results preserved for host continuity."),
      xrayMetric("Images", 2, "Existing image inputs passed through unchanged.")
    ],
    retrievalEligibleCount: 3 + offset,
    secretSensitiveCounts: [
      xrayMetric(
        "Secret-sensitive spans",
        story === "U2" ? 4 : 1,
        "Detected secret-like spans that are never rendered."
      ),
      xrayMetric("Secret-clean blocks", 8 + offset, "Blocks with no secret-sensitive spans.")
    ],
    sessionTrend: [
      xrayMetric("Previous session", 10 + offset, "Synthetic prior-session X-ray block count."),
      xrayMetric("Current session", 12 + offset, "Synthetic current-session X-ray block count.")
    ]
  };
}

function renderMetricSection(title: string, metrics: readonly XrayMetric[]): string {
  return `<section class="xray-section" aria-label="${escapeHtml(title)}"><h3>${escapeHtml(title)}</h3><ul class="xray-list">${metrics
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.label)}:</strong> ${item.value}. ${escapeHtml(item.description)}</li>`
    )
    .join("")}</ul></section>`;
}

function renderComparisonSection(title: string, comparisons: readonly XrayComparison[]): string {
  return `<section class="xray-section" aria-label="${escapeHtml(title)}"><h3>${escapeHtml(title)}</h3><ul class="xray-list">${comparisons
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.label)}:</strong> before ${item.before}, after ${item.after}. ${escapeHtml(item.description)}</li>`
    )
    .join("")}</ul></section>`;
}

function renderReasonSection(reasons: readonly XrayReasonSummary[]): string {
  return `<section class="xray-section" aria-label="Policy reasons"><h3>Policy reasons</h3><ul class="xray-list">${reasons
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.code)} (${item.count}):</strong> ${escapeHtml(item.explanation)}</li>`
    )
    .join("")}</ul></section>`;
}

function renderDecisionSection(records: readonly XrayDecisionSummary[]): string {
  return `<section class="xray-section" aria-label="Decision records"><h3>Decision records</h3><ul class="xray-list">${records
    .map((item) => `<li><strong>${escapeHtml(item.action)}:</strong> ${item.count}</li>`)
    .join("")}</ul></section>`;
}

function xrayMetric(label: string, value: number, description: string): XrayMetric {
  return { description, label, value };
}

function xrayComparison(
  label: string,
  before: number,
  after: number,
  description: string
): XrayComparison {
  return { after, before, description, label };
}

function decisionMetric(action: DecisionAction, count: number): XrayDecisionSummary {
  return { action, count };
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
  const presetSelection = selectProductPolicyPreset({
    experimentalSession: model.experimentalSession,
    organisationForbiddenPresets: model.organisationForbiddenPresets,
    requestedPreset: model.policyPreset,
    syntheticSession: model.syntheticSession
  });
  return card(
    "Session control",
    [
      metric("Session", escapeHtml(model.sessionControl.sessionId ?? "none")),
      metric("Policy preset", escapeHtml(model.policyPreset)),
      metric("Internal mode", escapeHtml(presetSelection.definition.internalMode)),
      metric(
        "Delete",
        model.sessionControl.canDeleteSession ? "available with confirmation" : "unavailable"
      ),
      renderPresetSelector(model, presetSelection.allowed),
      `<div class="controls" aria-label="Session controls">
        <button type="button">Copy safe status</button>
        <button type="button">Dry-run delete session</button>
        <button type="button">Restore direct routing</button>
      </div>`
    ].join("")
  );
}

function renderCompatibilityLeaderboard(model: DashboardViewModel): string {
  return card(
    "Compatibility leaderboard",
    renderCompatibilityLeaderboardContent(model.compatibilityLeaderboard)
  );
}

function renderCompatibilityLeaderboardContent(leaderboard: LocalCompatibilityLeaderboard): string {
  return [
    `<p class="muted">${leaderboard.simulatorNotice}. ${leaderboard.resultNotice}. No combined winner score is shown.</p>`,
    metric("Rejected evidence", String(leaderboard.rejectedEvidenceCount)),
    metric("Expired evidence", String(leaderboard.expiredEvidenceCount)),
    ...Object.entries(leaderboard.rankings).map(
      ([dimension, entries]) =>
        `<section class="xray-section" aria-label="${escapeHtml(labelDimension(dimension))}"><h3>${escapeHtml(labelDimension(dimension))}</h3><ol class="xray-list">${entries
          .map(
            (entry) =>
              `<li><strong>${escapeHtml(entry.profileId)}</strong>: ${escapeHtml(entry.valueLabel)} (${escapeHtml(entry.providerSimulator)}, ${escapeHtml(entry.modelSimulatorVersion)}, signature ${escapeHtml(entry.evidenceSignature)})</li>`
          )
          .join("")}</ol></section>`
    ),
    `<p class="muted">${escapeHtml(leaderboard.note)}</p>`
  ].join("");
}

function labelDimension(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderPresetSelector(model: DashboardViewModel, currentAllowed: boolean): string {
  return `<fieldset class="xray-section" aria-label="Policy preset selector"><legend>Policy preset selector</legend><p class="muted">Protect First is the default. Presets map to existing internal modes and never weaken the safety floor.</p>${(
    Object.keys(productPolicyPresets) as ProductPolicyPreset[]
  )
    .map((preset) => {
      const selection = selectProductPolicyPreset({
        experimentalSession: model.experimentalSession,
        organisationForbiddenPresets: model.organisationForbiddenPresets,
        requestedPreset: preset,
        syntheticSession: model.syntheticSession
      });
      const disabled = selection.allowed ? "" : " disabled";
      const checked = model.policyPreset === preset ? " checked" : "";
      return `<label><input type="radio" name="policy-preset" value="${escapeHtml(preset)}"${checked}${disabled}> ${escapeHtml(preset)} maps to ${escapeHtml(selection.definition.internalMode)}${selection.allowed ? "" : " (not available)"}</label>`;
    })
    .join(
      "<br>"
    )}<p class="${currentAllowed ? "muted" : "blocker"}">${currentAllowed ? "Current preset is allowed." : "Current preset is blocked by session or organisation policy."}</p></fieldset>`;
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
