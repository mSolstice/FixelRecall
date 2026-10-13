import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import { createLocalGateway } from "../packages/proxy/dist/index.js";

const cases = ["success", "provider-error", "redirect", "wrong-answer", "expired-evidence"];
const scenario = process.argv[3];
if (process.argv.length !== 4 || process.argv[2] !== "--fake" || !cases.includes(scenario)) {
  console.error("Fake-only rehearsal. Use --fake success. Real execution is not available.");
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(await rehearse(scenario), null, 2));
  } catch {
    console.error("Local rehearsal failed; no provider credentials were read.");
    process.exitCode = 1;
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function rehearse(selected) {
  const expected = "Fixel Recall real-provider canary passed.";
  const fakeKey = "fake-astra-rehearsal-canary-not-a-credential";
  const body = JSON.stringify({
    model: "gpt-6-astra",
    input: `SYNTHETIC CANARY ONLY. Reply with exactly: ${expected}`,
    max_output_tokens: 50,
    reasoning: { effort: "low" },
    service_tier: "default",
    store: false
  });
  let upstreamCalls = 0;
  let forwardedUnchanged = false;
  const logs = [];
  // No caller-supplied endpoint: every socket is bound to a server created here.
  const upstream = createServer(async (req, res) => {
    upstreamCalls++;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    forwardedUnchanged = Buffer.concat(chunks).toString("utf8") === body;
    if (selected === "redirect") {
      res.writeHead(302, { location: "https://api.openai.com/v1/responses" });
      res.end();
      return;
    }
    res.writeHead(selected === "provider-error" ? 500 : 200, {
      "content-type": "application/json"
    });
    res.end(
      JSON.stringify({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: selected === "wrong-answer" ? "unexpected" : expected }
            ]
          }
        ],
        usage: { input_tokens: 40, output_tokens: 12 }
      })
    );
  });
  let gateway;
  try {
    const origin = await listen(upstream);
    gateway = createLocalGateway({
      mode: "safe",
      upstreams: { openai: `${origin}/v1/responses` },
      upstreamAllowlist: [origin],
      requestTimeoutMs: 2000,
      log: (event) => logs.push(event),
      canary: {
        provider: "openai",
        model: "gpt-6-astra",
        maxRequestBytes: 1024,
        maxOutputTokens: 50,
        maxCostUsd: 0.1,
        evidence: {
          requestSha256: createHash("sha256").update(body).digest("hex"),
          // Synthetic admission evidence ONLY, never a real token measurement.
          inputTokenUpperBound: 200,
          inputUsdPerMillion: 12.5,
          outputUsdPerMillion: 50,
          outputLimitVerified: true,
          expiresAtMs: selected === "expired-evidence" ? 0 : Date.now() + 60000
        }
      }
    });
    const base = await listen(gateway.server);
    const request = (path, options = {}) =>
      fetch(`${base}${path}`, {
        ...options,
        redirect: "error",
        signal: globalThis.AbortSignal.timeout(4000)
      });
    const post = () =>
      request("/v1/responses", {
        method: "POST",
        body,
        headers: { authorization: `Bearer ${fakeKey}`, "content-type": "application/json" }
      });
    await (await request("/runtime/kill-switch", { method: "POST" })).json();
    const killSwitchReady = gateway.status().killSwitchActive;
    await (await post()).arrayBuffer();
    if (!killSwitchReady || upstreamCalls !== 0) throw new Error("Kill switch failure");
    await (await request("/runtime/resume", { method: "POST" })).json();
    const response = await post();
    const data = await response.json();
    const exactAnswer =
      response.ok &&
      data.status === "completed" &&
      data.output?.[0]?.content?.[0]?.text === expected;
    // Deliberate local-only second attempt proves that a reservation is not refunded.
    const repeated = await post();
    await repeated.arrayBuffer();
    const status = gateway.status();
    const safeLogs =
      !JSON.stringify(logs).includes(fakeKey) &&
      !JSON.stringify(logs).includes("SYNTHETIC CANARY ONLY") &&
      !JSON.stringify(logs).includes(body);
    return {
      evidenceOrigin: "SYNTHETIC TEST DATA",
      scenario: selected,
      mode: status.mode,
      killSwitchReady,
      status: response.status,
      exactAnswer,
      upstreamCalls,
      forwardedUnchanged,
      repeatedStatus: repeated.status,
      safeLogs,
      rawBodiesPersisted: status.metrics.rawBodiesPersisted,
      authValuesRetained: status.metrics.authValuesRetained,
      syntheticGenerationReserveUsd: 0.005,
      realExecutionEnabled: false
    };
  } finally {
    if (gateway) await gateway.close();
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  }
}
