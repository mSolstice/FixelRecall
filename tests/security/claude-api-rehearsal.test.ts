import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("fake-only Claude API rehearsal", () => {
  it.each(["success", "provider-error", "wrong-answer", "expired-evidence"])(
    "keeps %s local and bounded",
    (scenario) => {
      const output = execFileSync(
        process.execPath,
        ["scripts/rehearse-claude-api-canary.mjs", "--fake", scenario],
        {
          encoding: "utf8",
          timeout: 15000,
          env: { ANTHROPIC_API_KEY: "fake-inherited-claude-key" }
        }
      );
      const result = JSON.parse(output);
      expect(result.evidenceOrigin).toBe("SYNTHETIC TEST DATA");
      expect(result.mode).toBe("safe");
      expect(result.killSwitchReady).toBe(true);
      expect(result.rawBodiesPersisted).toBe(false);
      expect(result.authValuesRetained).toBe(false);
      expect(result.safeLogs).toBe(true);
      expect(result.repeatedStatus).toBe(409);
      expect(result.realExecutionEnabled).toBe(false);
      expect(result.upstreamCalls).toBe(scenario === "expired-evidence" ? 0 : 1);
      expect(result.exactAnswer).toBe(scenario === "success");
      expect(output).not.toContain("fake-inherited-claude-key");
    }
  );
});
