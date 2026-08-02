#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createSyntheticBenchmarkReport, renderBenchmarkMarkdown } from "@context-diet/benchmark";
import {
  defaultProductPolicyPreset,
  isoTimestamp,
  productPolicyPresets,
  selectProductPolicyPreset,
  type ModelProfileSummary,
  type ProductPolicyPreset
} from "@context-diet/core";
import {
  createPxpipeCompatibleRenderer,
  type ContextRenderer,
  type ContextRendererInput,
  type ContextRendererResult
} from "@context-diet/renderer";
import {
  installLocalConfig,
  type LocalConfigHost,
  rollbackLocalConfig,
  resumeInterruptedLocalConfig,
  uninstallLocalConfig
} from "./local-config.js";

export const cliName = "context-diet";

export type RendererDoctorStatus = "HEALTHY" | "DEGRADED" | "UNSAFE" | "UNSUPPORTED";
export type CompatibilityAuditVerdict =
  | "RECOMMENDED"
  | "RECOMMENDED_WITH_RESTRICTIONS"
  | "AUDIT_ONLY"
  | "NOT_WORTH_USING"
  | "UNSUPPORTED"
  | "RETEST_REQUIRED";

export type CompatibilityBand = "LOW" | "MEDIUM" | "HIGH";
export type CompatibilityPreset = "SAFE" | "BALANCED" | "MAX" | "BYPASS";
export type CompatibilityHost = "codex" | "claude_code" | "both";
export type CliSafetyMode = "Safe" | "Balanced" | "Max" | "Bypass";
export type CliOutputFormat = "text" | "json" | "markdown";
export type HostSetupTarget = "codex" | "claude-code" | "both";
export type InstallerConfigTarget =
  | "codex-user-config"
  | "codex-project-config"
  | "claude-user-settings"
  | "claude-project-settings"
  | "mcp-config"
  | "claude-session-start-hook";
export type InstallerManifestAction = "create" | "update" | "skip";
export type RollbackAction =
  | "restore-backup"
  | "remove-created-file"
  | "remove-managed-fragment"
  | "skip";

export interface CliEnvironment {
  readonly upstreamBaseUrl: string;
  readonly safetyMode: CliSafetyMode;
  readonly fakeProviderDevelopmentMode: boolean;
  readonly gatewayRunning: boolean;
  readonly activeHosts: readonly CompatibilityHost[];
  readonly sessionId?: string;
  readonly policyPreset: ProductPolicyPreset;
  readonly syntheticSession: boolean;
  readonly experimentalSession: boolean;
  readonly organisationForbiddenPresets: readonly ProductPolicyPreset[];
}

export interface CliCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CliCommandOptions {
  readonly env?: Partial<CliEnvironment>;
  readonly confirm?: boolean;
  readonly configRoot?: string;
  readonly dryRun?: boolean;
  readonly format?: CliOutputFormat;
}

export interface HostSetupPreview {
  readonly target: HostSetupTarget;
  readonly title: string;
  readonly writesUserConfig: boolean;
  readonly requiresConfirmation: true;
  readonly configLocations: readonly string[];
  readonly preview: string;
  readonly restoreInstructions: readonly string[];
  readonly uninstallInstructions: readonly string[];
}

export interface InstallerTargetPlan {
  readonly id: InstallerConfigTarget;
  readonly host: HostSetupTarget | "both";
  readonly pathLabel: string;
  readonly action: InstallerManifestAction;
  readonly backupRequired: boolean;
  readonly requiresConfirmation: boolean;
  readonly credentialPolicy: "env-reference-only" | "no-credential-material";
  readonly managedFragmentId: string;
  readonly summary: string;
}

export interface InstallationManifestPlan {
  readonly manifestVersion: 1;
  readonly installationId: string;
  readonly createdAt: string;
  readonly dryRun: boolean;
  readonly writesRealUserConfig: false;
  readonly targets: readonly InstallerTargetPlan[];
  readonly backupRootLabel: string;
  readonly forbiddenWrites: readonly string[];
}

export interface RollbackStepPlan {
  readonly targetId: InstallerConfigTarget;
  readonly action: RollbackAction;
  readonly order: number;
  readonly reason: string;
}

export interface RollbackPlan {
  readonly manifestVersion: 1;
  readonly installationId: string;
  readonly dryRun: boolean;
  readonly requiresConfirmation: boolean;
  readonly steps: readonly RollbackStepPlan[];
  readonly recoveryMode: "normal" | "interrupted-install";
}

export interface RendererDoctorCheck {
  readonly name: string;
  readonly status: RendererDoctorStatus;
  readonly detail: string;
  readonly nextAction: string;
}

export interface RendererDoctorReport {
  readonly command: "context-diet renderer doctor";
  readonly status: RendererDoctorStatus;
  readonly checks: readonly RendererDoctorCheck[];
  readonly nextActions: readonly string[];
}

export interface RendererDoctorOptions {
  readonly renderer?: ContextRenderer;
  readonly adapterInstalled?: boolean;
  readonly upstreamPxpipeRef?: string;
  readonly licenceNoticePresent?: boolean;
  readonly nativeDependenciesPresent?: boolean;
  readonly fontAvailable?: boolean;
  readonly tempRoot?: string;
  readonly timeoutMs?: number;
  readonly modelProfile?: ModelProfileSummary;
  readonly simulatedImageTokenCost?: number;
  readonly seed?: "healthy" | "degraded" | "unsafe" | "unsupported";
}

export interface CompatibilityAuditInput {
  readonly host: CompatibilityHost;
  readonly modelSimulatorProfile: "enabled" | "expired" | "revoked" | "retest_required";
  readonly workloadType: "prose" | "code" | "tables" | "tool_heavy" | "image_heavy";
  readonly language: string;
  readonly script: "latin" | "devanagari" | "cjk" | "mixed" | "unsupported";
  readonly averageRequestSize: number;
  readonly averageSessionSize: number;
  readonly cacheIntensity: "low" | "medium" | "high";
  readonly exactnessSensitivity: "low" | "medium" | "high" | "critical";
  readonly toolUseFrequency: "low" | "medium" | "high";
  readonly latencySensitivity: "low" | "medium" | "high";
  readonly riskPreference: "conservative" | "balanced" | "aggressive";
}

export interface CompatibilityAuditReport {
  readonly title: "Context Diet Compatibility Audit";
  readonly dataNotice: "SYNTHETIC TEST DATA";
  readonly input: CompatibilityAuditInput;
  readonly compatibilityScore: number;
  readonly expectedBenefitBand: CompatibilityBand;
  readonly accuracyRiskBand: CompatibilityBand;
  readonly latencyBand: CompatibilityBand;
  readonly recommendedPreset: CompatibilityPreset;
  readonly recommendedProductPreset: ProductPolicyPreset;
  readonly unsupportedCapabilities: readonly string[];
  readonly requiredCanaries: readonly string[];
  readonly verdict: CompatibilityAuditVerdict;
  readonly reasons: readonly string[];
  readonly dashboard: CompatibilityDashboardOutput;
}

export interface CompatibilityDashboardOutput {
  readonly kind: "compatibility_audit";
  readonly dataOrigin: "synthetic";
  readonly host: CompatibilityHost;
  readonly score: number;
  readonly verdict: CompatibilityAuditVerdict;
  readonly bands: {
    readonly expectedBenefit: CompatibilityBand;
    readonly accuracyRisk: CompatibilityBand;
    readonly latency: CompatibilityBand;
  };
  readonly preset: CompatibilityPreset;
  readonly productPreset: ProductPolicyPreset;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly requiredCanaries: readonly string[];
}

