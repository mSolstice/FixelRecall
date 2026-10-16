import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cliVersion } from "./version.js";

/**
 * How an agent should start this CLI. Setup writes this into Codex and Claude Code
 * configuration, so it has to keep working after the setup command has exited:
 * the bare name `fixel-recall` only resolves when the package is installed globally,
 * and a path inside an npx cache can be deleted at any time.
 */
export interface CliLauncher {
  readonly command: string;
  readonly args: readonly string[];
}

export function mcpLauncherForPlatform(
  launcher: CliLauncher,
  platform: NodeJS.Platform
): CliLauncher {
  if (platform !== "win32" || (launcher.command !== "npx" && launcher.command !== "npx.cmd")) {
    return launcher;
  }
  return { args: ["/d", "/s", "/c", "npx", ...launcher.args], command: "cmd" };
}

/** True for a path inside a package-runner cache (npx, pnpm dlx, bunx). */
export function isEphemeralCliPath(path: string): boolean {
  return /[\\/]_npx[\\/]|[\\/]dlx-[^\\/]+[\\/]|[\\/]\.?bunx-[^\\/]*[\\/]/.test(path);
}

/** The real file this CLI is running from, with symlinks (npm's bin link) resolved. */
export function cliEntryPath(): string {
  const entry = join(dirname(fileURLToPath(import.meta.url)), "index.js");
  try {
    return realpathSync(entry);
  } catch {
    return entry;
  }
}

/**
 * A stable install runs `node <real path>`. A throwaway cache cannot be pointed at, so
 * those runs re-fetch the same pinned version with `npx -y`.
 */
export function cliLauncher(
  entryPath: string = cliEntryPath(),
  version: string = cliVersion()
): CliLauncher {
  return isEphemeralCliPath(entryPath)
    ? { args: ["-y", `fixel-recall@${version}`], command: "npx" }
    : { args: [entryPath], command: "node" };
}

export function launcherWith(
  launcher: CliLauncher,
  ...extra: readonly string[]
): readonly string[] {
  return [...launcher.args, ...extra];
}

function shellQuote(value: string, platform: NodeJS.Platform): string {
  if (/^[\w@%+=:,./\\-]+$/.test(value)) return value;
  return platform === "win32"
    ? `"${value.replaceAll('"', '""')}"`
    : `'${value.replaceAll("'", "'\\''")}'`;
}

/** A single command line, quoted, for places that take one string (hook commands). */
export function launcherCommandLine(launcher: CliLauncher, ...extra: readonly string[]): string {
  return launcherCommandLineForPlatform(launcher, process.platform, ...extra);
}

export function launcherCommandLineForPlatform(
  launcher: CliLauncher,
  platform: NodeJS.Platform,
  ...extra: readonly string[]
): string {
  return [launcher.command, ...launcher.args, ...extra]
    .map((value) => shellQuote(value, platform))
    .join(" ");
}
