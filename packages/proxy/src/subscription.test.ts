import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalGateway, type LocalGatewayOptions, type StructuredLogEvent } from "./index.js";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing local address");
  cleanup.push(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return `http://127.0.0.1:${address.port}`;
}

async function fixture(options: LocalGatewayOptions = {}, redirect = false) {
  const received: {
    path: string;
    body: string;
    account?: string;
    auth?: string;
    cookie?: string;
  }[] = [];
  const upstream = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += String(chunk);
    received.push({
      path: req.url ?? "",
      body,
      account: req.headers["chatgpt-account-id"] as string | undefined,
      auth: req.headers.authorization,
      cookie: req.headers.cookie
    });
    if (redirect) {
      res.writeHead(302, { location: "https://must-not-follow.example.invalid/" });
      res.end();
    } else if (req.method === "GET") {
      res.setHeader("content-type", "application/json");
      res.end('{"models":[]}');
    } else {
      res.setHeader("content-type", "text/event-stream");
      res.write('data: {"type":"response.output_text.delta","delta":"fake"}\n\n');
      res.end('data: {"type":"response.completed"}\n\n');
    }
  });
  const origin = await listen(upstream);
  const logs: StructuredLogEvent[] = [];
  const gateway = createLocalGateway({
    codexSubscription: { baseUrl: `${origin}/backend-api/codex` },
    upstreams: { openai: `${origin}/v1/responses`, anthropic: `${origin}/v1/messages` },
    upstreamAllowlist: [origin],
    log: (event) => logs.push(event),
    ...options
  });
  return { base: await listen(gateway.server), gateway, received, logs };
}
const headers = {
  authorization: "Bearer fake-subscription-canary",
  "chatgpt-account-id": "fake-account-canary",
  "content-type": "application/json",
  cookie: "fake-cookie-canary"
};