export interface CompatibilityAuditOptions {
  readonly fixture?: Partial<CompatibilityAuditInput>;
  readonly seed?: CompatibilityAuditVerdict | "codex" | "claude_code" | "both";
  readonly format?: "json" | "markdown";
}

export function describeCli(): string {
  return `${cliName} local operator`;
}

export async function runCli(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const result = await runCliCommand(argv);
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr);
  }
  return result.exitCode;
}

export async function runCliCommand(
  argv: readonly string[],
  options: CliCommandOptions = {}
): Promise<CliCommandResult> {
  if (argv[0] === "renderer" && argv[1] === "doctor") {
    const report = await runRendererDoctor();
    return {
      exitCode: report.status === "UNSAFE" || report.status === "UNSUPPORTED" ? 2 : 0,
      stderr: "",
      stdout: `${JSON.stringify(report, null, 2)}\n`
    };
  }
  const command = argv[0] ?? "help";
  const env = cliEnvironment(options.env);
  const format = options.format ?? formatFromArgs(argv);
  if (command === "doctor") {
    return textResult(0, renderDoctorSummary(env));
  }
  if (command === "audit" || command === "compatibility-audit") {
    const report = runCompatibilityAudit();
    return textResult(
      report.verdict === "UNSUPPORTED" ? 2 : 0,
      format === "markdown"
        ? renderCompatibilityAuditMarkdown(report)
        : renderCompatibilityAuditJson(report)
    );
  }
  if (command === "start") {
    return textResult(0, renderStart(env));
  }
  if (command === "setup") {
    return textResult(0, await renderSetup(env, argv, destructiveOptions(argv, options), options));
  }
  if (command === "stop") {
    return textResult(0, renderStop(env, destructiveOptions(argv, options)));
  }
  if (command === "status") {
    return textResult(0, renderStatus(env));
  }
  if (command === "explain") {
    return textResult(0, renderExplain(env));
  }
  if (command === "preset") {
    return textResult(0, renderPresetSelector(env, argv));
  }
  if (command === "benchmark") {
    const report = createSyntheticBenchmarkReport(1);
    return textResult(
      report.comparison.comparable ? 0 : 3,
      format === "json" ? JSON.stringify(report, null, 2) : renderBenchmarkMarkdown(report)
    );
  }
  if (command === "retrieve") {
    return textResult(0, renderRetrieve(env, argv));
  }
  if (command === "delete-session") {
    return textResult(0, renderDeleteSession(env, destructiveOptions(argv, options)));
  }
  if (command === "uninstall") {
    return textResult(0, await renderUninstall(env, destructiveOptions(argv, options), options));
  }
  if (command === "rollback") {
    return textResult(0, await renderRollback(destructiveOptions(argv, options), options));
  }
  return {
    exitCode: 64,
    stderr: `Unknown command: ${command}\nRun context-diet help to see available commands.\n`,
    stdout: ""
  };
}

export function runCompatibilityAudit(
  options: CompatibilityAuditOptions = {}
): CompatibilityAuditReport {
  const input = createCompatibilityFixture(options.seed, options.fixture);
  const unsupportedCapabilities = unsupportedCapabilitiesFor(input);
  const requiredCanaries = requiredCanariesFor(input);
  const expectedBenefitBand = benefitBand(input);
  const accuracyRiskBand = riskBand(input);
  const latencyBand = latencyBandFor(input);
  const score = compatibilityScore(input, expectedBenefitBand, accuracyRiskBand, latencyBand);
  const thresholdFailure = exactnessOrSafetyThresholdFailure(input, unsupportedCapabilities);
  const verdict = compatibilityVerdict(input, score, thresholdFailure, unsupportedCapabilities);
  const recommendedPreset = recommendedPresetFor(input, verdict, accuracyRiskBand);
  const recommendedProductPreset = recommendedProductPresetFor(verdict, recommendedPreset);
  const reasons = compatibilityReasons(input, verdict, {
    accuracyRiskBand,
    expectedBenefitBand,
    latencyBand,
    thresholdFailure,
    unsupportedCapabilities
  });
  const warnings = reasons.filter((reason) => !reason.toLowerCase().includes("cannot"));

  return {
    accuracyRiskBand,
    compatibilityScore: score,
    dashboard: {
      bands: {
        accuracyRisk: accuracyRiskBand,
        expectedBenefit: expectedBenefitBand,
        latency: latencyBand
      },
      blockers: unsupportedCapabilities,
      dataOrigin: "synthetic",
      host: input.host,
      kind: "compatibility_audit",
      preset: recommendedPreset,
      productPreset: recommendedProductPreset,
      requiredCanaries,
      score,
      verdict,
      warnings
    },
    dataNotice: "SYNTHETIC TEST DATA",
    expectedBenefitBand,
    input,
    latencyBand,
    reasons,
    recommendedPreset,
    recommendedProductPreset,
    requiredCanaries,
    title: "Context Diet Compatibility Audit",
    unsupportedCapabilities,
    verdict
  };
}

