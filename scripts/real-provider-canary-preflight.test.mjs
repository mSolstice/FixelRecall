import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { renderPreflightReport, runPreflight } from "./real-provider-canary-preflight.mjs";

const passingEnv = {
  FIXEL_RECALL_CANARY_MAX_COST_USD: "0.10",
  FIXEL_RECALL_CANARY_MAX_INPUT_TOKENS: "200",
  FIXEL_RECALL_CANARY_MAX_OUTPUT_TOKENS: "50",
  FIXEL_RECALL_CANARY_MAX_REQUESTS: "2",
  FIXEL_RECALL_CANARY_MODE: "Safe",
  FIXEL_RECALL_FAKE_BETA_PASSED: "true",
  FIXEL_RECALL_GATEWAY_BASE_URL: "http://127.0.0.1:4317",
  FIXEL_RECALL_KILL_SWITCH_READY: "true",
  FIXEL_RECALL_RAW_BODY_LOGGING: "false",
  FIXEL_RECALL_UPSTREAM_ALLOWLIST: "https://api.openai.example,https://api.anthropic.example"
};

test("real-provider canary preflight passes without provider traffic", async () => {
  const root = await mkdtemp(join(tmpdir(), "fixel-recall-preflight-pass-"));
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
  const root = await mkdtemp(join(tmpdir(), "fixel-recall-preflight-fail-"));
  try {
    const report = await runPreflight({
      cwd: root,
      env: {
        ...passingEnv,
        FIXEL_RECALL_CANARY_MAX_COST_USD: "1",
        FIXEL_RECALL_CANARY_MODE: "Bypass"
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
  const root = await mkdtemp(join(tmpdir(), "fixel-recall-preflight-credential-"));
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
