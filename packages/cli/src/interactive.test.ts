import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runCli, runCliCommand } from "./index.js";
import { isAffirmative, wantsGuidedFlow, type InteractiveIo } from "./interactive.js";

interface FakeIo extends InteractiveIo {
  readonly questions: string[];
  readonly stdout: () => string;
}

function fakeIo(answers: readonly string[], root: string, interactive = true): FakeIo {
  const queue = [...answers];
  const questions: string[] = [];
  let out = "";
  return {
    ask: async (question) => {
      questions.push(question);
      return queue.shift() ?? "";
    },
    env: { FIXEL_RECALL_CONFIG_ROOT: root },
    err: (text) => {
      out += text;
    },
    interactive,
    out: (text) => {
      out += text;
    },
    questions,
    stdout: () => out
  };
}

let root: string;
const manifest = (): string => join(root, ".fixel-recall", "install-manifest.json");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "fixel-recall-guided-"));
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("guided mode decision", () => {
  it("only applies to setup, rollback and uninstall without explicit flags", () => {
    const tty = fakeIo([], root, true);
    const pipe = fakeIo([], root, false);
    expect(wantsGuidedFlow(["setup"], tty)).toBe(true);
    expect(wantsGuidedFlow(["rollback"], tty)).toBe(true);
    expect(wantsGuidedFlow(["uninstall"], tty)).toBe(true);
    expect(wantsGuidedFlow(["status"], tty)).toBe(false);
    expect(wantsGuidedFlow(["setup", "codex", "--confirm"], tty)).toBe(false);
    expect(wantsGuidedFlow(["setup", "codex", "--dry-run"], tty)).toBe(false);
    expect(wantsGuidedFlow(["setup", "codex"], pipe)).toBe(false);
    expect(wantsGuidedFlow(["setup", "codex", "--yes"], pipe)).toBe(true);
  });

  it("treats only y and yes as consent", () => {
    expect(isAffirmative("y")).toBe(true);
    expect(isAffirmative(" YES ")).toBe(true);
    expect(isAffirmative("")).toBe(false);
    expect(isAffirmative("n")).toBe(false);
    expect(isAffirmative("sure")).toBe(false);
  });
});

describe("guided setup", () => {
  it("shows the preview, and writes nothing when the answer is not yes", async () => {
    const io = fakeIo(["n"], root);
    const code = await runCli(["setup", "codex"], io);
    expect(code).toBe(0);
    expect(io.questions).toEqual(["Apply these changes? (y/N) "]);
    expect(io.stdout()).toContain("Dry run");
    expect(io.stdout()).toContain("No changes were made.");
    expect(existsSync(manifest())).toBe(false);
  });

  it("defaults to no when the answer is empty", async () => {
    const io = fakeIo([""], root);
    await runCli(["setup", "codex"], io);
    expect(existsSync(manifest())).toBe(false);
  });

  it("applies into the configured root when the answer is yes", async () => {
    const io = fakeIo(["y"], root);
    const code = await runCli(["setup", "codex"], io);
    expect(code).toBe(0);
    expect(io.stdout()).toContain(`Config root: ${root}`);
    expect(existsSync(manifest())).toBe(true);
  });

  it("applies without asking when --yes is given, even without a terminal", async () => {
    const io = fakeIo([], root, false);
    const code = await runCli(["setup", "codex", "--yes"], io);
    expect(code).toBe(0);
    expect(io.questions).toEqual([]);
    expect(existsSync(manifest())).toBe(true);
  });

  it("asks which tool to set up when none was given", async () => {
    const io = fakeIo(["2", "n"], root);
    await runCli(["setup"], io);
    expect(io.questions[0]).toBe("Choose 1, 2 or 3 [3]: ");
    expect(io.stdout()).toContain("Claude Code");
    expect(existsSync(manifest())).toBe(false);
  });

  it("does not ask for a tool when one was given", async () => {
    const io = fakeIo(["n"], root);
    await runCli(["setup", "both"], io);
    expect(io.questions).toEqual(["Apply these changes? (y/N) "]);
  });

  it("offers to replace an existing install instead of requiring a flag", async () => {
    await runCli(["setup", "codex"], fakeIo(["y"], root));
    expect(existsSync(manifest())).toBe(true);

    const declined = fakeIo(["y", "n"], root);
    await runCli(["setup", "codex"], declined);
    expect(declined.stdout()).toContain("Refused: an existing Fixel Recall install manifest");
    expect(declined.questions[1]).toBe("Replace the existing install? (y/N) ");
    expect(declined.stdout()).toContain("No changes were made.");

    const replaced = fakeIo(["y", "y"], root);
    const code = await runCli(["setup", "codex"], replaced);
    expect(code).toBe(0);
    expect(replaced.questions).toHaveLength(2);
  });
});

describe("guided rollback and uninstall", () => {
  it("rolls back only after confirmation", async () => {
    await runCli(["setup", "codex", "--yes"], fakeIo([], root, false));
    const io = fakeIo(["y"], root);
    const code = await runCli(["rollback"], io);
    expect(code).toBe(0);
    expect(io.questions).toEqual(["Apply these changes? (y/N) "]);
    expect(io.stdout()).toContain("Fixel Recall rollback");
  });

  it("leaves everything alone when rollback is declined", async () => {
    await runCli(["setup", "codex", "--yes"], fakeIo([], root, false));
    const io = fakeIo(["n"], root);
    await runCli(["rollback"], io);
    expect(io.stdout()).toContain("No changes were made.");
    expect(existsSync(manifest())).toBe(true);
  });

  it("uninstalls after confirmation", async () => {
    await runCli(["setup", "codex", "--yes"], fakeIo([], root, false));
    const io = fakeIo(["y"], root);
    const code = await runCli(["uninstall"], io);
    expect(code).toBe(0);
    expect(io.stdout()).toContain("Fixel Recall uninstall");
  });
});

describe("help and version", () => {
  it("prints help with no arguments instead of an unknown-command error", async () => {
    const result = await runCliCommand([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: fixel-recall <command>");
    expect(result.stdout).toContain(
      "Available for macOS CLI users of Codex CLI and Claude Code CLI."
    );
  });

  it("accepts help, --help and -h", async () => {
    for (const flag of ["help", "--help", "-h"]) {
      const result = await runCliCommand([flag]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Usage: fixel-recall <command>");
    }
  });

  it("reports a version", async () => {
    for (const flag of ["--version", "-v", "version"]) {
      const result = await runCliCommand([flag]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim().length).toBeGreaterThan(0);
    }
  });

  it("points unknown commands at --help", async () => {
    const result = await runCliCommand(["definitely-not-a-command"]);
    expect(result.exitCode).toBe(64);
    expect(result.stderr).toContain("fixel-recall --help");
  });
});
