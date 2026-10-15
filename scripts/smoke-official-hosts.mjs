import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

import { createFakeGateway } from "../packages/proxy/dist/index.js";

const fakeCodexKey = "fake-official-codex-key";
const fakeClaudeKey = "fake-official-claude-key";
const scriptRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptRoot, "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "fixel-recall-official-host-"));
const gateway = createFakeGateway();

await new Promise((resolveListen, reject) => {
  gateway.server.once("error", reject);
  gateway.server.listen(0, "127.0.0.1", resolveListen);
});

const address = gateway.server.address();
if (address === null || typeof address === "string") {
  throw new Error("The fake gateway did not bind to a loopback TCP port.");
}
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const codex = await smokeCodex();
  const claude = await smokeClaude();
  const status = gateway.status();

  if (status.metrics.providerRequests.openai < 1 || status.metrics.providerRequests.anthropic < 1) {
    throw new Error("Both official hosts did not reach their expected fake-provider route.");
  }
  if (status.metrics.authValuesRetained || status.metrics.rawBodiesPersisted) {
    throw new Error("The fake gateway reported unsafe credential or raw-body retention.");
  }

  console.log(
    JSON.stringify({
      result: "PASS",
      environment: `${process.platform}-${process.arch}`,
      gateway: "loopback fake provider",
      codex,
      claude,
      credentials: "fake only",
      rawBodiesPersisted: false
    })
  );
} finally {
  await gateway.close();
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function smokeCodex() {
  const codexHome = join(temporaryRoot, "codex-home");
  await mkdir(codexHome, { recursive: true });
  await writeFile(
    join(codexHome, "config.toml"),
    [
      'model = "fake-openai-model"',
      'model_provider = "fixel_test"',
      "",
      "[features]",
      "apps = false",
      "plugins = false",
      "remote_plugin = false",
      "",
      "[model_providers.fixel_test]",
      'name = "Fixel Recall official-host smoke"',
      `base_url = "${baseUrl}/v1"`,
      'wire_api = "responses"',
      "requires_openai_auth = false",
      'env_key = "OPENAI_API_KEY"',
      ""
    ].join("\n")
  );

  const command = resolveCodexCommand();
  const result = await run(
    command,
    ["exec", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "Reply briefly."],
    {
      CODEX_HOME: codexHome,
      OPENAI_API_KEY: fakeCodexKey
    }
  );
  assertSafeOutput(result);
  if (result.code !== 0 || !result.stdout.includes("Fake OpenAI response")) {
    throw hostFailure("Codex CLI", result);
  }
  return { result: "PASS", response: "Fake OpenAI response" };
}

async function smokeClaude() {
  const claudeHome = join(temporaryRoot, "claude-home");
  await mkdir(claudeHome, { recursive: true });
  const result = await run(
    process.env["CLAUDE_BIN"] ?? "claude",
    ["--bare", "-p", "--max-turns", "1", "--model", "fake-claude-model", "Reply briefly."],
    {
      ANTHROPIC_API_KEY: fakeClaudeKey,
      ANTHROPIC_BASE_URL: baseUrl,
      CLAUDE_CONFIG_DIR: claudeHome,
      CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT: "1"
    }
  );
  assertSafeOutput(result);
  if (result.code !== 0 || !result.stdout.includes("Fake Anthropic response")) {
    throw hostFailure("Claude Code CLI", result);
  }
  return { result: "PASS", response: "Fake Anthropic response" };
}

function resolveCodexCommand() {
  if (process.env["CODEX_BIN"] !== undefined) return process.env["CODEX_BIN"];
  const appBinary = "/Applications/Codex.app/Contents/Resources/codex";
  return process.platform === "darwin" && existsSync(appBinary) ? appBinary : "codex";
}

async function run(command, args, extraEnvironment) {
  return await new Promise((resolveRun, reject) => {
    const invocation = createInvocation(command, args);
    const child = spawn(invocation.command, invocation.args, {
      cwd: repositoryRoot,
      env: { ...process.env, ...extraEnvironment },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 30_000);

    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      resolveRun({ code, stderr, stdout, timedOut });
    });
  });
}

function createInvocation(command, args) {
  if (process.platform !== "win32") return { command, args };
  const executable = /\s/.test(command) ? quoteWindowsArgument(command) : command;
  const commandLine = [executable, ...args.map(quoteWindowsArgument)].join(" ");
  return {
    command: process.env["ComSpec"] ?? "cmd.exe",
    args: ["/d", "/s", "/c", commandLine]
  };
}

function quoteWindowsArgument(value) {
  return `"${value.replaceAll('"', '""').replaceAll("%", "%%")}"`;
}

function assertSafeOutput(result) {
  const output = `${result.stdout}\n${result.stderr}`;
  if (output.includes(fakeCodexKey) || output.includes(fakeClaudeKey)) {
    throw new Error("An official host printed a fake credential.");
  }
}

function hostFailure(host, result) {
  const safeOutput = `${result.stdout}\n${result.stderr}`.slice(0, 2_000);
  return new Error(
    `${host} smoke failed (exit ${String(result.code)}, timeout ${String(result.timedOut)}):\n${safeOutput}`
  );
}