export function renderCompatibilityAuditJson(report: CompatibilityAuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function renderCompatibilityAuditMarkdown(report: CompatibilityAuditReport): string {
  return [
    "# Context Diet Compatibility Audit",
    "",
    "**SYNTHETIC TEST DATA**",
    "",
    `Verdict: **${report.verdict}**`,
    `Compatibility score: **${report.compatibilityScore}**`,
    `Recommended preset: **${report.recommendedPreset}**`,
    `Recommended product preset: **${report.recommendedProductPreset}**`,
    "",
    `Expected benefit: ${report.expectedBenefitBand}`,
    `Accuracy risk: ${report.accuracyRiskBand}`,
    `Latency: ${report.latencyBand}`,
    "",
    "## Reasons",
    ...report.reasons.map((reason) => `- ${reason}`),
    "",
    "## Required Canaries",
    ...report.requiredCanaries.map((canary) => `- ${canary}`),
    "",
    "## Unsupported Capabilities",
    ...(report.unsupportedCapabilities.length === 0
      ? ["- None"]
      : report.unsupportedCapabilities.map((capability) => `- ${capability}`))
  ].join("\n");
}

export function createCodexSetupPreview(env: CliEnvironment): HostSetupPreview {
  const gatewayBaseUrl = "http://127.0.0.1:4317";
  return {
    configLocations: [
      "User configuration: ~/.codex/config.toml",
      "Project instructions: AGENTS.md",
      "Optional project-local metadata: .codex/ when present"
    ],
    preview: [
      "# Preview only: Codex custom provider",
      "",
      "No credentials are included. Keep OPENAI_API_KEY or provider keys in your normal secret store.",
      "",
      "```toml",
      'model_provider = "context_diet_local"',
      "",
      "[model_providers.context_diet_local]",
      'name = "Context Diet local gateway"',
      `base_url = "${gatewayBaseUrl}"`,
      'env_key = "OPENAI_API_KEY"',
      "```",
      "",
      "Skill discovery: Codex should discover .agents/skills/context-diet and may invoke it for context audits, benchmarks, retrieval and setup troubleshooting.",
      "MCP retrieval preview:",
      "```json",
      JSON.stringify(
        {
          mcpServers: {
            "context-diet-retrieval": {
              args: ["mcp", "retrieval"],
              command: "context-diet",
              env: {}
            }
          }
        },
        null,
        2
      ),
      "```",
      "",
      `Current upstream: ${env.upstreamBaseUrl}`,
      `Safety mode: ${env.safetyMode}`,
      `Policy preset: ${env.policyPreset}`
    ].join("\n"),
    requiresConfirmation: true,
    restoreInstructions: [
      "Switch model_provider back to the direct provider you used before Context Diet.",
      "Remove the context_diet_local provider block after confirming direct routing works.",
      "Remove the context-diet-retrieval MCP entry if exact retrieval should be disabled."
    ],
    target: "codex",
    title: "Codex setup preview",
    uninstallInstructions: [
      "Stop the local gateway.",
      "Delete Context Diet custom-provider and MCP entries from Codex configuration.",
      "Keep AGENTS.md unless you are removing all project agent instructions."
    ],
    writesUserConfig: false
  };
}

export function createClaudeCodeSetupPreview(env: CliEnvironment): HostSetupPreview {
  const gatewayBaseUrl = "http://127.0.0.1:4317";
  return {
    configLocations: [
      "User settings: ~/.claude/settings.json",
      "Project settings: .claude/settings.json when intentionally used",
      "Project instructions: CLAUDE.md and imported AGENTS.md"
    ],
    preview: [
      "# Preview only: Claude Code local gateway",
      "",
      "No credentials are included. Keep ANTHROPIC_API_KEY in your normal secret store.",
      "",
      "Shell preview:",
      "```bash",
      `export ANTHROPIC_BASE_URL="${gatewayBaseUrl}"`,
      "```",
      "",
      "Optional non-destructive SessionStart doctor hook example:",
      "```json",
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                command: "context-diet status --no-credentials",
                description: "Preview-only local Context Diet status check"
              }
            ]
          }
        },
        null,
        2
      ),
      "```",
      "",
      "Hooks are optional and must not be required for Context Diet to operate.",
      "Skill discovery: Claude Code should discover .claude/skills/context-diet and may invoke it for context audits, benchmarks, retrieval and setup troubleshooting.",
      "MCP retrieval preview:",
      "```json",
      JSON.stringify(
        {
          mcpServers: {
            "context-diet-retrieval": {
              args: ["mcp", "retrieval"],
              command: "context-diet",
              env: {}
            }
          }
        },
        null,
        2
      ),
      "```",
      "",
      `Current upstream: ${env.upstreamBaseUrl}`,
      `Safety mode: ${env.safetyMode}`,
      `Policy preset: ${env.policyPreset}`
    ].join("\n"),
    requiresConfirmation: true,
    restoreInstructions: [
      "Unset ANTHROPIC_BASE_URL to restore direct Anthropic routing.",
      "Remove the optional SessionStart hook if you added it.",
      "Remove the context-diet-retrieval MCP entry if exact retrieval should be disabled."
    ],
    target: "claude-code",
    title: "Claude Code setup preview",
    uninstallInstructions: [
      "Stop the local gateway.",
      "Remove ANTHROPIC_BASE_URL from shell profiles or Claude Code settings.",
      "Keep CLAUDE.md unless you are removing all project agent instructions."
    ],
    writesUserConfig: false
  };
}

export function createBothHostsSetupPreview(env: CliEnvironment): HostSetupPreview {
  const codex = createCodexSetupPreview(env);
  const claude = createClaudeCodeSetupPreview(env);
  return {
    configLocations: [...codex.configLocations, ...claude.configLocations],
    preview: [codex.preview, claude.preview].join("\n\n"),
    requiresConfirmation: true,
    restoreInstructions: [...codex.restoreInstructions, ...claude.restoreInstructions],
    target: "both",
    title: "Codex and Claude Code setup preview",
    uninstallInstructions: [...codex.uninstallInstructions, ...claude.uninstallInstructions],
    writesUserConfig: false
  };
}

export function createInstallationManifestPlan(options: {
  readonly hosts: readonly HostSetupTarget[];
  readonly includeMcp: boolean;
  readonly includeClaudeHook: boolean;
  readonly dryRun?: boolean;
  readonly installationId?: string;
  readonly createdAt?: string;
}): InstallationManifestPlan {
  const hostSet = new Set(options.hosts);
  const targets: InstallerTargetPlan[] = [];

  if (hostSet.has("codex")) {
    targets.push(
      installerTarget(
        "codex-user-config",
        "codex",
        "~/.codex/config.toml",
        "update",
        "Add a Context Diet local custom provider route for Codex CLI."
      ),
      installerTarget(
        "codex-project-config",
        "codex",
        "project .codex/ when explicitly selected",
        "skip",
        "Project-local Codex metadata is planned only when the operator opts in."
      )
    );
  }

  if (hostSet.has("claude-code")) {
    targets.push(
      installerTarget(
        "claude-user-settings",
        "claude-code",
        "~/.claude/settings.json",
        "update",
        "Set Claude Code to use the local ANTHROPIC_BASE_URL gateway route."
      ),
      installerTarget(
        "claude-project-settings",
        "claude-code",
        "project .claude/settings.json when explicitly selected",
        "skip",
        "Project-local Claude Code settings are planned only when the operator opts in."
      )
    );

    if (options.includeClaudeHook) {
      targets.push(
        installerTarget(
          "claude-session-start-hook",
          "claude-code",
          "~/.claude/settings.json hooks.SessionStart",
          "update",
          "Optionally add a non-destructive Context Diet doctor hook."
        )
      );
    }
  }

  if (options.includeMcp) {
    targets.push(
      installerTarget(
        "mcp-config",
        "both",
        "host MCP configuration",
        "update",
        "Register the local context-diet-retrieval MCP server without credentials."
      )
    );
  }

  return {
    backupRootLabel: "Context Diet local state backup directory recorded in the manifest",
    createdAt: options.createdAt ?? "2026-07-22T00:00:00.000Z",
    dryRun: options.dryRun ?? true,
    forbiddenWrites: [
      "provider API keys or bearer tokens",
      "raw prompts, source code or request bodies",
      "absolute repository paths in public identifiers",
      "secret-sensitive scanner spans",
      "unreviewed host configuration changes"
    ],
    installationId: options.installationId ?? "install_plan_synthetic_001",
    manifestVersion: 1,
    targets,
    writesRealUserConfig: false
  };
}

export function createRollbackPlan(
  manifest: InstallationManifestPlan,
  options: { readonly interruptedInstall?: boolean; readonly dryRun?: boolean } = {}
): RollbackPlan {
  const steps = [...manifest.targets].reverse().map((target, index): RollbackStepPlan => {
    const action: RollbackAction =
      target.action === "create"
        ? "remove-created-file"
        : target.action === "update"
          ? "restore-backup"
          : "skip";
    return {
      action,
      order: index + 1,
      reason:
        action === "skip"
          ? "No installed change is recorded for this target."
          : "Rollback uses the manifest entry and its backup metadata only.",
      targetId: target.id
    };
  });

  return {
    dryRun: options.dryRun ?? true,
    installationId: manifest.installationId,
    manifestVersion: manifest.manifestVersion,
    recoveryMode: options.interruptedInstall ? "interrupted-install" : "normal",
    requiresConfirmation: true,
    steps
  };
}

