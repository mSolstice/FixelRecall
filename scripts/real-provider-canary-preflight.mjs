#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL, URL } from "node:url";

const credentialPatterns = [
  /sk-(?:live|proj|ant|test)?-[A-Za-z0-9_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._~+/-]{20,}/g,
  /(?:OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*=\s*["']?[^"'\s]+/g
];

export async function runPreflight(input = {}) {
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const checks = [];

  checks.push(checkSafeMode(env));
  checks.push(checkLoopbackGateway(env));
  checks.push(checkUpstreamAllowlist(env));
  checks.push(checkBooleanEnv(env, "CONTEXT_DIET_KILL_SWITCH_READY", "kill switch reachable"));
  checks.push(checkBooleanEnv(env, "CONTEXT_DIET_FAKE_BETA_PASSED", "fake beta passed"));
  checks.push(checkRawBodyLogging(env));
  checks.push(checkBudget(env));
  checks.push(await checkNoCredentialsInRepo(cwd));

  const passed = checks.every((check) => check.status === "PASS");
  return {
    checks,
    providerTrafficSent: false,
    status: passed ? "PASS" : "FAIL",
    summary: passed
      ? "Real-provider canary preflight passed without sending provider traffic."
      : "Real-provider canary preflight failed. Do not run a real-provider canary."
  };
}

export function renderPreflightReport(report) {
  return [
    `Status: ${report.status}`,
    report.summary,
    "Provider traffic sent: no",
    "",
    ...report.checks.map(
      (check) =>
        `${check.status} ${check.label}: ${check.detail}${check.nextAction ? ` Next: ${check.nextAction}` : ""}`
    )
  ].join("\n");
}

function checkSafeMode(env) {
  const mode = (env.CONTEXT_DIET_CANARY_MODE ?? env.CONTEXT_DIET_MODE ?? "").toLowerCase();
  return mode === "safe"
    ? pass("Safe mode only", "Safe mode is explicitly configured.")
    : fail(
        "Safe mode only",
        "Safe mode is not explicitly configured.",
        "Set CONTEXT_DIET_CANARY_MODE=Safe."
      );
}

function checkLoopbackGateway(env) {
  const value = env.CONTEXT_DIET_GATEWAY_BASE_URL ?? "";
  try {
    const parsed = new URL(value);
    const loopback =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "::1" || parsed.hostname === "[::1]";
    return loopback && (parsed.protocol === "http:" || parsed.protocol === "https:")
      ? pass("loopback gateway", `Gateway base URL is loopback: ${parsed.origin}.`)
      : fail(
          "loopback gateway",
          "Gateway base URL is not loopback.",
          "Use http://127.0.0.1:<port> for the canary."
        );
  } catch {
    return fail(
      "loopback gateway",
      "Gateway base URL is missing or invalid.",
      "Set CONTEXT_DIET_GATEWAY_BASE_URL."
    );
  }
}

function checkUpstreamAllowlist(env) {
  const values = (env.CONTEXT_DIET_UPSTREAM_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) {
    return fail(
      "upstream allowlist set",
      "No upstream allowlist is configured.",
      "Set CONTEXT_DIET_UPSTREAM_ALLOWLIST to expected provider origins."
    );
  }
  const invalid = values.filter((value) => {
    try {
      const parsed = new URL(value);
      return parsed.origin !== value || parsed.username !== "" || parsed.password !== "";
    } catch {
      return true;
    }
  });
  return invalid.length === 0
    ? pass("upstream allowlist set", `Configured ${values.length} exact upstream origin(s).`)
    : fail(
        "upstream allowlist set",
        "Allowlist must contain exact origins without paths or credentials.",
        "Use values like https://api.openai.com."
      );
}

function checkBooleanEnv(env, key, label) {
  return env[key] === "true"
    ? pass(label, `${key}=true.`)
    : fail(label, `${key} is not true.`, `Set ${key}=true only after verifying it locally.`);
}

function checkRawBodyLogging(env) {
  return env.CONTEXT_DIET_RAW_BODY_LOGGING === "false"
    ? pass("no raw-body logging", "Raw-body logging is explicitly disabled.")
    : fail(
        "no raw-body logging",
        "Raw-body logging is not explicitly disabled.",
        "Set CONTEXT_DIET_RAW_BODY_LOGGING=false."
      );
}

function checkBudget(env) {
  const maxRequests = numberEnv(env, "CONTEXT_DIET_CANARY_MAX_REQUESTS");
  const maxInputTokens = numberEnv(env, "CONTEXT_DIET_CANARY_MAX_INPUT_TOKENS");
  const maxOutputTokens = numberEnv(env, "CONTEXT_DIET_CANARY_MAX_OUTPUT_TOKENS");
  const maxCostUsd = numberEnv(env, "CONTEXT_DIET_CANARY_MAX_COST_USD");
  const valid =
    maxRequests !== null &&
    maxRequests <= 2 &&
    maxInputTokens !== null &&
    maxInputTokens <= 200 &&
    maxOutputTokens !== null &&
    maxOutputTokens <= 50 &&
    maxCostUsd !== null &&
    maxCostUsd <= 0.1;
  return valid
    ? pass(
        "token and cost budget configured",
        "Request, token and cost budgets are within canary limits."
      )
    : fail(
        "token and cost budget configured",
        "Budget values are missing or above the canary limits.",
        "Set max requests <=2, input <=200, output <=50 and cost <=0.10 USD."
      );
}

async function checkNoCredentialsInRepo(cwd) {
  const findings = [];
  await scanPath(cwd, findings);
  return findings.length === 0
    ? pass(
        "no credentials in repo",
        "No credential-like values were found by the preflight scanner."
      )
    : fail(
        "no credentials in repo",
        `Found ${findings.length} credential-like value(s).`,
        "Remove credentials before requesting canary consent."
      );
}

async function scanPath(path, findings) {
  const info = await stat(path);
  if (info.isDirectory()) {
    if (path.includes("/.git") || path.includes("/node_modules") || path.includes("/dist")) {
      return;
    }
    for (const child of await readdir(path)) {
      await scanPath(join(path, child), findings);
    }
    return;
  }
  if (!info.isFile() || info.size > 1_000_000) {
    return;
  }
  const content = await readFile(path, "utf8").catch(() => "");
  for (const pattern of credentialPatterns) {
    const matches = content.match(pattern) ?? [];
    for (const match of matches) {
      if (!isAllowedFakeCredentialMention(match)) {
        findings.push(path);
      }
    }
  }
}

function isAllowedFakeCredentialMention(value) {
  const lowerValue = value.toLowerCase();
  return (
    lowerValue.includes("fake") ||
    lowerValue.includes("test") ||
    lowerValue.includes("example") ||
    lowerValue.includes("do_not") ||
    value.includes("SECRET_VALUE") ||
    value.includes(`OPENAI_API_KEY${"="}`) ||
    value.includes(`ANTHROPIC_API_KEY${"="}`)
  );
}

function numberEnv(env, key) {
  const value = Number(env[key]);
  return Number.isFinite(value) ? value : null;
}

function pass(label, detail) {
  return { detail, label, nextAction: "", status: "PASS" };
}

function fail(label, detail, nextAction) {
  return { detail, label, nextAction, status: "FAIL" };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await runPreflight();
  console.log(renderPreflightReport(report));
  process.exitCode = report.status === "PASS" ? 0 : 1;
}
