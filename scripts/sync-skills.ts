#!/usr/bin/env node

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface SkillSyncOptions {
  readonly rootDir?: string;
  readonly checkOnly?: boolean;
}

export interface SkillSyncResult {
  readonly ok: boolean;
  readonly copied: readonly string[];
  readonly removed: readonly string[];
  readonly stale: readonly string[];
  readonly failures: readonly string[];
}

interface SkillFile {
  readonly relativePath: string;
  readonly content: string;
}

const canonicalRoot = "skill-source/fixel-recall";
const generatedRoots = [".agents/skills/fixel-recall", ".claude/skills/fixel-recall"] as const;
const requiredReferences = [
  "OPERATIONS.md",
  "SAFETY.md",
  "STRUCTURED_LOGS.md",
  "BENCHMARKING.md",
  "TROUBLESHOOTING.md",
  "CODEX_SETUP.md",
  "CLAUDE_CODE_SETUP.md",
  "PLATFORMS.md"
] as const;
const explicitExamples = [
  "Use the fixel-recall skill to diagnose my local gateway.",
  "Run Fixel Recall benchmark and explain the result.",
  "Fixel Recall retrieve exact context for this block."
] as const;
const implicitExamples = [
  "Audit coding-agent context waste in this repo.",
  "Why did the policy keep this block native?",
  "Troubleshoot Claude Code setup for the local compression gateway.",
  "How do I reduce token waste for future Codex requests?"
] as const;

export async function syncSkills(options: SkillSyncOptions = {}): Promise<SkillSyncResult> {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const checkOnly = options.checkOnly === true;
  const copied: string[] = [];
  const removed: string[] = [];
  const stale: string[] = [];
  const failures: string[] = [];
  const canonicalFiles = await readCanonicalFiles(rootDir, failures);

  validateCanonical(canonicalFiles, failures);
  validateTriggerExamples(canonicalFiles, failures);

  for (const targetRoot of generatedRoots) {
    const targetDirectory = resolve(rootDir, targetRoot);
    const expected = new Map(
      canonicalFiles.map((file) => [normalisePath(file.relativePath), file])
    );
    const existing = await listFiles(targetDirectory);

    for (const file of canonicalFiles) {
      const targetPath = resolve(targetDirectory, file.relativePath);
      const current = await readOptional(targetPath);
      if (current !== file.content) {
        stale.push(display(rootDir, targetPath));
        if (!checkOnly) {
          await mkdir(resolve(targetPath, ".."), { recursive: true });
          await writeFile(targetPath, file.content, "utf8");
          copied.push(display(rootDir, targetPath));
        }
      }
    }

    for (const existingPath of existing) {
      const relativePath = normalisePath(relative(targetDirectory, existingPath));
      if (!expected.has(relativePath)) {
        stale.push(display(rootDir, existingPath));
        if (!checkOnly) {
          await rm(existingPath, { force: true });
          removed.push(display(rootDir, existingPath));
        }
      }
    }
  }

  if (checkOnly && stale.length > 0) {
    failures.push("generated skill targets differ from canonical source; run pnpm sync:skills");
  }

  return {
    copied,
    failures,
    ok: failures.length === 0,
    removed,
    stale: [...new Set(stale)].sort()
  };
}

export async function runSkillSyncCli(checkOnly: boolean): Promise<number> {
  const result = await syncSkills({ checkOnly });
  for (const copied of result.copied) {
    console.log(`copied ${copied}`);
  }
  for (const removed of result.removed) {
    console.log(`removed ${removed}`);
  }
  if (result.ok) {
    console.log(
      checkOnly
        ? "PASS skill metadata, sync and trigger examples"
        : "PASS synced generated skill targets"
    );
    return 0;
  }
  for (const stale of result.stale) {
    console.error(`STALE ${stale}`);
  }
  for (const failure of result.failures) {
    console.error(`FAIL ${failure}`);
  }
  return 1;
}

async function readCanonicalFiles(
  rootDir: string,
  failures: string[]
): Promise<readonly SkillFile[]> {
  const files: SkillFile[] = [];
  for (const relativePath of skillFilePaths()) {
    const fullPath = resolve(rootDir, canonicalRoot, relativePath);
    const content = await readOptional(fullPath);
    if (content === undefined) {
      failures.push(`missing canonical ${display(rootDir, fullPath)}`);
      continue;
    }
    files.push({ content, relativePath });
  }
  return files;
}

function validateCanonical(files: readonly SkillFile[], failures: string[]): void {
  const skill = files.find((file) => file.relativePath === "SKILL.md");
  if (skill === undefined) {
    return;
  }
  const frontmatter = parseFrontmatter(skill.content);
  if (frontmatter.name !== "fixel-recall") {
    failures.push("canonical SKILL.md must declare name: fixel-recall");
  }
  if ((frontmatter.description ?? "").length < 80) {
    failures.push("canonical SKILL.md description is missing or too vague");
  }
  if (skill.content.length > 3_000) {
    failures.push("canonical SKILL.md should stay concise");
  }
  for (const reference of requiredReferences) {
    const relativePath = `references/${reference}`;
    if (!skill.content.includes(relativePath)) {
      failures.push(`canonical SKILL.md does not mention ${relativePath}`);
    }
    if (!files.some((file) => file.relativePath === relativePath)) {
      failures.push(`missing canonical reference ${relativePath}`);
    }
  }
  for (const phrase of [
    "local engine",
    "cannot compress or transform the request already invoking this skill",
    "Safe mode is the default",
    "secret-sensitive material stays protected",
    "Benchmark results may be positive, neutral or negative"
  ]) {
    if (!skill.content.includes(phrase)) {
      failures.push(`canonical SKILL.md missing required phrase: ${phrase}`);
    }
  }
}

function validateTriggerExamples(files: readonly SkillFile[], failures: string[]): void {
  const skill = files.find((file) => file.relativePath === "SKILL.md");
  if (skill === undefined) {
    return;
  }
  const description = parseFrontmatter(skill.content).description ?? "";
  for (const example of explicitExamples) {
    const lowered = example.toLowerCase();
    if (!lowered.includes("fixel recall") && !lowered.includes("fixel-recall")) {
      failures.push(`explicit trigger example does not name Fixel Recall: ${example}`);
    }
  }
  const descriptionWords = new Set(
    description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
  for (const example of implicitExamples) {
    const words = example
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3);
    const matches = words.filter((word) => descriptionWords.has(word));
    if (matches.length < 2) {
      failures.push(`implicit trigger example is not covered by description: ${example}`);
    }
  }
}

async function listFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true }).catch(
    () => []
  );
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort();
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return normaliseNewlines(await readFile(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function skillFilePaths(): readonly string[] {
  return ["SKILL.md", ...requiredReferences.map((reference) => `references/${reference}`)];
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) {
    return {};
  }
  const result: Record<string, string> = {};
  const frontmatter = match[1];
  if (frontmatter === undefined) {
    return result;
  }
  const lines = frontmatter.split("\n");
  let currentKey = "";
  for (const line of lines) {
    const keyValue = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line);
    if (keyValue !== null) {
      currentKey = keyValue[1] ?? "";
      result[currentKey] = (keyValue[2] ?? "").trim();
      continue;
    }
    if (currentKey.length > 0 && /^\s+/.test(line)) {
      result[currentKey] = `${result[currentKey]} ${line.trim()}`.trim();
    }
  }
  return result;
}

function normaliseNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function normalisePath(value: string): string {
  return value.split("\\").join("/");
}

function display(rootDir: string, path: string): string {
  return normalisePath(relative(rootDir, path));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await runSkillSyncCli(process.argv.includes("--check"));
}