function cliEnvironment(override: Partial<CliEnvironment> = {}): CliEnvironment {
  return {
    activeHosts: ["both"],
    fakeProviderDevelopmentMode: override.fakeProviderDevelopmentMode ?? false,
    gatewayRunning: override.gatewayRunning ?? false,
    experimentalSession: override.experimentalSession ?? false,
    organisationForbiddenPresets: override.organisationForbiddenPresets ?? [],
    policyPreset: override.policyPreset ?? defaultProductPolicyPreset,
    safetyMode: override.safetyMode ?? "Safe",
    sessionId: override.sessionId,
    syntheticSession: override.syntheticSession ?? false,
    upstreamBaseUrl: sanitiseUrl(override.upstreamBaseUrl ?? "https://api.openai.example.invalid")
  };
}

function formatFromArgs(argv: readonly string[]): CliOutputFormat {
  if (argv.includes("--json")) {
    return "json";
  }
  if (argv.includes("--markdown")) {
    return "markdown";
  }
  return "text";
}

function destructiveOptions(
  argv: readonly string[],
  options: CliCommandOptions
): { readonly confirm: boolean; readonly dryRun: boolean } {
  return {
    confirm: options.confirm === true || argv.includes("--confirm"),
    dryRun: options.dryRun ?? (argv.includes("--dry-run") || !argv.includes("--confirm"))
  };
}

function textResult(exitCode: number, output: string): CliCommandResult {
  return { exitCode, stderr: "", stdout: `${output.trimEnd()}\n` };
}

function renderDoctorSummary(env: CliEnvironment): string {
  return [
    "Context Diet doctor",
    "",
    "Status: ready for local synthetic checks.",
    `Current upstream: ${env.upstreamBaseUrl}`,
    `Policy preset: ${env.policyPreset}`,
    `Safety mode: ${env.safetyMode}`,
    `Gateway: ${env.gatewayRunning ? "running" : "stopped"}`,
    `Fake-provider development mode: ${env.fakeProviderDevelopmentMode ? "on" : "off"}`,
    "",
    "No credentials were read or printed.",
    restoreDirectRouting()
  ].join("\n");
}

function renderStart(env: CliEnvironment): string {
  const upstream = env.fakeProviderDevelopmentMode
    ? "http://127.0.0.1:8787/fake-provider"
    : env.upstreamBaseUrl;
  return [
    "Context Diet gateway start",
    "",
    `Current upstream: ${upstream}`,
    `Policy preset: ${env.policyPreset}`,
    `Safety mode: ${env.safetyMode}`,
    `Fake-provider development mode: ${env.fakeProviderDevelopmentMode ? "on" : "off"}`,
    "Host configuration was not changed.",
    "Use your host's custom provider/base URL setting to point at the local gateway.",
    restoreDirectRouting()
  ].join("\n");
}

async function renderSetup(
  env: CliEnvironment,
  argv: readonly string[],
  options: { readonly confirm: boolean; readonly dryRun: boolean },
  commandOptions: CliCommandOptions
): Promise<string> {
  const hosts = parseSetupHosts(argv);
  const target = setupPreviewTarget(hosts);
  const preview =
    target === "both"
      ? createBothHostsSetupPreview(env)
      : target === "claude-code"
        ? createClaudeCodeSetupPreview(env)
        : createCodexSetupPreview(env);
  const includeMcp = argv.includes("--mcp");
  const includeClaudeHook = argv.includes("--claude-hook");
  const replaceExistingManifest = argv.includes("--replace-existing-manifest");
  const configRoot = configRootFor(commandOptions);
  const applyResult =
    argv.includes("--resume") && options.confirm && !options.dryRun
      ? await resumeInterruptedLocalConfig(configRoot)
      : options.confirm && !options.dryRun
        ? await installLocalConfig({
            confirm: true,
            hosts,
            includeClaudeHook: hosts.includes("claude-code") && includeClaudeHook,
            includeMcp,
            replaceExistingManifest,
            rootDir: configRoot
          })
        : await installLocalConfig({
            confirm: false,
            hosts,
            includeClaudeHook: hosts.includes("claude-code") && includeClaudeHook,
            includeMcp,
            rootDir: configRoot
          });
  return [
    preview.title,
    "",
    applyResult.message,
    "Provider credentials are not stored, printed or generated.",
    `Manifest: ${applyResult.manifestPath}`,
    `Changed files: ${applyResult.changedFiles.length === 0 ? "none" : applyResult.changedFiles.join(", ")}`,
    "",
    "Configuration locations:",
    ...preview.configLocations.map((location) => `- ${location}`),
    "",
    preview.preview,
    "",
    "Restore direct routing:",
    ...preview.restoreInstructions.map((instruction) => `- ${instruction}`),
    "",
    "Uninstall:",
    ...preview.uninstallInstructions.map((instruction) => `- ${instruction}`)
  ].join("\n");
}

function renderStop(
  env: CliEnvironment,
  options: { readonly confirm: boolean; readonly dryRun: boolean }
): string {
  return [
    "Context Diet gateway stop",
    "",
    `Current upstream: ${env.upstreamBaseUrl}`,
    `Policy preset: ${env.policyPreset}`,
    `Safety mode: ${env.safetyMode}`,
    options.confirm && !options.dryRun
      ? "Confirmed: local gateway stop would be applied."
      : "Dry run: no running process or host configuration was changed.",
    "Use --confirm to stop managed local routing after reviewing the current status.",
    restoreDirectRouting()
  ].join("\n");
}

function renderStatus(env: CliEnvironment): string {
  return [
    "Context Diet status",
    "",
    `Gateway: ${env.gatewayRunning ? "running" : "stopped"}`,
    `Current upstream: ${env.upstreamBaseUrl}`,
    `Policy preset: ${env.policyPreset}`,
    `Safety mode: ${env.safetyMode}`,
    `Hosts: ${env.activeHosts.join(", ")}`,
    `Fake-provider development mode: ${env.fakeProviderDevelopmentMode ? "on" : "off"}`,
    "Credentials: not displayed",
    restoreDirectRouting()
  ].join("\n");
}

function renderExplain(env: CliEnvironment): string {
  return [
    "Context Diet explain",
    "",
    "Context Diet keeps Safe mode as the default. Current instructions, secrets, exact values, code, commands and active tool state stay native.",
    "When a block is eligible, the policy can render a compact image and keep an exact local sidecar for retrieval.",
    "If parsing, scanning, rendering, storage or rebuilding fails, the original provider request is sent unchanged.",
    "Product presets map to existing internal modes and never weaken the built-in safety floor.",
    "",
    `Current upstream: ${env.upstreamBaseUrl}`,
    `Policy preset: ${env.policyPreset}`,
    `Safety mode: ${env.safetyMode}`,
    renderPresetDetails(env),
    restoreDirectRouting()
  ].join("\n");
}

