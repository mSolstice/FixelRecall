import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  createClaudeCodeSetupPreview,
  createInstallationManifestPlan,
  createCodexSetupPreview,
  createRollbackPlan,
  describeCli,
  renderCompatibilityAuditJson,
  renderCompatibilityAuditMarkdown,
  runCliCommand,
  runCompatibilityAudit,
  runRendererDoctor,
  type CompatibilityAuditVerdict
} from "./index.js";

const execFileAsync = promisify(execFile);
const cliDistPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");

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
    [["status"], "Context Diet status"],
    [["benchmark", "--json"], '"dataOrigin": "synthetic"'],
    [["renderer", "doctor"], '"command": "context-diet renderer doctor"']
  ] as const)("runs the built executable for %s", async (argv, expectedOutput) => {
    expect(existsSync(cliDistPath), "run pnpm build before the direct CLI test").toBe(true);

    const { stdout, stderr } = await execFileAsync(process.execPath, [cliDistPath, ...argv], {
      env: {
        ...process.env,
        CONTEXT_DIET_FAKE_SECRET: "SECRET_VALUE"
      }
    });

    expect(stderr).toBe("");
    expect(stdout).toContain(expectedOutput);
    expect(stdout).not.toContain("SECRET_VALUE");
    expect(stdout).not.toContain("Bearer ");
  });

  it.each([
    "doctor",
    "audit",
    "setup",
    "start",
    "stop",
    "status",
    "explain",
    "preset",
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
    expect(result.stdout.replaceAll(tmpdir(), "<tmp>")).toMatchSnapshot();
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

  it("generates a safe Codex setup preview without credentials or writes", async () => {
    const result = await runCliCommand(["setup", "codex"], {
      env: { upstreamBaseUrl: "https://token:SECRET_VALUE@provider.example.test/v1" }
    });
    const preview = createCodexSetupPreview({
      activeHosts: ["codex"],
      fakeProviderDevelopmentMode: false,
      gatewayRunning: false,
      organisationForbiddenPresets: [],
      policyPreset: "Protect First",
      safetyMode: "Safe",
      syntheticSession: false,
      experimentalSession: false,
      upstreamBaseUrl: "https://provider.example.test/v1"
    });

    expect(preview.writesUserConfig).toBe(false);
    expect(result.stdout).toContain("Codex setup preview");
    expect(result.stdout).toContain("~/.codex/config.toml");
    expect(result.stdout).toContain(".agents/skills/context-diet");
    expect(result.stdout).toContain("context-diet-retrieval");
    expect(result.stdout).toContain("Restore direct routing");
    expect(result.stdout).toContain("Uninstall");
    expect(result.stdout).not.toContain("SECRET_VALUE");
    expect(result.stdout).not.toContain("Bearer ");
  });

  it("generates a safe Claude Code setup preview with optional hooks only", async () => {
    const result = await runCliCommand(["setup", "claude-code", "--confirm"]);
    const preview = createClaudeCodeSetupPreview({
      activeHosts: ["claude_code"],
      fakeProviderDevelopmentMode: false,
      gatewayRunning: false,
      organisationForbiddenPresets: [],
      policyPreset: "Protect First",
      safetyMode: "Safe",
      syntheticSession: false,
      experimentalSession: false,
      upstreamBaseUrl: "https://api.anthropic.example.invalid"
    });

    expect(preview.writesUserConfig).toBe(false);
    expect(result.stdout).toContain("Claude Code setup preview");
    expect(result.stdout).toContain("ANTHROPIC_BASE_URL");
    expect(result.stdout).toContain("~/.claude/settings.json");
    expect(result.stdout).toContain(".claude/skills/context-diet");
    expect(result.stdout).toContain("Hooks are optional");
    expect(result.stdout).toContain("Confirmed: local configuration was written");
    expect(result.stdout).not.toContain("ANTHROPIC_API_KEY=");
    expect(result.stdout).not.toContain("sk-");
  });

  it("plans a transactional manifest without writing user config or credentials", () => {
    const manifest = createInstallationManifestPlan({
      createdAt: "2026-07-22T00:00:00.000Z",
      dryRun: true,
      hosts: ["codex", "claude-code"],
      includeClaudeHook: true,
      includeMcp: true,
      installationId: "install_test_123"
    });

    expect(manifest).toMatchObject({
      dryRun: true,
      installationId: "install_test_123",
      manifestVersion: 1,
      writesRealUserConfig: false
    });
    expect(manifest.targets.map((target) => target.id)).toEqual([
      "codex-user-config",
      "codex-project-config",
      "claude-user-settings",
      "claude-project-settings",
      "claude-session-start-hook",
      "mcp-config"
    ]);
    expect(manifest.targets.filter((target) => target.action !== "skip")).toHaveLength(4);
    expect(manifest.targets.every((target) => !target.pathLabel.includes("SECRET_VALUE"))).toBe(
      true
    );
    expect(JSON.stringify(manifest)).not.toContain("Bearer ");
    expect(JSON.stringify(manifest)).not.toContain("sk-");
    expect(manifest.forbiddenWrites).toContain("provider API keys or bearer tokens");
    expect(manifest.forbiddenWrites).toContain("raw prompts, source code or request bodies");
  });

  it("plans rollback in reverse target order and supports interrupted install recovery", () => {
    const manifest = createInstallationManifestPlan({
      dryRun: true,
      hosts: ["codex", "claude-code"],
      includeClaudeHook: true,
      includeMcp: true,
      installationId: "install_test_rollback"
    });
    const rollback = createRollbackPlan(manifest, { interruptedInstall: true });

    expect(rollback).toMatchObject({
      dryRun: true,
      installationId: "install_test_rollback",
      recoveryMode: "interrupted-install",
      requiresConfirmation: true
    });
    expect(rollback.steps.map((step) => step.targetId)).toEqual([
      "mcp-config",
      "claude-session-start-hook",
      "claude-project-settings",
      "claude-user-settings",
      "codex-project-config",
      "codex-user-config"
    ]);
    expect(
      rollback.steps.find((step) => step.targetId === "claude-project-settings")
    ).toMatchObject({
      action: "skip"
    });
    expect(rollback.steps.find((step) => step.targetId === "mcp-config")).toMatchObject({
      action: "restore-backup"
    });
  });

  it("applies setup only with confirmation and writes a local manifest in a temp config root", async () => {
    const root = await mkdtemp(join(tmpdir(), "context-diet-cli-install-"));
    try {
      const codexPath = join(root, ".codex", "config.toml");
      await mkdir(dirname(codexPath), { recursive: true });
      await writeFile(codexPath, 'model = "existing-model"\n', { mode: 0o600 });

      const dryRun = await runCliCommand(["setup", "codex", "--mcp"], { configRoot: root });
      expect(dryRun.stdout).toContain("Dry run");
      expect(existsSync(join(root, ".context-diet", "install-manifest.json"))).toBe(false);
      expect(await readFile(codexPath, "utf8")).toBe('model = "existing-model"\n');

      const applied = await runCliCommand(["setup", "codex", "--mcp", "--confirm"], {
        configRoot: root
      });
      const codexConfig = await readFile(codexPath, "utf8");
      const manifest = await readFile(join(root, ".context-diet", "install-manifest.json"), "utf8");
      const mcpConfig = await readFile(join(root, ".context-diet", "mcp.json"), "utf8");

      expect(applied.stdout).toContain("Confirmed");
      expect(codexConfig).toContain('model = "existing-model"');
      expect(codexConfig).toContain("BEGIN context-diet managed");
      expect(codexConfig).toContain('env_key = "OPENAI_API_KEY"');
      expect(mcpConfig).toContain("context-diet-retrieval");
      expect(manifest).toContain('"credentialPolicy": "environment-variable-references-only"');
      expect(`${applied.stdout}\n${codexConfig}\n${mcpConfig}\n${manifest}`).not.toContain(
        "SECRET_VALUE"
      );
      expect(`${applied.stdout}\n${codexConfig}\n${mcpConfig}\n${manifest}`).not.toContain(
        "Bearer "
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("applies Claude Code setup with optional hook while preserving unknown settings", async () => {
    const root = await mkdtemp(join(tmpdir(), "context-diet-cli-claude-"));
    try {
      const settingsPath = join(root, ".claude", "settings.json");
      await mkdir(dirname(settingsPath), { recursive: true });
      await writeFile(
        settingsPath,
        `${JSON.stringify({ existingSetting: true, theme: "dark" }, null, 2)}\n`,
        { mode: 0o600 }
      );

      await runCliCommand(["setup", "claude-code", "--mcp", "--claude-hook", "--confirm"], {
        configRoot: root
      });

      const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
        readonly existingSetting?: boolean;
        readonly theme?: string;
        readonly contextDietManaged?: {
          readonly contextDiet?: { readonly anthropicBaseUrl?: string };
          readonly hooks?: { readonly SessionStart?: readonly unknown[] };
        };
      };

      expect(settings.existingSetting).toBe(true);
      expect(settings.theme).toBe("dark");
      expect(settings.contextDietManaged?.contextDiet?.anthropicBaseUrl).toBe(
        "http://127.0.0.1:4317"
      );
      expect(settings.contextDietManaged?.hooks?.SessionStart).toHaveLength(1);
      expect(JSON.stringify(settings)).not.toContain("ANTHROPIC_API_KEY=");
      expect(JSON.stringify(settings)).not.toContain("sk-");
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("rolls back backed-up files and uninstalls only managed entries", async () => {
    const rollbackRoot = await mkdtemp(join(tmpdir(), "context-diet-cli-rollback-"));
    const uninstallRoot = await mkdtemp(join(tmpdir(), "context-diet-cli-uninstall-"));
    try {
      const originalCodex = 'model = "before-context-diet"\n';
      const originalClaude = `${JSON.stringify({ keep: "user-value" }, null, 2)}\n`;
      await mkdir(join(rollbackRoot, ".codex"), { recursive: true });
      await mkdir(join(uninstallRoot, ".claude"), { recursive: true });
      await writeFile(join(rollbackRoot, ".codex", "config.toml"), originalCodex, { mode: 0o600 });
      await writeFile(join(uninstallRoot, ".claude", "settings.json"), originalClaude, {
        mode: 0o600
      });

      await runCliCommand(["setup", "codex", "--confirm"], { configRoot: rollbackRoot });
      await runCliCommand(["rollback", "--confirm"], { configRoot: rollbackRoot });
      expect(await readFile(join(rollbackRoot, ".codex", "config.toml"), "utf8")).toBe(
        originalCodex
      );

      await runCliCommand(["setup", "claude-code", "--claude-hook", "--confirm"], {
        configRoot: uninstallRoot
      });
      await runCliCommand(["uninstall", "--confirm"], { configRoot: uninstallRoot });
      const uninstalledClaude = JSON.parse(
        await readFile(join(uninstallRoot, ".claude", "settings.json"), "utf8")
      ) as { readonly keep?: string; readonly contextDietManaged?: unknown };
      expect(uninstalledClaude.keep).toBe("user-value");
      expect(uninstalledClaude.contextDietManaged).toBeUndefined();
    } finally {
      await rm(rollbackRoot, { force: true, recursive: true });
      await rm(uninstallRoot, { force: true, recursive: true });
    }
  });

  it("recovers an interrupted install by resume or rollback from a temp manifest", async () => {
    const resumeRoot = await mkdtemp(join(tmpdir(), "context-diet-cli-resume-"));
    const rollbackRoot = await mkdtemp(join(tmpdir(), "context-diet-cli-interrupted-rollback-"));
    try {
      const resumeManifestPath = join(resumeRoot, ".context-diet", "install-manifest.json");
      const rollbackManifestPath = join(rollbackRoot, ".context-diet", "install-manifest.json");
      const rollbackCodexPath = join(rollbackRoot, ".codex", "config.toml");
      const rollbackBackupPath = join(
        rollbackRoot,
        ".context-diet",
        "backups",
        encodeURIComponent(rollbackCodexPath)
      );
      const originalRollbackConfig = 'model = "before-interrupted-install"\n';

      await mkdir(dirname(resumeManifestPath), { recursive: true });
      await mkdir(dirname(rollbackManifestPath), { recursive: true });
      await mkdir(dirname(rollbackCodexPath), { recursive: true });
      await mkdir(dirname(rollbackBackupPath), { recursive: true });
      await writeFile(rollbackCodexPath, 'model = "partially-changed"\n', { mode: 0o600 });
      await writeFile(rollbackBackupPath, originalRollbackConfig, { mode: 0o600 });

      const interruptedManifest = {
        backups: [
          {
            backup: rollbackBackupPath,
            existed: true,
            target: rollbackCodexPath
          }
        ],
        createdAt: "2026-07-22T00:00:00.000Z",
        credentialPolicy: "environment-variable-references-only",
        gatewayBaseUrl: "http://127.0.0.1:4317",
        hosts: ["codex"],
        includeClaudeHook: false,
        includeMcp: false,
        installationId: "install_interrupted_test",
        managedMarkers: ["# BEGIN context-diet managed", "# END context-diet managed"],
        manifestVersion: 1,
        status: "interrupted"
      };

      await writeFile(resumeManifestPath, `${JSON.stringify(interruptedManifest, null, 2)}\n`, {
        mode: 0o600
      });
      await writeFile(rollbackManifestPath, `${JSON.stringify(interruptedManifest, null, 2)}\n`, {
        mode: 0o600
      });

      const resumed = await runCliCommand(["setup", "codex", "--resume", "--confirm"], {
        configRoot: resumeRoot
      });
      expect(resumed.stdout).toContain("Confirmed: local configuration was written");
      expect(await readFile(join(resumeRoot, ".codex", "config.toml"), "utf8")).toContain(
        "BEGIN context-diet managed"
      );

      await runCliCommand(["rollback", "--confirm"], { configRoot: rollbackRoot });
      expect(await readFile(rollbackCodexPath, "utf8")).toBe(originalRollbackConfig);
    } finally {
      await rm(resumeRoot, { force: true, recursive: true });
      await rm(rollbackRoot, { force: true, recursive: true });
    }
  });

  it("selects product-facing presets without duplicating policy modes", async () => {
    const saveMore = await runCliCommand(["preset", "--preset", "save-more"]);

    expect(saveMore.stdout).toContain("Requested preset: Save More");
    expect(saveMore.stdout).toContain("Maps to internal mode: balanced");
    expect(saveMore.stdout).toContain("Preset selection maps to an existing internal mode");
  });

  it("blocks forbidden preset transitions", async () => {
    const blockedLab = await runCliCommand(["preset", "--preset", "lab-mode"]);
    const allowedLab = await runCliCommand(["preset", "--preset", "lab-mode"], {
      env: { experimentalSession: true }
    });
    const orgBlocked = await runCliCommand(["preset", "--preset", "save-more"], {
      env: { organisationForbiddenPresets: ["Save More"] }
    });

    expect(blockedLab.stdout).toContain("Allowed: no");
    expect(blockedLab.stdout).toContain("Lab Mode requires");
    expect(allowedLab.stdout).toContain("Allowed: yes");
    expect(orgBlocked.stdout).toContain("Organisation policy forbids this preset");
  });

  it("includes product presets in audit recommendations and explanations", async () => {
    const report = runCompatibilityAudit();
    const explain = await runCliCommand(["explain"]);

    expect(report.recommendedProductPreset).toBe("Save More");
    expect(report.dashboard.productPreset).toBe("Save More");
    expect(explain.stdout).toContain("Product presets map to existing internal modes");
    expect(explain.stdout).toContain("Preset maps to safe");
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
