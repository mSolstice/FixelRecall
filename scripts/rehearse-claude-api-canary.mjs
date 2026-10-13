import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { createLocalGateway } from "../packages/proxy/dist/index.js";

const allowed = ["success", "provider-error", "wrong-answer", "expired-evidence"];
const scenario = process.argv[3];
if (process.argv.length !== 4 || process.argv[2] !== "--fake" || !allowed.includes(scenario)) {
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
  const expected = "Fixel Recall Claude canary passed.";
  const fakeKey = "fake-claude-rehearsal-key-never-print";
  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 32,
    messages: [{ role: "user", content: "SYNTHETIC CANARY ONLY. Reply with exactly: " + expected }],
    stream: false
  });
  let upstreamCalls = 0;
  let forwardedUnchanged = false;
  const logs = [];
  const upstream = createServer(async (req, res) => {
    upstreamCalls++;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    forwardedUnchanged = Buffer.concat(chunks).toString("utf8") === body;
    res.writeHead(selected === "provider-error" ? 500 : 200, {
      "content-type": "application/json"
    });
    res.end(
      JSON.stringify({
        id: "msg_synthetic_canary",
        type: "message",
        role: "assistant",
        model: "claude-haiku-4-5-20251001",
        content: [{ type: "text", text: selected === "wrong-answer" ? "unexpected" : expected }],
        stop_reason: "end_turn",
        usage: { input_tokens: 40, output_tokens: 10 }
      })
    );
  });
  let gateway;
  try {
    const origin = await listen(upstream);
    gateway = createLocalGateway({
      mode: "safe",
      upstreams: { anthropic: `${origin}/v1/messages` },
      upstreamAllowlist: [origin],
      requestTimeoutMs: 2000,
      log: (event) => logs.push(event),
      canary: {
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        maxRequestBytes: 2048,
        maxOutputTokens: 32,
        maxCostUsd: 0.1,
        evidence: {
          requestSha256: (await import("node:crypto"))
            .createHash("sha256")
            .update(body)
            .digest("hex"),
          inputTokenUpperBound: 200,
          inputUsdPerMillion: 1,
          outputUsdPerMillion: 5,
          outputLimitVerified: true,
          expiresAtMs: selected === "expired-evidence" ? 0 : Date.now() + 60000
        }
      }
    });
    const base = await listen(gateway.server);
    const request = (options = {}) =>
      fetch(`${base}/v1/messages`, {
        ...options,
        redirect: "error",
        signal: globalThis.AbortSignal.timeout(4000)
      });
    const post = () =>
      request({
        method: "POST",
        body,
        headers: {
          authorization: `Bearer ${fakeKey}`,
          "x-api-key": fakeKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        }
      });
    const killSwitch = await fetch(`${base}/runtime/kill-switch`, { method: "POST" });
    await killSwitch.arrayBuffer();
    const killSwitchReady = gateway.status().killSwitchActive;
    const blocked = await post();
    await blocked.arrayBuffer();
    await (await fetch(`${base}/runtime/resume`, { method: "POST" })).arrayBuffer();
    const response = await post();
    const data = await response.json();
    const exactAnswer = response.ok && data.content?.[0]?.text === expected;
    const repeated = await post();
    await repeated.arrayBuffer();
    const status = gateway.status();
    const serialisedLogs = JSON.stringify(logs);
    return {
      evidenceOrigin: "SYNTHETIC TEST DATA",
      scenario,
      mode: status.mode,
      killSwitchReady,
      status: response.status,
      exactAnswer,
      upstreamCalls,
      forwardedUnchanged,
      repeatedStatus: repeated.status,
      safeLogs: !serialisedLogs.includes(fakeKey) && !serialisedLogs.includes(body),
      rawBodiesPersisted: status.metrics.rawBodiesPersisted,
      authValuesRetained: status.metrics.authValuesRetained,
      realExecutionEnabled: false
    };
  } finally {
    if (gateway) await gateway.close();
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  }
}
