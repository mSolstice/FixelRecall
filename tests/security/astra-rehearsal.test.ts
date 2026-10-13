import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("fake-only Astra execution rehearsal", () => {
  it.each(["success", "provider-error", "redirect", "wrong-answer", "expired-evidence"])(
    "safely handles %s and cleans up its servers",
    (scenario) => {
      const output = execFileSync(
        process.execPath,
        ["scripts/rehearse-astra-api-canary.mjs", "--fake", scenario],
        {
          encoding: "utf8",
          timeout: 15000,
          env: { OPENAI_API_KEY: "fake-inherited-key-must-not-appear" }
        }
      );
      const result = JSON.parse(output);
      expect(result.evidenceOrigin).toBe("SYNTHETIC TEST DATA");
      expect(result.mode).toBe("safe");
      expect(result.killSwitchReady).toBe(true);
      expect(result.safeLogs).toBe(true);
      expect(result.rawBodiesPersisted).toBe(false);
      expect(result.authValuesRetained).toBe(false);
      expect(result.realExecutionEnabled).toBe(false);
      expect(result.repeatedStatus).toBe(409);
      expect(result.upstreamCalls).toBe(scenario === "expired-evidence" ? 0 : 1);
      expect(result.exactAnswer).toBe(scenario === "success");
      if (scenario !== "expired-evidence") expect(result.forwardedUnchanged).toBe(true);
      expect(output).not.toContain("fake-inherited-key-must-not-appear");
      expect(output).not.toContain("SYNTHETIC CANARY ONLY");
    }
  );

  it("rejects real mode and caller-supplied endpoints", () => {
    for (const args of [["--run"], ["--fake", "success", "https://api.openai.com"]]) {
      const result = spawnSync(
        process.execPath,
        ["scripts/rehearse-astra-api-canary.mjs", ...args],
        { encoding: "utf8" }
      );
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Real execution is not available");
    }
  });
});