describe("explicit Codex subscription transport", () => {
  it("blocks uncapped subscription inference under the canary guard", async () => {
    const { base, received, logs } = await fixture({
      canary: {
        provider: "openai",
        model: "gpt-6-astra",
        maxRequestBytes: 65536,
        maxOutputTokens: 50,
        maxCostUsd: 0.1
      }
    });
    const response = await fetch(`${base}/backend-api/codex/responses`, {
      method: "POST",
      headers,
      body: '{"model":"gpt-6-astra","input":"CANARY_BODY_BLOCKED"}'
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { type: "canary_output_limit_required" }
    });
    expect(received).toHaveLength(0);
    expect(JSON.stringify(logs)).not.toContain("CANARY_BODY_BLOCKED");
    expect((await fetch(`${base}/backend-api/codex/models`, { headers })).status).toBe(200);
    expect((await fetch(`${base}/backend-api/codex/models`, { headers })).status).toBe(409);
  });

  it("kill switch aborts an already-streaming subscription response", async () => {
    let disconnected!: () => void;
    const disconnect = new Promise<void>((resolve) => {
      disconnected = resolve;
    });
    const upstream = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write("data: fake-start\n\n");
      res.on("close", disconnected);
    });
    const origin = await listen(upstream);
    const gateway = createLocalGateway({
      codexSubscription: { baseUrl: `${origin}/backend-api/codex` },
      upstreamAllowlist: [origin],
      requestTimeoutMs: 1000
    });
    const base = await listen(gateway.server);
    const response = await fetch(`${base}/backend-api/codex/responses`, {
      method: "POST",
      headers,
      body: "{}"
    });
    const reading = response.text();
    const assertion = expect(reading).rejects.toThrow();
    gateway.setKillSwitch(true);
    await assertion;
    await disconnect;
  });

  it("times out subscription discovery and reports only a safe error", async () => {
    const upstream = createServer(() => {});
    const origin = await listen(upstream);
    const gateway = createLocalGateway({
      codexSubscription: { baseUrl: `${origin}/backend-api/codex` },
      upstreamAllowlist: [origin],
      requestTimeoutMs: 30
    });
    const base = await listen(gateway.server);
    const response = await fetch(`${base}/backend-api/codex/models`, { headers });
    expect(response.status).toBe(408);
    expect(await response.json()).toMatchObject({ error: { type: "timeout_or_cancelled" } });
  });

  it("preserves subscription body, account header, tool state and streaming order", async () => {
    const { base, received, logs } = await fixture();
    const body = JSON.stringify({
      model: "fake-astra",
      input: [{ type: "function_call", call_id: "fake-call", name: "tool", arguments: "{}" }],
      unknown: "BODY_SUBSCRIPTION_CANARY",
      stream: true
    });
    const response = await fetch(`${base}/backend-api/codex/responses`, {
      method: "POST",
      headers,
      body
    });
    expect(response.status).toBe(200);
    const stream = await response.text();
    expect(stream.indexOf("output_text.delta")).toBeLessThan(stream.indexOf("response.completed"));
    expect(received).toEqual([
      {
        path: "/backend-api/codex/responses",
        body,
        account: headers["chatgpt-account-id"],
        auth: headers.authorization,
        cookie: undefined
      }
    ]);
    for (const canary of [...Object.values(headers), "BODY_SUBSCRIPTION_CANARY"])
      expect(JSON.stringify(logs)).not.toContain(canary);
  });

  it("forwards only the supported models query without logging query or auth", async () => {
    const { base, received, logs } = await fixture();
    const response = await fetch(`${base}/backend-api/codex/models?client_version=0.154.0`, {
      headers
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: [] });
    expect(received[0]?.path).toBe("/backend-api/codex/models?client_version=0.154.0");
    expect(received[0]?.account).toBe("fake-account-canary");
    expect(JSON.stringify(logs)).not.toContain("client_version");
  });

  it.each([
    "?token=fake-query-secret",
    "?client_version=a&client_version=b",
    "?client_version=../bad"
  ])("rejects unsupported models query %s", async (query) => {
    const { base, received, logs } = await fixture();
    expect((await fetch(`${base}/backend-api/codex/models${query}`, { headers })).status).toBe(400);
    expect(received).toHaveLength(0);
    expect(JSON.stringify(logs)).not.toContain("fake-query-secret");
  });

  it("does not expose subscription routes unless explicitly enabled", async () => {
    const { base, received } = await fixture({ codexSubscription: undefined });
    expect((await fetch(`${base}/backend-api/codex/models`, { headers })).status).toBe(404);
    expect(received).toHaveLength(0);
  });

  it("requires allowlisted upstreams and authentication", async () => {
    const denied = await fixture({ upstreamAllowlist: [] });
    expect((await fetch(`${denied.base}/backend-api/codex/models`, { headers })).status).toBe(502);
    expect(denied.received).toHaveLength(0);
    const missing = await fixture();
    expect((await fetch(`${missing.base}/backend-api/codex/models`)).status).toBe(401);
    expect(missing.received).toHaveLength(0);
  });

  it("blocks models and inference while killed", async () => {
    const { base, gateway, received } = await fixture();
    gateway.setKillSwitch(true);
    expect((await fetch(`${base}/backend-api/codex/models`, { headers })).status).toBe(503);
    expect(
      (await fetch(`${base}/backend-api/codex/responses`, { method: "POST", headers, body: "{}" }))
        .status
    ).toBe(503);
    expect(received).toHaveLength(0);
  });

  it("does not follow subscription redirects", async () => {
    const { base } = await fixture({}, true);
    const response = await fetch(`${base}/backend-api/codex/models`, { headers });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { type: "upstream_redirect_blocked" } });
  });

  it.each(["/v1/responses", "/v1/messages"])(
    "never forwards ChatGPT account headers to %s",
    async (route) => {
      const { base, received } = await fixture();
      expect(
        (
          await fetch(`${base}${route}`, {
            method: "POST",
            headers,
            body: '{"unknown":"unchanged"}'
          })
        ).status
      ).toBe(200);
      expect(received[0]?.account).toBeUndefined();
      expect(received[0]?.body).toBe('{"unknown":"unchanged"}');
    }
  );

  it.each([
    "https://attacker.invalid/backend-api/codex",
    "https://chatgpt.com.evil.invalid/backend-api/codex",
    "https://chatgpt.com/backend-api/codex?token=fake",
    "http://chatgpt.com/backend-api/codex",
    "https://user:fake@chatgpt.com/backend-api/codex"
  ])("rejects unsafe subscription base URL", (baseUrl) => {
    expect(() => createLocalGateway({ codexSubscription: { baseUrl } })).toThrow();
  });
});