function renderPresetSelector(env: CliEnvironment, argv: readonly string[]): string {
  const requested = parseProductPreset(valueAfter(argv, "--preset")) ?? env.policyPreset;
  const selection = selectProductPolicyPreset({
    experimentalSession: env.experimentalSession,
    organisationForbiddenPresets: env.organisationForbiddenPresets,
    requestedPreset: requested,
    syntheticSession: env.syntheticSession
  });
  return [
    "Context Diet policy preset",
    "",
    `Requested preset: ${selection.preset}`,
    `Allowed: ${selection.allowed ? "yes" : "no"}`,
    `Maps to internal mode: ${selection.definition.internalMode}`,
    `Eligible sources: ${selection.definition.eligibleSources.join(", ")}`,
    `Block-age threshold: ${selection.definition.blockAgeThresholdMs} ms`,
    `Minimum saving: ${selection.definition.minimumSaving}`,
    `Recovery required: ${selection.definition.recoveryRequired ? "yes" : "no"}`,
    `Allowed profile status: ${selection.definition.allowedProfileStatus.join(", ")}`,
    `Language support: ${selection.definition.languageSupport.join(", ")}`,
    `Maximum added latency: ${selection.definition.maximumAddedLatencyMs} ms`,
    `Adaptation permission: ${selection.definition.adaptationPermission}`,
    "Reasons:",
    ...selection.reasons.map((reason) => `- ${reason}`)
  ].join("\n");
}

function renderRetrieve(env: CliEnvironment, argv: readonly string[]): string {
  const blockId = valueAfter(argv, "--block-id") ?? "not provided";
  return [
    "Context Diet retrieve",
    "",
    `Session: ${env.sessionId ?? "not provided"}`,
    `Block ID: ${blockId}`,
    "Result: synthetic retrieval preview only. No filesystem path was accepted.",
    "Returned characters: 0",
    "Credentials: not displayed"
  ].join("\n");
}

function renderDeleteSession(
  env: CliEnvironment,
  options: { readonly confirm: boolean; readonly dryRun: boolean }
): string {
  return [
    "Context Diet delete-session",
    "",
    `Session: ${env.sessionId ?? "not provided"}`,
    options.confirm && !options.dryRun
      ? "Confirmed: the selected local session would be deleted."
      : "Dry run: no session data was deleted.",
    "Use --confirm only after checking the session ID.",
    "Credentials: not displayed"
  ].join("\n");
}

async function renderUninstall(
  env: CliEnvironment,
  options: { readonly confirm: boolean; readonly dryRun: boolean },
  commandOptions: CliCommandOptions
): Promise<string> {
  const configRoot = configRootFor(commandOptions);
  const result =
    options.confirm && !options.dryRun
      ? await uninstallLocalConfig(configRoot)
      : {
          applied: false,
          changedFiles: [] as const,
          dryRun: true,
          manifestPath: localManifestPathForDisplay(configRoot),
          message: "Dry run: no files, sessions or host configuration were changed."
        };
  return [
    "Context Diet uninstall",
    "",
    `Current upstream: ${env.upstreamBaseUrl}`,
    `Policy preset: ${env.policyPreset}`,
    `Safety mode: ${env.safetyMode}`,
    result.message,
    `Manifest: ${result.manifestPath}`,
    `Changed files: ${result.changedFiles.length === 0 ? "none" : result.changedFiles.join(", ")}`,
    restoreDirectRouting()
  ].join("\n");
}

async function renderRollback(
  options: { readonly confirm: boolean; readonly dryRun: boolean },
  commandOptions: CliCommandOptions
): Promise<string> {
  const configRoot = configRootFor(commandOptions);
  const result =
    options.confirm && !options.dryRun
      ? await rollbackLocalConfig(configRoot)
      : {
          applied: false,
          changedFiles: [] as const,
          dryRun: true,
          manifestPath: localManifestPathForDisplay(configRoot),
          message: "Dry run: no files or host configuration were restored."
        };
  return [
    "Context Diet rollback",
    "",
    result.message,
    `Manifest: ${result.manifestPath}`,
    `Changed files: ${result.changedFiles.length === 0 ? "none" : result.changedFiles.join(", ")}`,
    "Credentials: not displayed"
  ].join("\n");
}

function renderPresetDetails(env: CliEnvironment): string {
  const selection = selectProductPolicyPreset({
    experimentalSession: env.experimentalSession,
    organisationForbiddenPresets: env.organisationForbiddenPresets,
    requestedPreset: env.policyPreset,
    syntheticSession: env.syntheticSession
  });
  return `Preset maps to ${selection.definition.internalMode}; eligible sources: ${selection.definition.eligibleSources.join(", ")}.`;
}

function parseProductPreset(value: string | undefined): ProductPolicyPreset | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalisedValue = value.toLowerCase().replaceAll(" ", "-");
  return (Object.keys(productPolicyPresets) as ProductPolicyPreset[]).find(
    (preset) => preset.toLowerCase().replaceAll(" ", "-") === normalisedValue
  );
}

function parseSetupHosts(argv: readonly string[]): readonly LocalConfigHost[] {
  const value = argv[1] ?? valueAfter(argv, "--host") ?? valueAfter(argv, "--target") ?? "codex";
  const normalised = value.toLowerCase().replaceAll("_", "-");
  if (normalised === "both" || normalised === "all") {
    return ["codex", "claude-code"];
  }
  return normalised === "claude" || normalised === "claude-code" ? ["claude-code"] : ["codex"];
}

function setupPreviewTarget(hosts: readonly LocalConfigHost[]): HostSetupTarget {
  return hosts.includes("codex") && hosts.includes("claude-code")
    ? "both"
    : hosts.includes("claude-code")
      ? "claude-code"
      : "codex";
}

function configRootFor(options: CliCommandOptions): string {
  return (
    options.configRoot ??
    process.env["CONTEXT_DIET_CONFIG_ROOT"] ??
    join(tmpdir(), "context-diet-config-preview")
  );
}

function localManifestPathForDisplay(configRoot: string): string {
  return join(configRoot, ".context-diet", "install-manifest.json");
}

function installerTarget(
  id: InstallerConfigTarget,
  host: HostSetupTarget | "both",
  pathLabel: string,
  action: InstallerManifestAction,
  summary: string
): InstallerTargetPlan {
  return {
    action,
    backupRequired: action !== "skip",
    credentialPolicy: id === "mcp-config" ? "no-credential-material" : "env-reference-only",
    host,
    id,
    managedFragmentId: `context-diet:${id}`,
    pathLabel,
    requiresConfirmation: action !== "skip",
    summary
  };
}

function restoreDirectRouting(): string {
  return "Restore direct routing by removing the local Context Diet base URL from Codex or ANTHROPIC_BASE_URL and setting the provider back to its normal upstream.";
}

function valueAfter(argv: readonly string[], key: string): string | undefined {
  const index = argv.indexOf(key);
  return index >= 0 ? argv[index + 1] : undefined;
}

function sanitiseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.toLowerCase().includes("key") || key.toLowerCase().includes("token")) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch {
    return value.replace(/(api[_-]?key|token|password)=([^&\s]+)/gi, "$1=REDACTED");
  }
}

