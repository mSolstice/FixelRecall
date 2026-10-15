import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { installLocalConfig, rollbackLocalConfig } from "./local-config.js";

describe("cross-platform transactional configuration", () => {
  it.each(["darwin", "linux", "win32"] as const)(
    "generates both-host config and restores originals for %s",
    async (platform) => {
      const root = await mkdtemp(join(tmpdir(), `fixel-recall-${platform}-`));
      const codexPath = join(root, ".codex", "config.toml");
      const claudePath = join(root, ".claude", "settings.json");
      const originalCodex = 'model = "direct-model"\n';
      const originalClaude = '{"keep":"user-setting"}\n';
      try {
        await mkdir(join(root, ".codex"), { recursive: true });
        await mkdir(join(root, ".claude"), { recursive: true });
        await writeFile(codexPath, originalCodex);
        await writeFile(claudePath, originalClaude);

        const installed = await installLocalConfig({
          confirm: true,
          hosts: ["codex", "claude-code"],
          includeClaudeHook: true,
          includeMcp: true,
          launcher: { args: ["-y", "fixel-recall@0.1.0"], command: "npx" },
          platform,
          rootDir: root
        });
        expect(installed.applied).toBe(true);

        const codex = await readFile(codexPath, "utf8");
        const claude = await readFile(claudePath, "utf8");
        const claudeMcp = await readFile(join(root, ".claude.json"), "utf8");
        expect(codex).toContain('model_provider = "fixel_recall_local"');
        expect(claude).toContain('"ANTHROPIC_BASE_URL": "http://127.0.0.1:4317"');
        expect(`${codex}\n${claudeMcp}`).toContain(platform === "win32" ? '"cmd"' : '"npx"');
        expect(`${codex}\n${claude}\n${claudeMcp}`).not.toContain("sk-");
        expect(`${codex}\n${claude}\n${claudeMcp}`).not.toContain("Bearer ");

        const rolledBack = await rollbackLocalConfig(root);
        expect(rolledBack.applied).toBe(true);
        await expect(readFile(codexPath, "utf8")).resolves.toBe(originalCodex);
        await expect(readFile(claudePath, "utf8")).resolves.toBe(originalClaude);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    }
  );
});
