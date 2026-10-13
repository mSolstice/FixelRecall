import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type LocalConfigHost = "codex" | "claude-code";

export interface LocalConfigInstallOptions {
  readonly rootDir: string;
  readonly hosts: readonly LocalConfigHost[];
  readonly includeMcp: boolean;
  readonly includeClaudeHook: boolean;
  readonly confirm: boolean;
  readonly gatewayBaseUrl?: string;
  readonly installationId?: string;
  readonly createdAt?: string;
  readonly replaceExistingManifest?: boolean;
}

export interface ManagedFileBackup {
  readonly target: string;
  readonly backup: string;
  readonly existed: boolean;
}

export interface LocalInstallManifest {
  readonly manifestVersion: 1;
  readonly installationId: string;
  readonly createdAt: string;
  readonly gatewayBaseUrl: string;
  readonly hosts: readonly LocalConfigHost[];
  readonly includeMcp: boolean;
  readonly includeClaudeHook: boolean;
  readonly managedMarkers: readonly string[];
  readonly backups: readonly ManagedFileBackup[];
  readonly credentialPolicy: "environment-variable-references-only";
  readonly status: "complete" | "interrupted";
}

export interface LocalConfigOperationResult {
  readonly applied: boolean;
  readonly dryRun: boolean;
  readonly manifestPath: string;
  readonly changedFiles: readonly string[];
  readonly message: string;
}

const beginMarker = "# BEGIN fixel-recall managed";
const endMarker = "# END fixel-recall managed";
const managedMarkers = [beginMarker, endMarker] as const;

export function localManifestPath(rootDir: string): string {
  return join(rootDir, ".fixel-recall", "install-manifest.json");
}

export async function installLocalConfig(
  options: LocalConfigInstallOptions
): Promise<LocalConfigOperationResult> {
  const gatewayBaseUrl = options.gatewayBaseUrl ?? "http://127.0.0.1:4317";
  const manifestPath = localManifestPath(options.rootDir);
  const changedFiles = targetFiles(options);
  const installationId = options.installationId ?? "fixel-recall-local-install";

  if (!options.confirm) {
    return {
      applied: false,
      changedFiles,
      dryRun: true,
      manifestPath,
      message: "Dry run: no configuration files were written. Re-run with --confirm to apply."
    };
  }

  if ((await manifestExists(manifestPath)) && options.replaceExistingManifest !== true) {
    return {
      applied: false,
      changedFiles: [],
      dryRun: true,
      manifestPath,
      message:
        "Refused: an existing Fixel Recall install manifest was found. Run rollback or uninstall first, or re-run with --replace-existing-manifest after reviewing the preview."
    };
  }

  const backups: ManagedFileBackup[] = [];
  await mkdir(dirname(manifestPath), { recursive: true });

  for (const path of changedFiles) {
    backups.push(await backupFile(path, options.rootDir, installationId));
  }

  if (options.hosts.includes("codex")) {
    await writeCodexManagedConfig(
      join(options.rootDir, ".codex", "config.toml"),
      renderCodexManagedBlock(gatewayBaseUrl, options.includeMcp)
    );
  }

  if (options.hosts.includes("claude-code")) {
    await writeClaudeSettings(
      join(options.rootDir, ".claude", "settings.json"),
      gatewayBaseUrl,
      options.includeClaudeHook
    );
  }

  if (options.includeMcp) {
    await writeManagedJsonObject(join(options.rootDir, ".fixel-recall", "mcp.json"), {
      mcpServers: {
        "fixel-recall-retrieval": {
          args: ["mcp", "retrieval"],
          command: "fixel-recall",
          env: {},
          managedBy: "fixel-recall"
        }
      }
    });
    if (options.hosts.includes("claude-code")) {
      await writeClaudeMcpConfig(join(options.rootDir, ".claude.json"));
    }
  }

  const manifest: LocalInstallManifest = {
    backups,
    createdAt: options.createdAt ?? new Date(0).toISOString(),
    credentialPolicy: "environment-variable-references-only",
    gatewayBaseUrl,
    hosts: [...options.hosts],
    includeClaudeHook: options.includeClaudeHook,
    includeMcp: options.includeMcp,
    installationId,
    managedMarkers,
    manifestVersion: 1,
    status: "complete"
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  return {
    applied: true,
    changedFiles: [...changedFiles, manifestPath],
    dryRun: false,
    manifestPath,
    message: "Confirmed: local configuration was written and backups were recorded."
  };
}

export async function resumeInterruptedLocalConfig(
  rootDir: string
): Promise<LocalConfigOperationResult> {
  const manifestPath = localManifestPath(rootDir);
  const manifest = await readManifest(manifestPath);
  if (manifest.status !== "interrupted") {
    return {
      applied: false,
      changedFiles: [],
      dryRun: true,
      manifestPath,
      message: "No interrupted install was found to resume."
    };
  }
  return installLocalConfig({
    confirm: true,
    createdAt: manifest.createdAt,
    gatewayBaseUrl: manifest.gatewayBaseUrl,
    hosts: manifest.hosts,
    includeClaudeHook: manifest.includeClaudeHook,
    includeMcp: manifest.includeMcp,
    installationId: manifest.installationId,
    replaceExistingManifest: true,
    rootDir
  });
}

export async function rollbackLocalConfig(rootDir: string): Promise<LocalConfigOperationResult> {
  const manifestPath = localManifestPath(rootDir);
  const manifest = await readManifest(manifestPath);
  const changedFiles: string[] = [];

  for (const backup of [...manifest.backups].reverse()) {
    await restoreBackup(backup);
    changedFiles.push(backup.target);
  }

  return {
    applied: true,
    changedFiles,
    dryRun: false,
    manifestPath,
    message: "Rollback complete: backed-up files were restored from the install manifest."
  };
}

export async function uninstallLocalConfig(rootDir: string): Promise<LocalConfigOperationResult> {
  const manifestPath = localManifestPath(rootDir);
  const manifest = await readManifest(manifestPath);
  const changedFiles: string[] = [];

  for (const backup of manifest.backups) {
    await restoreBackup(backup);
    changedFiles.push(backup.target);
  }

  return {
    applied: true,
    changedFiles,
    dryRun: false,
    manifestPath,
    message: "Uninstall complete: only Fixel Recall managed entries were removed."
  };
}

async function backupFile(
  path: string,
  rootDir: string,
  installationId: string
): Promise<ManagedFileBackup> {
  const baseBackup = join(
    rootDir,
    ".fixel-recall",
    "backups",
    safeBackupSegment(installationId),
    encodeURIComponent(path)
  );
  const backup = await uniqueBackupPath(baseBackup);
  await mkdir(dirname(path), { recursive: true });
  await mkdir(dirname(backup), { recursive: true });
  try {
    await copyFile(path, backup);
    return { backup, existed: true, target: path };
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      await writeFile(backup, "", { mode: 0o600 });
      return { backup, existed: false, target: path };
    }
    throw error;
  }
}

