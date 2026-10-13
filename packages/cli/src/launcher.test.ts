import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  cliLauncher,
  isEphemeralCliPath,
  launcherCommandLine,
  type CliLauncher
} from "./launcher.js";
import { installLocalConfig } from "./local-config.js";

describe("isEphemeralCliPath", () => {
  it.each([
    "/Users/dev/.npm/_npx/6f2a1c/node_modules/fixel-recall/bundle/index.js",
    "/Users/dev/Library/Caches/pnpm/dlx-4821-1/node_modules/fixel-recall/bundle/index.js",
    "/Users/dev/.bunx-501-fixel-recall/node_modules/fixel-recall/bundle/index.js"
  ])("treats a package-runner cache as throwaway: %s", (path) => {
    expect(isEphemeralCliPath(path)).toBe(true);
  });

  it.each([
    "/opt/homebrew/lib/node_modules/fixel-recall/bundle/index.js",
    "/Users/dev/Documents/Context Diet/repo/packages/cli/dist/index.js",
    "/Users/dev/projects/fixel-recall/packages/cli/bundle/index.js"
  ])("treats a stable install as permanent: %s", (path) => {
    expect(isEphemeralCliPath(path)).toBe(false);
  });
});

describe("cliLauncher", () => {
  it("points a stable install at its real file with node", () => {
    expect(
      cliLauncher("/opt/homebrew/lib/node_modules/fixel-recall/bundle/index.js", "0.1.0")
    ).toEqual({
      args: ["/opt/homebrew/lib/node_modules/fixel-recall/bundle/index.js"],
      command: "node"
    });
  });

  it("re-fetches a pinned version for an npx run instead of pointing into the cache", () => {
    expect(
      cliLauncher("/Users/dev/.npm/_npx/6f2a1c/node_modules/fixel-recall/bundle/index.js", "0.1.0")
    ).toEqual({ args: ["-y", "fixel-recall@0.1.0"], command: "npx" });
  });
});

describe("launcherCommandLine", () => {
  it("quotes a path with spaces so a hook command still parses", () => {
    expect(
      launcherCommandLine(
        { args: ["/Users/dev/Documents/Context Diet/index.js"], command: "node" },
        "status",
        "--no-credentials"
      )
    ).toBe("node '/Users/dev/Documents/Context Diet/index.js' status --no-credentials");
  });

  it("leaves a plain npx command unquoted", () => {
    expect(
      launcherCommandLine({ args: ["-y", "fixel-recall@0.1.0"], command: "npx" }, "status")
    ).toBe("npx -y fixel-recall@0.1.0 status");
  });
});

describe("setup writes a launcher that works without fixel-recall on PATH", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "fixel-recall-launcher-"));
  });
  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  const install = (launcher: CliLauncher) =>
    installLocalConfig({
      confirm: true,
      hosts: ["codex", "claude-code"],
      includeClaudeHook: true,
      includeMcp: true,
      launcher,
      rootDir: root
    });

  it("uses the npx launcher in every file it writes", async () => {
    await install({ args: ["-y", "fixel-recall@0.1.0"], command: "npx" });

    const toml = await readFile(join(root, ".codex", "config.toml"), "utf8");
    expect(toml).toContain('command = "npx"');
    expect(toml).toContain('args = ["-y","fixel-recall@0.1.0","mcp","retrieval"]');

    const claudeMcp = JSON.parse(await readFile(join(root, ".claude.json"), "utf8")) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(claudeMcp.mcpServers["fixel-recall-retrieval"]).toMatchObject({
      args: ["-y", "fixel-recall@0.1.0", "mcp", "retrieval"],
      command: "npx"
    });

    const shared = JSON.parse(await readFile(join(root, ".fixel-recall", "mcp.json"), "utf8")) as {
      fixelRecallManaged: { mcpServers: Record<string, { command: string; args: string[] }> };
    };
    expect(shared.fixelRecallManaged.mcpServers["fixel-recall-retrieval"]).toMatchObject({
      args: ["-y", "fixel-recall@0.1.0", "mcp", "retrieval"],
      command: "npx"
    });

    const settings = JSON.parse(await readFile(join(root, ".claude", "settings.json"), "utf8")) as {
      hooks: { SessionStart: { command: string }[] };
    };
    expect(settings.hooks.SessionStart[0]?.command).toBe(
      "npx -y fixel-recall@0.1.0 status --no-credentials"
    );
  });

  it("never writes the bare name that only works after a global install", async () => {
    await install({ args: ["/stable/path/index.js"], command: "node" });
    for (const file of [
      join(root, ".codex", "config.toml"),
      join(root, ".claude.json"),
      join(root, ".fixel-recall", "mcp.json"),
      join(root, ".claude", "settings.json")
    ]) {
      const text = await readFile(file, "utf8");
      expect(text, file).not.toMatch(/"command": "fixel-recall"|command = "fixel-recall"/);
      expect(text, file).toContain("/stable/path/index.js");
    }
  });
});
