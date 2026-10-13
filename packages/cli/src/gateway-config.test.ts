import { describe, expect, it } from "vitest";
import { gatewayStartOptions } from "./gateway-config.js";
import { runCliCommand } from "./index.js";

describe("explicit gateway authentication selection", () => {
  it("prepares subscription startup as a read-only dry run", async () => {
    const result = await runCliCommand([
      "start",
      "--codex-auth",
      "subscription",
      "--canary",
      "--dry-run"
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("no service started");
    expect(result.stdout).toContain("https://chatgpt.com");
    expect(result.stdout).toContain("blocked until output limit and budget evidence are verified");
    expect(result.stdout).not.toContain("https://api.openai.com");
  });
  it("keeps API defaults and selects subscription only explicitly", () => {
    expect(gatewayStartOptions([]).upstreams?.openai).toBe("https://api.openai.com/v1/responses");
    const options = gatewayStartOptions(["--codex-auth", "subscription"]);
    expect(options.upstreams?.openai).toBeUndefined();
    expect(options.codexSubscription?.baseUrl).toBe("https://chatgpt.com/backend-api/codex");
    expect(options.upstreams?.anthropic).toBe("https://api.anthropic.com/v1/messages");
    expect(options.upstreamAllowlist).not.toContain("https://api.openai.com");
    expect(options.mode).toBe("safe");
  });
  it("creates bounded Anthropic evidence and rejects malformed selection", () => {
    expect(gatewayStartOptions(["--canary"]).canary).toMatchObject({
      maxCostUsd: 0.1,
      maxOutputTokens: 50
    });
    expect(gatewayStartOptions(["--canary"]).canary?.evidence).toBeUndefined();
    expect(() => gatewayStartOptions(["--codex-auth"])).toThrow();
    expect(() => gatewayStartOptions(["--codex-auth", "guess"])).toThrow();
  });

  it("prepares a Claude-only Safe canary gateway with bounded request evidence", () => {
    const result = gatewayStartOptions(["--canary", "--canary-provider", "anthropic"]);

    expect(result.mode).toBe("safe");
    expect(result.upstreamAllowlist).toEqual(["https://api.anthropic.com"]);
    expect(result.upstreams).toEqual({ anthropic: "https://api.anthropic.com/v1/messages" });
    expect(result.canary).toMatchObject({
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      maxOutputTokens: 32,
      maxCostUsd: 0.1
    });
    expect(result.canary?.evidence).toMatchObject({
      inputTokenUpperBound: 200,
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 5,
      outputLimitVerified: true
    });
    expect(result.canary?.evidence?.requestSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
