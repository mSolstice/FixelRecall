import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Claude API canary preparation", () => {
  it("prints a capped plan without reading or printing credentials", () => {
    const output = execFileSync(process.execPath, ["scripts/prepare-claude-api-canary.mjs"], {
      encoding: "utf8",
      env: { ANTHROPIC_API_KEY: "fake-claude-key-never-print" }
    });
    const plan = JSON.parse(output);
    expect(plan.mode).toBe("safe");
    expect(plan.maximumTotalUsd).toBe(0.1);
    expect(plan.maximumOutputTokens).toBe(32);
    expect(plan.estimatedGenerationUpperBoundUsd).toBeLessThan(0.1);
    expect(plan.providerTrafficSent).toBe(false);
    expect(output).not.toContain("fake-claude-key-never-print");
  });

  it("rejects execution flags", () => {
    const result = spawnSync(process.execPath, ["scripts/prepare-claude-api-canary.mjs", "--run"], {
      encoding: "utf8"
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("no request was sent");
  });
});