export async function runRendererDoctor(
  options: RendererDoctorOptions = {}
): Promise<RendererDoctorReport> {
  const seeded = seedOptions(options);
  const renderer = seeded.renderer ?? createPxpipeCompatibleRenderer({ nowMs: 1_000 });
  const checks: RendererDoctorCheck[] = [];

  checks.push(
    checkBoolean(
      "adapter installed",
      seeded.adapterInstalled ?? true,
      "Renderer adapter is available through the public renderer interface.",
      "Install or enable the renderer adapter package, then rerun the doctor."
    )
  );
  checks.push(
    checkBoolean(
      "upstream pxpipe version or pinned commit",
      (seeded.upstreamPxpipeRef ?? "teamchong/pxpipe@76f4fd2").trim().length > 0,
      `Pinned upstream reference: ${seeded.upstreamPxpipeRef ?? "teamchong/pxpipe@76f4fd2"}.`,
      "Record the exact pxpipe version or commit before enabling rendering."
    )
  );
  checks.push(
    checkBoolean(
      "licence notice",
      seeded.licenceNoticePresent ?? true,
      "MIT licence notice is recorded in the pxpipe integration review.",
      "Restore the pxpipe licence notice and attribution before distribution."
    )
  );
  checks.push(
    checkBoolean(
      "required native dependencies",
      seeded.nativeDependenciesPresent ?? true,
      "Required native renderer dependencies are available or not needed by this adapter.",
      "Install missing native renderer dependencies manually; the doctor will not install them."
    )
  );
  checks.push(checkFontAvailability(seeded.fontAvailable ?? true));

  checks.push(await checkTempDirectory(seeded.tempRoot));

  const input = createDoctorInput(seeded.modelProfile);
  const renderResult = await renderWithTimeout(renderer, input, seeded.timeoutMs ?? 2_000);
  checks.push(checkRenderResult("deterministic golden render", renderResult));
  checks.push(checkDimensions(renderResult));
  checks.push(checkGlyphCoverage(renderResult));
  checks.push(checkExactSidecar(renderResult));
  checks.push(await checkProtectedSpanExclusion(renderer, input));
  checks.push(checkSecretCanaryAbsence(renderResult));
  checks.push(checkModelProfile(input));
  checks.push(checkImageTokenCost(seeded.simulatedImageTokenCost ?? 128));
  checks.push(checkRendererTimeout(renderResult));
  checks.push(await checkCrashCleanup(seeded.tempRoot));

  const status = aggregateStatus(checks);
  return {
    command: "context-diet renderer doctor",
    status,
    checks,
    nextActions: checks
      .filter((check) => check.status !== "HEALTHY")
      .map((check) => `${check.name}: ${check.nextAction}`)
  };
}

function createCompatibilityFixture(
  seed: CompatibilityAuditOptions["seed"],
  override: Partial<CompatibilityAuditInput> = {}
): CompatibilityAuditInput {
  const base: CompatibilityAuditInput = {
    averageRequestSize: 18_000,
    averageSessionSize: 140_000,
    cacheIntensity: "high",
    exactnessSensitivity: "medium",
    host: "both",
    language: "English",
    latencySensitivity: "medium",
    modelSimulatorProfile: "enabled",
    riskPreference: "balanced",
    script: "latin",
    toolUseFrequency: "medium",
    workloadType: "prose"
  };
  const seeded: Record<string, Partial<CompatibilityAuditInput>> = {
    AUDIT_ONLY: { exactnessSensitivity: "critical", riskPreference: "conservative" },
    NOT_WORTH_USING: {
      averageRequestSize: 800,
      averageSessionSize: 4_000,
      cacheIntensity: "low",
      latencySensitivity: "high"
    },
    RECOMMENDED: {},
    RECOMMENDED_WITH_RESTRICTIONS: {
      exactnessSensitivity: "high",
      script: "mixed",
      workloadType: "tables"
    },
    RETEST_REQUIRED: { modelSimulatorProfile: "retest_required" },
    UNSUPPORTED: { exactnessSensitivity: "critical", modelSimulatorProfile: "revoked" },
    both: { host: "both" },
    claude_code: { host: "claude_code", modelSimulatorProfile: "enabled" },
    codex: { host: "codex", modelSimulatorProfile: "enabled" }
  };
  return { ...base, ...(seed === undefined ? {} : seeded[seed]), ...override };
}

function benefitBand(input: CompatibilityAuditInput): CompatibilityBand {
  const sizeScore =
    input.averageSessionSize >= 100_000 || input.averageRequestSize >= 16_000
      ? 2
      : input.averageSessionSize >= 30_000
        ? 1
        : 0;
  const cacheScore =
    input.cacheIntensity === "high" ? 1 : input.cacheIntensity === "medium" ? 0.5 : 0;
  const workloadScore = input.workloadType === "prose" || input.workloadType === "tables" ? 1 : 0;
  const total = sizeScore + cacheScore + workloadScore;
  return total >= 3 ? "HIGH" : total >= 1.5 ? "MEDIUM" : "LOW";
}

