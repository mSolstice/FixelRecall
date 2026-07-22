import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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

const beginMarker = "# BEGIN context-diet managed";
const endMarker = "# END context-diet managed";
const managedMarkers = [beginMarker, endMarker] as const;

export function localManifestPath(rootDir: string): string {
  return join(rootDir, ".context-diet", "install-manifest.json");
}

export async function installLocalConfig(
  options: LocalConfigInstallOptions
): Promise<LocalConfigOperationResult> {
  const gatewayBaseUrl = options.gatewayBaseUrl ?? "http://127.0.0.1:4317";
  const manifestPath = localManifestPath(options.rootDir);
  const changedFiles = targetFiles(options);

  if (!options.confirm) {
    return {
      applied: false,
      changedFiles,
      dryRun: true,
      manifestPath,
      message: "Dry run: no configuration files were written. Re-run with --confirm to apply."
    };
  }

  const backups: ManagedFileBackup[] = [];
  await mkdir(dirname(manifestPath), { recursive: true });

  for (const path of changedFiles) {
    backups.push(await backupFile(path, options.rootDir));
  }

  if (options.hosts.includes("codex")) {
    await writeManagedTextBlock(
      join(options.rootDir, ".codex", "config.toml"),
      renderCodexManagedBlock(gatewayBaseUrl)
    );
  }

  if (options.hosts.includes("claude-code")) {
    await writeManagedJsonObject(join(options.rootDir, ".claude", "settings.json"), {
      contextDiet: {
        anthropicBaseUrl: gatewayBaseUrl,
        credential: "ANTHROPIC_API_KEY environment variable",
        managed: true
      },
      ...(options.includeClaudeHook
        ? {
            hooks: {
              SessionStart: [
                {
                  command: "context-diet status --no-credentials",
                  description: "Context Diet local status check",
                  managedBy: "context-diet"
                }
              ]
            }
          }
        : {})
    });
  }

  if (options.includeMcp) {
    await writeManagedJsonObject(join(options.rootDir, ".context-diet", "mcp.json"), {
      mcpServers: {
        "context-diet-retrieval": {
          args: ["mcp", "retrieval"],
          command: "context-diet",
          env: {},
          managedBy: "context-diet"
        }
      }
    });
  }

  const manifest: LocalInstallManifest = {
    backups,
    createdAt: options.createdAt ?? new Date(0).toISOString(),
    credentialPolicy: "environment-variable-references-only",
    gatewayBaseUrl,
    hosts: [...options.hosts],
    includeClaudeHook: options.includeClaudeHook,
    includeMcp: options.includeMcp,
    installationId: options.installationId ?? "context-diet-local-install",
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
    await removeManagedContent(backup.target, backup.existed);
    changedFiles.push(backup.target);
  }

  return {
    applied: true,
    changedFiles,
    dryRun: false,
    manifestPath,
    message: "Uninstall complete: only Context Diet managed entries were removed."
  };
}

async function backupFile(path: string, rootDir: string): Promise<ManagedFileBackup> {
  const backup = join(rootDir, ".context-diet", "backups", encodeURIComponent(path));
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

function targetFiles(options: LocalConfigInstallOptions): readonly string[] {
  const files: string[] = [];
  if (options.hosts.includes("codex")) {
    files.push(join(options.rootDir, ".codex", "config.toml"));
  }
  if (options.hosts.includes("claude-code")) {
    files.push(join(options.rootDir, ".claude", "settings.json"));
  }
  if (options.includeMcp) {
    files.push(join(options.rootDir, ".context-diet", "mcp.json"));
  }
  return files;
}

function renderCodexManagedBlock(gatewayBaseUrl: string): string {
  return [
    'model_provider = "context_diet_local"',
    "",
    "[model_providers.context_diet_local]",
    'name = "Context Diet local gateway"',
    `base_url = "${gatewayBaseUrl}"`,
    'env_key = "OPENAI_API_KEY"'
  ].join("\n");
}

async function writeManagedTextBlock(path: string, block: string): Promise<void> {
  const existing = await readOptional(path);
  const cleaned = removeMarkedBlock(existing);
  await writeFile(
    path,
    `${cleaned}${cleaned.endsWith("\n") || cleaned.length === 0 ? "" : "\n"}${beginMarker}\n${block}\n${endMarker}\n`,
    {
      mode: 0o600
    }
  );
}

async function writeManagedJsonObject(
  path: string,
  managedObject: Record<string, unknown>
): Promise<void> {
  const existing = await readOptional(path);
  const parsed = parseJsonObject(existing, path);
  const next = {
    ...parsed,
    contextDietManaged: managedObject
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

async function removeManagedContent(path: string, existedBeforeInstall: boolean): Promise<void> {
  if (!existedBeforeInstall) {
    await rm(path, { force: true });
    return;
  }
  const existing = await readOptional(path);
  if (path.endsWith(".json")) {
    const parsed = parseJsonObject(existing, path);
    const rest = { ...parsed };
    delete rest["contextDietManaged"];
    await writeFile(path, `${JSON.stringify(rest, null, 2)}\n`, { mode: 0o600 });
    return;
  }
  await writeFile(path, removeMarkedBlock(existing), { mode: 0o600 });
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

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
