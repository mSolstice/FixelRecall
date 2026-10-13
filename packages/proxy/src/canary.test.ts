import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import { createCanaryAdmission, type CanaryLimits } from "./canary.js";
import { createLocalGateway } from "./index.js";

function fixture(provider: "openai" | "anthropic" = "openai") {
  const body = Buffer.from(
    JSON.stringify({
      model: "fake-model",
      [provider === "openai" ? "max_output_tokens" : "max_tokens"]: 50,
      input: "SYNTHETIC_BODY_CANARY"
    })
  );
  const limits: CanaryLimits = {
    provider,
    model: "fake-model",
    maxRequestBytes: 65536,
    maxOutputTokens: 50,
    maxCostUsd: 0.1,
    evidence: {
      requestSha256: createHash("sha256").update(body).digest("hex"),
      inputTokenUpperBound: 500,
      inputUsdPerMillion: 10,
      outputUsdPerMillion: 50,
      outputLimitVerified: true,
      expiresAtMs: Date.now() + 60000
    }
  };
  return { body, limits };
}

describe("canary admission", () => {
  it.each(["openai", "anthropic"] as const)(
    "reserves exactly one %s request without changing its bytes",
    (provider) => {
      const { body, limits } = fixture(provider);
      const original = Buffer.from(body);
      const admit = createCanaryAdmission(limits);
      admit(provider, "safe", body);
      expect(body).toEqual(original);
      expect(() => admit(provider, "safe", body)).toThrow(/blocked/);
    }
  );

  it.each(["openai", "anthropic"] as const)(
    "rejects absent, invalid and oversized %s output caps",
    (provider) => {
      for (const cap of [undefined, null, "50", -1, 0, 50.5, 1000]) {
        const { limits } = fixture(provider);
        const body = Buffer.from(
          JSON.stringify({
            model: "fake-model",
            [provider === "openai" ? "max_output_tokens" : "max_tokens"]: cap
          })
        );
        expect(() => createCanaryAdmission(limits)(provider, "safe", body)).toThrow(
          expect.objectContaining({ code: "canary_output_limit_required" })
        );
      }
    }
  );

  it("blocks missing, stale, unverified or expensive evidence and changed requests", () => {
    const { body, limits } = fixture();
    const evidence = limits.evidence!;
    for (const candidate of [
      undefined,
      { ...evidence, expiresAtMs: 0 },
      { ...evidence, outputLimitVerified: false },
      { ...evidence, inputTokenUpperBound: 100000 },
      { ...evidence, inputUsdPerMillion: NaN },
      { ...evidence, requestSha256: "different" }
    ]) {
      expect(() =>
        createCanaryAdmission({ ...limits, evidence: candidate })("openai", "safe", body)
      ).toThrow(/blocked/);
    }
  });

  it("blocks wrong provider, model, oversized input and bypass", () => {
    const { body, limits } = fixture();
    expect(() => createCanaryAdmission(limits)("anthropic", "safe", body)).toThrow();
    expect(() => createCanaryAdmission(limits)("openai", "bypass", body)).toThrow();
    expect(() =>
      createCanaryAdmission({ ...limits, model: "different" })("openai", "safe", body)
    ).toThrow();
    expect(() =>
      createCanaryAdmission({ ...limits, maxRequestBytes: 10 })("openai", "safe", body)
    ).toThrow();
    expect(() => createCanaryAdmission({ ...limits, maxCostUsd: 1 })).toThrow();
  });

  it.each(["openai", "anthropic"] as const)(
    "enforces reservations under concurrency and does not refund a %s provider error",
    async (provider) => {
      const { body, limits } = fixture(provider);
      let upstreamCalls = 0;
      const upstream = createServer((_req, res) => {
        upstreamCalls++;
        res.writeHead(500);
        res.end("fake failure");
      });
      const origin = await listen(upstream);
      const gateway = createLocalGateway({
        upstreamAllowlist: [origin],
        upstreams: { [provider]: `${origin}/fake` },
        canary: limits
      });
      const base = await listen(gateway.server);
      const route = provider === "openai" ? "/v1/responses" : "/v1/messages";
      const request = () =>
        fetch(`${base}${route}`, {
          method: "POST",
          headers: { authorization: "Bearer fake", "content-type": "application/json" },
          body
        });
      try {
        const responses = await Promise.all([request(), request()]);
        expect(responses.map((r) => r.status).sort()).toEqual([409, 500]);
        gateway.setKillSwitch(true);
        gateway.setKillSwitch(false);
        expect((await request()).status).toBe(409);
        expect(upstreamCalls).toBe(1);
      } finally {
        await gateway.close();
        await new Promise<void>((resolve) => upstream.close(() => resolve()));
      }
    }
  );
});

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing address");
  return `http://127.0.0.1:${address.port}`;
}