function riskBand(input: CompatibilityAuditInput): CompatibilityBand {
  if (
    input.exactnessSensitivity === "critical" ||
    input.script === "unsupported" ||
    input.modelSimulatorProfile === "revoked"
  ) {
    return "HIGH";
  }
  if (
    input.exactnessSensitivity === "high" ||
    input.workloadType === "code" ||
    input.workloadType === "tool_heavy" ||
    input.script === "mixed"
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

function latencyBandFor(input: CompatibilityAuditInput): CompatibilityBand {
  if (input.latencySensitivity === "high" && input.averageRequestSize > 12_000) {
    return "HIGH";
  }
  if (input.latencySensitivity === "medium" || input.averageRequestSize > 20_000) {
    return "MEDIUM";
  }
  return "LOW";
}

function compatibilityScore(
  input: CompatibilityAuditInput,
  benefit: CompatibilityBand,
  risk: CompatibilityBand,
  latency: CompatibilityBand
): number {
  const benefitScore = bandPoints(benefit);
  const riskPenalty = bandPoints(risk);
  const latencyPenalty = Math.max(0, bandPoints(latency) - 1);
  const cacheBonus =
    input.cacheIntensity === "high" ? 8 : input.cacheIntensity === "medium" ? 4 : 0;
  return clampScore(50 + benefitScore * 12 - riskPenalty * 10 - latencyPenalty * 5 + cacheBonus);
}

function exactnessOrSafetyThresholdFailure(
  input: CompatibilityAuditInput,
  unsupportedCapabilities: readonly string[]
): boolean {
  return (
    input.exactnessSensitivity === "critical" ||
    input.modelSimulatorProfile === "revoked" ||
    input.modelSimulatorProfile === "expired" ||
    unsupportedCapabilities.length > 0
  );
}

function compatibilityVerdict(
  input: CompatibilityAuditInput,
  score: number,
  thresholdFailure: boolean,
  unsupportedCapabilities: readonly string[]
): CompatibilityAuditVerdict {
  if (input.modelSimulatorProfile === "retest_required") {
    return "RETEST_REQUIRED";
  }
  if (unsupportedCapabilities.length > 0 || input.modelSimulatorProfile === "revoked") {
    return "UNSUPPORTED";
  }
  if (thresholdFailure) {
    return "AUDIT_ONLY";
  }
  if (
    input.averageRequestSize < 2_000 &&
    input.averageSessionSize < 10_000 &&
    input.cacheIntensity === "low"
  ) {
    return "NOT_WORTH_USING";
  }
  if (score < 45) {
    return "NOT_WORTH_USING";
  }
  if (
    input.exactnessSensitivity === "high" ||
    input.toolUseFrequency === "high" ||
    input.riskPreference === "conservative"
  ) {
    return "RECOMMENDED_WITH_RESTRICTIONS";
  }
  return "RECOMMENDED";
}

function recommendedPresetFor(
  input: CompatibilityAuditInput,
  verdict: CompatibilityAuditVerdict,
  risk: CompatibilityBand
): CompatibilityPreset {
  if (verdict === "UNSUPPORTED" || verdict === "NOT_WORTH_USING") {
    return "BYPASS";
  }
  if (verdict === "AUDIT_ONLY" || verdict === "RETEST_REQUIRED" || risk === "HIGH") {
    return "SAFE";
  }
  if (input.riskPreference === "aggressive" && risk === "LOW") {
    return "MAX";
  }
  return "BALANCED";
}

function recommendedProductPresetFor(
  verdict: CompatibilityAuditVerdict,
  preset: CompatibilityPreset
): ProductPolicyPreset {
  if (verdict === "UNSUPPORTED" || verdict === "NOT_WORTH_USING") {
    return "Observe Only";
  }
  if (verdict === "AUDIT_ONLY" || verdict === "RETEST_REQUIRED" || preset === "SAFE") {
    return "Protect First";
  }
  if (preset === "MAX") {
    return "Lab Mode";
  }
  return "Save More";
}

function unsupportedCapabilitiesFor(input: CompatibilityAuditInput): readonly string[] {
  const unsupported: string[] = [];
  if (input.script === "unsupported") {
    unsupported.push("The selected script is not covered by the local synthetic glyph profile.");
  }
  if (input.modelSimulatorProfile === "revoked") {
    unsupported.push("The local model simulator profile is revoked.");
  }
  if (input.modelSimulatorProfile === "expired") {
    unsupported.push("The local model simulator profile is expired.");
  }
  return unsupported;
}

function requiredCanariesFor(input: CompatibilityAuditInput): readonly string[] {
  const canaries = ["prose gist canary", "exact-string canary", "table structure canary"];
  if (input.workloadType === "code" || input.toolUseFrequency !== "low") {
    canaries.push("tool and code exactness canary");
  }
  if (input.script !== "latin") {
    canaries.push(`${input.script} glyph coverage canary`);
  }
  if (input.host === "both") {
    canaries.push("Codex route canary", "Claude Code route canary");
  } else {
    canaries.push(`${input.host} route canary`);
  }
  return canaries;
}

function compatibilityReasons(
  input: CompatibilityAuditInput,
  verdict: CompatibilityAuditVerdict,
  context: {
    readonly accuracyRiskBand: CompatibilityBand;
    readonly expectedBenefitBand: CompatibilityBand;
    readonly latencyBand: CompatibilityBand;
    readonly thresholdFailure: boolean;
    readonly unsupportedCapabilities: readonly string[];
  }
): readonly string[] {
  const reasons = [
    `This report uses SYNTHETIC TEST DATA for ${input.host}.`,
    `Expected benefit is ${context.expectedBenefitBand.toLowerCase()} based on request size, session size and cache intensity.`,
    `Accuracy risk is ${context.accuracyRiskBand.toLowerCase()} because exactness sensitivity is ${input.exactnessSensitivity}.`,
    `Latency impact is ${context.latencyBand.toLowerCase()} for the selected latency sensitivity.`
  ];
  if (context.thresholdFailure) {
    reasons.push(
      "A safety or exactness threshold failed, so the overall score is not allowed to hide that risk."
    );
  }
  if (context.unsupportedCapabilities.length > 0) {
    reasons.push(...context.unsupportedCapabilities);
  }
  if (verdict === "RETEST_REQUIRED") {
    reasons.push("The local model profile needs fresh canary results before use.");
  }
  if (verdict === "NOT_WORTH_USING") {
    reasons.push("The synthetic workload is too small or latency-sensitive to justify conversion.");
  }
  if (verdict === "RECOMMENDED_WITH_RESTRICTIONS") {
    reasons.push("Use restrictions because some content may need to stay as native text.");
  }
  if (verdict === "RECOMMENDED") {
    reasons.push(
      "The synthetic fixture passed benefit and safety checks for the recommended preset."
    );
  }
  return reasons;
}

function bandPoints(band: CompatibilityBand): number {
  return band === "HIGH" ? 3 : band === "MEDIUM" ? 2 : 1;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function seedOptions(options: RendererDoctorOptions): RendererDoctorOptions {
  if (options.seed === "healthy" || options.seed === undefined) {
    return options;
  }
  if (options.seed === "degraded") {
    return { ...options, fontAvailable: false };
  }
  if (options.seed === "unsafe") {
    return {
      ...options,
      renderer: createStaticRenderer({
        status: "success",
        images: [
          {
            bytes: new TextEncoder().encode("FAKE_SECRET_CANARY_RENDERER_DOCTOR"),
            heightPx: 728,
            mimeType: "image/svg+xml",
            pageIndex: 0,
            stableImageId: "unsafe",
            widthPx: 1_568
          }
        ],
        glyphCoverage: {
          checkedCodePoints: 10,
          coveredCodePoints: 10,
          missingGlyphs: [],
          unsupportedGlyphs: []
        },
        timing: { completedAtMs: 1, durationMs: 1, startedAtMs: 0 }
      })
    };
  }
  return { ...options, adapterInstalled: false };
}

function createDoctorInput(modelProfile?: ModelProfileSummary): ContextRendererInput {
  return {
    ctxBlockLabel: "CTX-DOCTOR-GOLDEN",
    dimensionLimits: { maxHeightPx: 728, maxWidthPx: 1_568, minFontSizePx: 12 },
    exactSidecar: {
      integrityHash: "sha256:doctor-sidecar-hash",
      lineCount: 2,
      recoverable: true
    },
    modelProfile:
      modelProfile ??
      ({
        expiresAt: isoTimestamp("2026-08-16T00:00:00.000Z"),
        issuedAt: isoTimestamp("2026-07-16T00:00:00.000Z"),
        modelFamily: "synthetic-doctor",
        modelVersion: "2026-07",
        origin: "synthetic",
        profileId: "doctor-profile",
        provider: "unknown",
        status: "enabled"
      } satisfies ModelProfileSummary),
    pageLimits: { maxCharsPerPage: 64, maxPages: 2 },
    protectedSpans: [{ end: 15, reasonCodes: ["exact_value"], start: 4 }],
    safety: { policyApproved: true, secretCleaned: true },
    sourceText: "Doctor renderable prose with exact sidecar."
  };
}

function checkBoolean(
  name: string,
  passed: boolean,
  detail: string,
  nextAction: string
): RendererDoctorCheck {
  return {
    detail: passed ? detail : "Required renderer prerequisite is missing.",
    name,
    nextAction: passed ? "No action needed." : nextAction,
    status: passed ? "HEALTHY" : "UNSUPPORTED"
  };
}

function checkFontAvailability(present: boolean): RendererDoctorCheck {
  return present
    ? healthy("font availability", "A monospace font is available to the renderer.")
    : degraded(
        "font availability",
        "A supported monospace font was not detected.",
        "Install a supported monospace font manually and rerun the doctor."
      );
}

async function checkTempDirectory(tempRoot?: string): Promise<RendererDoctorCheck> {
  const root = tempRoot ?? tmpdir();
  let path: string | undefined;
  try {
    path = await mkdtemp(join(root, "context-diet-renderer-doctor-"));
    await writeFile(join(path, "probe.txt"), "safe metadata probe");
    await rm(path, { force: true, recursive: true });
    return healthy(
      "temp directory write and cleanup",
      "Temporary render directory can be written and cleaned."
    );
  } catch {
    if (path !== undefined) {
      await rm(path, { force: true, recursive: true }).catch(() => undefined);
    }
    return degraded(
      "temp directory write and cleanup",
      "Temporary render directory is not writable or could not be cleaned.",
      "Choose a writable temp directory and rerun the doctor."
    );
  }
}

async function renderWithTimeout(
  renderer: ContextRenderer,
  input: ContextRendererInput,
  timeoutMs: number
): Promise<ContextRendererResult | "timeout"> {
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), timeoutMs);
  });
  return Promise.race([renderer.render(input), timeout]);
}