async function uniqueBackupPath(basePath: string): Promise<string> {
  for (let index = 0; index < 1_000; index += 1) {
    const candidate = index === 0 ? basePath : `${basePath}.${index}`;
    if (!(await fileExists(candidate))) {
      return candidate;
    }
  }
  throw new Error(`Could not allocate a unique backup path for ${basePath}`);
}

async function manifestExists(path: string): Promise<boolean> {
  return fileExists(path);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function safeBackupSegment(value: string): string {
  const safe = value.replaceAll(/[^A-Za-z0-9._-]/g, "_");
  return safe.length === 0 ? "fixel-recall-local-install" : safe;
}

function targetFiles(options: LocalConfigInstallOptions): readonly string[] {
  const files: string[] = [];
  if (options.hosts.includes("codex")) {
    files.push(join(options.rootDir, ".codex", "config.toml"));
  }
  if (options.hosts.includes("claude-code")) {
    files.push(join(options.rootDir, ".claude", "settings.json"));
  }
  if (options.includeMcp) {
    files.push(join(options.rootDir, ".fixel-recall", "mcp.json"));
    if (options.hosts.includes("claude-code")) {
      files.push(join(options.rootDir, ".claude.json"));
    }
  }
  return files;
}

function renderCodexManagedBlock(gatewayBaseUrl: string, includeMcp: boolean): string {
  const lines = [
    'model_provider = "fixel_recall_local"',
    "",
    "[model_providers.fixel_recall_local]",
    'name = "Fixel Recall local gateway"',
    `base_url = "${gatewayBaseUrl}"`,
    "requires_openai_auth = true"
  ];

  if (includeMcp) {
    lines.push(
      "",
      "[mcp_servers.fixel-recall-retrieval]",
      'command = "node"',
      `args = ${JSON.stringify(fixelRecallCliArgs())}`
    );
  }

  return lines.join("\n");
}

async function writeCodexManagedConfig(path: string, block: string): Promise<void> {
  const existing = await readOptional(path);
  const cleaned = removeMarkedBlock(existing);
  const next = insertTomlRootManagedBlock(cleaned, `${beginMarker}\n${block}\n${endMarker}`);
  await writeFile(path, next, { mode: 0o600 });
}

function insertTomlRootManagedBlock(text: string, block: string): string {
  const tableIndex = firstTomlTableIndex(text);
  const normalisedBlock = `${block}\n`;
  if (tableIndex === -1) {
    return `${text}${text.endsWith("\n") || text.length === 0 ? "" : "\n"}${normalisedBlock}`;
  }
  const prefix = text.slice(0, tableIndex).trimEnd();
  const suffix = text.slice(tableIndex).trimStart();
  return `${prefix}${prefix.length === 0 ? "" : "\n\n"}${normalisedBlock}\n${suffix}`;
}

function firstTomlTableIndex(text: string): number {
  const match = /^\s*\[[^\]\n]+]/m.exec(text);
  return match?.index ?? -1;
}

