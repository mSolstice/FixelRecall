import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { syncSkills } from "../../scripts/sync-skills.js";

const skill = `---
name: fixel-recall
description:
  Use when the user asks to audit coding-agent context, reduce token or context waste, diagnose
  Fixel Recall, start or stop the local service, explain a policy decision, run a benchmark,
  retrieve exact context, understand why a block stayed native, or troubleshoot Codex or Claude Code
  setup.
---

# Fixel Recall

Operate the local Fixel Recall engine for Codex and Claude Code.

## Rules

- This skill operates a local engine and gateway for future provider requests.
- It cannot compress or transform the request already invoking this skill.
- Safe mode is the default.
- Exact, current, action-critical and secret-sensitive material stays protected.
- Benchmark results may be positive, neutral or negative.

## References

- \`references/OPERATIONS.md\`
- \`references/SAFETY.md\`
- \`references/STRUCTURED_LOGS.md\`
- \`references/BENCHMARKING.md\`
- \`references/TROUBLESHOOTING.md\`
- \`references/CODEX_SETUP.md\`
- \`references/CLAUDE_CODE_SETUP.md\`
`;

const references = [
  "OPERATIONS.md",
  "SAFETY.md",
  "STRUCTURED_LOGS.md",
  "BENCHMARKING.md",
  "TROUBLESHOOTING.md",
  "CODEX_SETUP.md",
  "CLAUDE_CODE_SETUP.md"
] as const;

describe("deterministic skill sync", () => {
  it("copies canonical files and removes stale generated files", async () => {
    const root = await fixtureRoot();
    await writeFile(join(root, ".agents/skills/fixel-recall/stale.md"), "old", "utf8");

    const result = await syncSkills({ rootDir: root });

    expect(result.ok).toBe(true);
    expect(result.copied).toContain(".agents/skills/fixel-recall/SKILL.md");
    expect(result.removed).toContain(".agents/skills/fixel-recall/stale.md");
    await expect(
      readFile(join(root, ".claude/skills/fixel-recall/SKILL.md"), "utf8")
    ).resolves.toBe(skill);
  });

  it("fails check mode on drift without editing generated files", async () => {
    const root = await fixtureRoot();
    await syncSkills({ rootDir: root });
    const generated = join(root, ".claude/skills/fixel-recall/SKILL.md");
    await writeFile(generated, "drift", "utf8");

    const result = await syncSkills({ checkOnly: true, rootDir: root });

    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("run pnpm sync:skills");
    await expect(readFile(generated, "utf8")).resolves.toBe("drift");
    await expect(readFile(join(root, "skill-source/fixel-recall/SKILL.md"), "utf8")).resolves.toBe(
      skill
    );
  });

  it("validates trigger metadata and canonical requirements", async () => {
    const root = await fixtureRoot();
    await writeFile(
      join(root, "skill-source/fixel-recall/SKILL.md"),
      "---\nname: other\n---\n# Broken\n",
      "utf8"
    );

    const result = await syncSkills({ checkOnly: true, rootDir: root });

    expect(result.ok).toBe(false);
    expect(result.failures.join("\n")).toContain("name: fixel-recall");
    expect(result.failures.join("\n")).toContain("description is missing");
  });
});

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "fixel-recall-skill-sync-"));
  await mkdir(join(root, "skill-source/fixel-recall/references"), { recursive: true });
  await mkdir(join(root, ".agents/skills/fixel-recall"), { recursive: true });
  await mkdir(join(root, ".claude/skills/fixel-recall"), { recursive: true });
  await writeFile(join(root, "skill-source/fixel-recall/SKILL.md"), skill, "utf8");
  for (const reference of references) {
    await writeFile(
      join(root, "skill-source/fixel-recall/references", reference),
      `# ${reference}\n\nFixture reference.\n`,
      "utf8"
    );
  }
  return root;
}
