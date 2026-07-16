#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function parseMajorVersion(output) {
  const match = String(output).match(/v?(\d+)(?:\.\d+){0,2}/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function checkAllowedMajor(label, output, allowedMajors) {
  const major = parseMajorVersion(output);
  const allowedText = allowedMajors.join(" or ");

  if (major !== null && allowedMajors.includes(major)) {
    return {
      status: "PASS",
      label,
      detail: `${label} major version is ${major}.`
    };
  }

  if (major === null) {
    return {
      status: "FAIL",
      label,
      detail: `${label} version could not be parsed. Install ${label} ${allowedText}.`
    };
  }

  return {
    status: "FAIL",
    label,
    detail: `${label} major version is ${major}; allowed major versions are ${allowedText}.`
  };
}

export function checkRequiredMajor(label, output, requiredMajor) {
  return checkAllowedMajor(label, output, [requiredMajor]);
}

function result(status, label, detail) {
  return { status, label, detail };
}

async function commandOutput(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      encoding: "utf8",
      timeout: 5000
    });
    const cleanStdout = stdout.trim();
    return { ok: true, output: cleanStdout.length > 0 ? cleanStdout : stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      output: error?.code ? String(error.code) : "command failed"
    };
  }
}

async function checkCommand(label, command, args, nextAction) {
  const checked = await commandOutput(command, args);
  if (checked.ok) {
    return result("PASS", label, `${label} is available: ${checked.output}`);
  }

  return result("WARN", label, `${label} is unavailable. Next action: ${nextAction}`);
}

async function checkGitRepository() {
  const checked = await commandOutput("git", ["rev-parse", "--is-inside-work-tree"]);
  if (checked.ok && checked.output === "true") {
    return result("PASS", "Git repository", "Current folder is a Git repository.");
  }

  return result(
    "FAIL",
    "Git repository",
    "Current folder is not a Git repository. Next action: run git init."
  );
}

function checkFile(path, label) {
  if (existsSync(path)) {
    return result("PASS", label, `${path} exists.`);
  }

  return result("FAIL", label, `${path} is missing. Next action: restore it from the build pack.`);
}

async function checkVersionedCommand(label, command, args, allowedMajors, installHint) {
  const checked = await commandOutput(command, args);
  if (!checked.ok) {
    return result("FAIL", label, `${label} is unavailable. Next action: ${installHint}`);
  }

  const versionResult = checkAllowedMajor(label, checked.output, allowedMajors);
  return {
    ...versionResult,
    detail: `${versionResult.detail} Detected output: ${checked.output}`
  };
}

export async function collectEnvironmentResults() {
  const results = [
    result(
      "PASS",
      "Operating system",
      `${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`
    ),
    await checkCommand("Git", "git", ["--version"], "install Git, then rerun this checker."),
    await checkVersionedCommand(
      "Node.js",
      "node",
      ["--version"],
      [24, 26],
      "install Node.js 24 LTS or Node.js 26."
    ),
    await checkVersionedCommand(
      "pnpm",
      "pnpm",
      ["--version"],
      [11],
      "install pnpm 11 with Corepack."
    ),
    await checkCommand(
      "Codex CLI",
      "codex",
      ["--version"],
      "install Codex before Codex routing tests."
    ),
    await checkCommand(
      "Claude Code CLI",
      "claude",
      ["--version"],
      "install Claude Code before dual-platform tests."
    ),
    await checkGitRepository(),
    checkFile("AGENTS.md", "AGENTS.md"),
    checkFile("CLAUDE.md", "CLAUDE.md"),
    checkFile("docs/CONTEXT_DIET_BLUEPRINT.md", "Blueprint")
  ];

  return results;
}

export function formatResults(results) {
  return results.map((item) => `${item.status} ${item.label}: ${item.detail}`).join("\n");
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const results = await collectEnvironmentResults();
  console.log(formatResults(results));

  if (results.some((item) => item.status === "FAIL")) {
    process.exitCode = 1;
  }
}
