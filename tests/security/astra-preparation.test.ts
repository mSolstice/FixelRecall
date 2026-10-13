import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Astra API canary preparation", () => {
  it("produces a fixed capped plan without exposing fake credentials", () => {
    const output = execFileSync(process.execPath, ["scripts/prepare-astra-api-canary.mjs"], {
      encoding: "utf8",
      env: { OPENAI_API_KEY: "fake-preparation-canary-never-print" }
    });
    const plan = JSON.parse(output);
    expect(plan.mode).toBe("safe");
    expect(plan.maximumTotalUsd).toBe(0.1);
    expect(plan.maximumGenerationAttempts).toBe(1);
    expect(plan.request.max_output_tokens).toBe(50);
    expect(plan.request.store).toBe(false);
    expect(plan.request.service_tier).toBe("default");
    expect(plan.providerTrafficSent).toBe(false);
    expect(output).not.toContain("fake-preparation-canary-never-print");
  });

  it("rejects execution flags rather than treating preparation as consent", () => {
    const result = spawnSync(process.execPath, ["scripts/prepare-astra-api-canary.mjs", "--run"], {
      encoding: "utf8"
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no request was sent");
    expect(result.stdout).toBe("");
  });
});