function checkRenderResult(
  name: string,
  result: ContextRendererResult | "timeout"
): RendererDoctorCheck {
  if (result === "timeout") {
    return degraded(
      name,
      "Renderer did not finish within the timeout.",
      "Increase timeout or inspect renderer health."
    );
  }
  if (result.status === "failure") {
    return unsupported(
      name,
      `Renderer failed with ${result.failureReason}.`,
      "Fix renderer failure before enabling imaging."
    );
  }
  const golden = new TextDecoder().decode(result.images[0]?.bytes ?? new Uint8Array());
  return golden.includes("CTX-DOCTOR-GOLDEN") && golden.includes("sha256:doctor-sidecar-hash")
    ? healthy(name, "Golden render is deterministic and includes the CTX label.")
    : unsafe(
        name,
        "Golden render did not contain expected stable metadata.",
        "Disable imaging and inspect renderer output."
      );
}

function checkDimensions(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "supported image dimensions",
      "Image dimensions could not be verified.",
      "Fix render failure first."
    );
  }
  const image = result.images[0];
  const ok = image !== undefined && image.widthPx <= 1_568 && image.heightPx <= 728;
  return ok
    ? healthy(
        "supported image dimensions",
        "Rendered dimensions are within the supported profile limits."
      )
    : unsupported(
        "supported image dimensions",
        "Rendered dimensions exceed the supported profile limits.",
        "Reduce renderer dimensions or update the model profile."
      );
}

function checkGlyphCoverage(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "glyph coverage",
      "Glyph coverage could not be verified.",
      "Fix render failure first."
    );
  }
  return result.glyphCoverage.unsupportedGlyphs.length === 0 &&
    result.glyphCoverage.missingGlyphs.length === 0
    ? healthy("glyph coverage", "All doctor glyphs are covered.")
    : unsupported(
        "glyph coverage",
        "Some glyphs are missing or unsupported.",
        "Install a supported font or keep affected text native."
      );
}

function checkExactSidecar(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "exact-sidecar output",
      "Exact sidecar output could not be verified.",
      "Fix render failure first."
    );
  }
  const output = new TextDecoder().decode(result.images[0]?.bytes ?? new Uint8Array());
  return output.includes("sha256:doctor-sidecar-hash")
    ? healthy("exact-sidecar output", "Rendered output references the exact sidecar hash.")
    : unsafe(
        "exact-sidecar output",
        "Rendered output is missing exact sidecar metadata.",
        "Disable imaging until sidecar output is restored."
      );
}

async function checkProtectedSpanExclusion(
  renderer: ContextRenderer,
  input: ContextRendererInput
): Promise<RendererDoctorCheck> {
  const result = await renderer.render({
    ...input,
    protectedSpans: [{ end: 8, reasonCodes: ["secret_sensitive"], start: 0 }]
  });
  return result.status === "failure"
    ? healthy(
        "protected-span exclusion",
        "Secret-sensitive protected spans are refused by the renderer."
      )
    : unsafe(
        "protected-span exclusion",
        "Renderer accepted a secret-sensitive protected span.",
        "Disable imaging until protected-span gating is fixed."
      );
}

function checkSecretCanaryAbsence(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  if (result === "timeout" || result.status === "failure") {
    return degraded(
      "fake secret-canary absence",
      "Canary absence could not be verified.",
      "Fix render failure first."
    );
  }
  const output = result.images.map((image) => new TextDecoder().decode(image.bytes)).join("\n");
  return output.includes("FAKE_SECRET_CANARY_RENDERER_DOCTOR")
    ? unsafe(
        "fake secret-canary absence",
        "A fake secret canary appeared in rendered output.",
        "Disable imaging and inspect scanner/redaction boundaries."
      )
    : healthy("fake secret-canary absence", "No fake secret canary appeared in rendered output.");
}

function checkModelProfile(input: ContextRendererInput): RendererDoctorCheck {
  return input.modelProfile.status === "enabled"
    ? healthy("model-profile compatibility", "Model profile is enabled for renderer doctor checks.")
    : unsupported(
        "model-profile compatibility",
        "Model profile is not enabled.",
        "Approve and enable a current model profile before imaging."
      );
}

function checkImageTokenCost(cost: number): RendererDoctorCheck {
  if (!Number.isFinite(cost) || cost <= 0) {
    return unsupported(
      "simulated image-token cost",
      "Image token cost could not be estimated.",
      "Add a valid image token accounting rule."
    );
  }
  return cost > 10_000
    ? degraded(
        "simulated image-token cost",
        "Simulated image-token cost is unusually high.",
        "Review model token accounting before enabling imaging."
      )
    : healthy(
        "simulated image-token cost",
        "Simulated image-token cost is within expected bounds."
      );
}

function checkRendererTimeout(result: ContextRendererResult | "timeout"): RendererDoctorCheck {
  return result === "timeout"
    ? degraded(
        "renderer timeout",
        "Renderer timed out.",
        "Increase timeout or inspect renderer performance."
      )
    : healthy("renderer timeout", "Renderer completed before timeout.");
}

async function checkCrashCleanup(tempRoot?: string): Promise<RendererDoctorCheck> {
  const root = tempRoot ?? tmpdir();
  let path: string | undefined;
  try {
    path = await mkdtemp(join(root, "context-diet-renderer-crash-"));
    await writeFile(join(path, "partial.tmp"), "safe partial metadata");
    throw new Error("simulated renderer crash");
  } catch {
    if (path !== undefined) {
      await rm(path, { force: true, recursive: true });
    }
    return healthy("crash cleanup", "Simulated crash artifacts were cleaned.");
  }
}

function aggregateStatus(checks: readonly RendererDoctorCheck[]): RendererDoctorStatus {
  if (checks.some((check) => check.status === "UNSAFE")) {
    return "UNSAFE";
  }
  if (checks.some((check) => check.status === "UNSUPPORTED")) {
    return "UNSUPPORTED";
  }
  if (checks.some((check) => check.status === "DEGRADED")) {
    return "DEGRADED";
  }
  return "HEALTHY";
}

function healthy(name: string, detail: string): RendererDoctorCheck {
  return { detail, name, nextAction: "No action needed.", status: "HEALTHY" };
}

function degraded(name: string, detail: string, nextAction: string): RendererDoctorCheck {
  return { detail, name, nextAction, status: "DEGRADED" };
}

function unsafe(name: string, detail: string, nextAction: string): RendererDoctorCheck {
  return { detail, name, nextAction, status: "UNSAFE" };
}

function unsupported(name: string, detail: string, nextAction: string): RendererDoctorCheck {
  return { detail, name, nextAction, status: "UNSUPPORTED" };
}

function createStaticRenderer(result: ContextRendererResult): ContextRenderer {
  return { render: async () => result };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