async function writeClaudeSettings(
  path: string,
  gatewayBaseUrl: string,
  includeClaudeHook: boolean
): Promise<void> {
  const existing = await readOptional(path);
  const parsed = parseJsonObject(existing, path);
  const existingEnv = recordFrom(parsed["env"]);
  const next: Record<string, unknown> = {
    ...parsed,
    env: {
      ...existingEnv,
      ANTHROPIC_BASE_URL: gatewayBaseUrl
    },
    fixelRecallManaged: {
      anthropicBaseUrl: gatewayBaseUrl,
      credential: "ANTHROPIC_API_KEY environment variable",
      managed: true
    }
  };

  if (includeClaudeHook) {
    const existingHooks = recordFrom(parsed["hooks"]);
    const sessionStart = Array.isArray(existingHooks["SessionStart"])
      ? existingHooks["SessionStart"]
      : [];
    next["hooks"] = {
      ...existingHooks,
      SessionStart: [
        ...sessionStart.filter((hook) => !isFixelRecallHook(hook)),
        {
          command: `${fixelRecallCliCommandForDisplay()} status --no-credentials`,
          description: "Fixel Recall local status check",
          managedBy: "fixel-recall"
        }
      ]
    };
  }

  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

async function writeClaudeMcpConfig(path: string): Promise<void> {
  const existing = await readOptional(path);
  const parsed = parseJsonObject(existing, path);
  const existingServers = recordFrom(parsed["mcpServers"]);
  const next = {
    ...parsed,
    mcpServers: {
      ...existingServers,
      "fixel-recall-retrieval": {
        args: fixelRecallCliArgs(),
        command: "node",
        env: {},
        managedBy: "fixel-recall",
        type: "stdio"
      }
    }
  };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, {
    mode: 0o600
  });
}

async function writeManagedJsonObject(
  path: string,
  managedObject: Record<string, unknown>
): Promise<void> {
  const existing = await readOptional(path);
  const parsed = parseJsonObject(existing, path);
  const next = {
    ...parsed,
    fixelRecallManaged: managedObject
  };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

async function restoreBackup(backup: ManagedFileBackup): Promise<void> {
  if (!backup.existed) {
    await rm(backup.target, { force: true });
    return;
  }
  await mkdir(dirname(backup.target), { recursive: true });
  await copyFile(backup.backup, backup.target);
}

async function readManifest(path: string): Promise<LocalInstallManifest> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as LocalInstallManifest;
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function removeMarkedBlock(text: string): string {
  const start = text.indexOf(beginMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    return text;
  }
  return `${text.slice(0, start)}${text.slice(end + endMarker.length)}`.replace(/\n{3,}/g, "\n\n");
}

function parseJsonObject(text: string, path: string): Record<string, unknown> {
  if (text.trim().length === 0) {
    return {};
  }
  const value: unknown = JSON.parse(text);
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Expected JSON object in ${path}`);
  }
  return value as Record<string, unknown>;
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isFixelRecallHook(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { readonly managedBy?: unknown }).managedBy === "fixel-recall"
  );
}

function fixelRecallCliArgs(): readonly string[] {
  return [join(dirname(fileURLToPath(import.meta.url)), "index.js"), "mcp", "retrieval"];
}

function fixelRecallCliCommandForDisplay(): string {
  return "fixel-recall";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
