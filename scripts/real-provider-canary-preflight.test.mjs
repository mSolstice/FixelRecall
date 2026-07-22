import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { renderPreflightReport, runPreflight } from "./real-provider-canary-preflight.mjs";

const passingEnv = {
  CONTEXT_DIET_CANARY_MAX_COST_USD: "0.10",
  CONTEXT_DIET_CANARY_MAX_INPUT_TOKENS: "200",
  CONTEXT_DIET_CANARY_MAX_OUTPUT_TOKENS: "50",
  CONTEXT_DIET_CANARY_MAX_REQUESTS: "2",
  CONTEXT_DIET_CANARY_MODE: "Safe",
  CONTEXT_DIET_FAKE_BETA_PASSED: "true",
  CONTEXT_DIET_GATEWAY_BASE_URL: "http://127.0.0.1:4317",
  CONTEXT_DIET_KILL_SWITCH_READY: "true",
  CONTEXT_DIET_RAW_BODY_LOGGING: "false",
  CONTEXT_DIET_UPSTREAM_ALLOWLIST: "https://api.openai.example,https://api.anthropic.example"
};

test("real-provider canary preflight passes without provider traffic", async () => {
  const root = await mkdtemp(join(tmpdir(), "context-diet-preflight-pass-"));
  try {
    await writeFile(join(root, "README.md"), "safe synthetic fixture\n");

    const report = await runPreflight({ cwd: root, env: passingEnv });

    assert.equal(report.status, "PASS");
    assert.equal(report.providerTrafficSent, false);
    assert.equal(report.checks.length, 8);
    assert.match(renderPreflightReport(report), /Provider traffic sent: no/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("real-provider canary preflight fails closed on unsafe mode and missing budgets", async () => {
  const root = await mkdtemp(join(tmpdir(), "context-diet-preflight-fail-"));
  try {
    const report = await runPreflight({
      cwd: root,
      env: {
        ...passingEnv,
        CONTEXT_DIET_CANARY_MAX_COST_USD: "1",
        CONTEXT_DIET_CANARY_MODE: "Bypass"
      }
    });

    assert.equal(report.status, "FAIL");
    assert.equal(report.providerTrafficSent, false);
    assert.ok(report.checks.some((check) => check.label === "Safe mode only"));
    assert.ok(report.checks.some((check) => check.label === "token and cost budget configured"));
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("real-provider canary preflight rejects credentials in repository files", async () => {
  const root = await mkdtemp(join(tmpdir(), "context-diet-preflight-credential-"));
  try {
    await mkdir(join(root, "config"), { recursive: true });
    const leakedToken = `Authorization: Bearer ${"livecredentialvalue1234567890"}\n`;
    await writeFile(join(root, "config", "leak.txt"), leakedToken);

    const report = await runPreflight({ cwd: root, env: passingEnv });

    assert.equal(report.status, "FAIL");
    assert.equal(report.providerTrafficSent, false);
    assert.match(renderPreflightReport(report), /no credentials in repo/);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
