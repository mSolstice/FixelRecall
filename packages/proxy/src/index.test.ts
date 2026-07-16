import { describe, expect, it } from "vitest";

import {
  createFakeGateway,
  createLocalGateway,
  healthRoute,
  type ProviderFamily,
  type StructuredLogEvent
} from "./index.js";

describe("healthRoute", () => {
  it("declares the local health endpoint", () => {
    expect(healthRoute).toEqual({ method: "GET", path: "/health" });
  });
});

describe("createFakeGateway", () => {
  it("serves health checks", async () => {
    const { baseUrl, close } = await startGateway();
    try {
      const response = await fetch(`${baseUrl}/health`);
      await expect(response.json()).resolves.toMatchObject({
        status: "ok",
        gateway: "context-diet-local",
        mode: "safe"
      });
    } finally {
      await close();
    }
  });

  it("serves an OpenAI Responses-compatible fake route", async () => {
    const logs: StructuredLogEvent[] = [];
    const { baseUrl, close } = await startGateway(logs);
    try {
      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          authorization: "Bearer fake-openai-header-value",
          "content-type": "application/json",
          "x-request-id": "request-openai-test"
        },
        body: JSON.stringify({
          model: "fake-openai-model",
          input: "BODY_CANARY_OPENAI_DO_NOT_LOG"
        })
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        object: "response"
      });
      expect(JSON.stringify(logs)).not.toContain("fake-openai-header-value");
      expect(JSON.stringify(logs)).not.toContain("BODY_CANARY_OPENAI_DO_NOT_LOG");
      expect(logs.at(-1)).toMatchObject({
        authRedacted: true,
        bodyLogged: false,
        mode: "safe",
        provider: "openai",
        requestId: "request-openai-test",
        statusCode: 200
      });
    } finally {
      await close();
    }
  });

  it("serves an Anthropic Messages-compatible fake route", async () => {
    const logs: StructuredLogEvent[] = [];
    const { baseUrl, close } = await startGateway(logs);
    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "x-api-key": "fake-anthropic-header-value",
          "x-request-id": "request-anthropic-test"
        },
        body: JSON.stringify({
          model: "fake-claude-model",
          messages: [{ role: "user", content: "BODY_CANARY_ANTHROPIC_DO_NOT_LOG" }]
        })
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        type: "message",
        role: "assistant"
      });
      expect(JSON.stringify(logs)).not.toContain("fake-anthropic-header-value");
      expect(JSON.stringify(logs)).not.toContain("BODY_CANARY_ANTHROPIC_DO_NOT_LOG");
      expect(logs.at(-1)).toMatchObject({
        authRedacted: true,
        bodyLogged: false,
        mode: "safe",
        provider: "anthropic",
        requestId: "request-anthropic-test",
        statusCode: 200
      });
    } finally {
      await close();
    }
  });

  it("streams fake responses for both providers", async () => {
    const { baseUrl, close } = await startGateway();
    try {
      const openAI = await postStream(`${baseUrl}/v1/responses`);
      expect(openAI).toContain("response.output_text.delta");
      expect(openAI).toContain("[DONE]");

      const anthropic = await postStream(`${baseUrl}/v1/messages`);
      expect(anthropic).toContain("message_start");
      expect(anthropic).toContain("content_block_delta");
    } finally {
      await close();
    }
  });

  it("returns provider errors from both fake upstreams", async () => {
    const { baseUrl, close } = await startGateway();
    try {
      const openAI = await postProviderError(`${baseUrl}/v1/responses`);
      expect(openAI.status).toBe(502);
      await expect(openAI.json()).resolves.toMatchObject({
        error: { type: "fake_openai_upstream_error" }
      });

      const anthropic = await postProviderError(`${baseUrl}/v1/messages`);
      expect(anthropic.status).toBe(502);
      await expect(anthropic.json()).resolves.toMatchObject({
        error: { type: "fake_anthropic_upstream_error" }
      });
    } finally {
      await close();
    }
  });
});

describe("createLocalGateway", () => {
  it("defaults to loopback and Safe mode with privacy-safe status", async () => {
    const { baseUrl, close } = await startProductionGateway();
    try {
      const health = await fetch(`${baseUrl}/health`);
      await expect(health.json()).resolves.toMatchObject({
        status: "ok",
        gateway: "context-diet-local",
        mode: "safe"
      });

      const status = await fetch(`${baseUrl}/status`);
      await expect(status.json()).resolves.toMatchObject({
        gateway: "context-diet-local",
        bindHost: "127.0.0.1",
        mode: "safe",
        killSwitchActive: false,
        metrics: {
          authValuesRetained: false,
          rawBodiesPersisted: false
        }
      });
    } finally {
      await close();
    }
  });

  it("requires explicit upstream allowlist", async () => {
    const upstream = await startFakeUpstream("openai");
    const gateway = createLocalGateway({
      upstreams: { openai: `${upstream.baseUrl}/v1/responses` },
      upstreamAllowlist: ["http://127.0.0.1:1"]
    });
    await listen(gateway.server);
    const address = gateway.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected TCP server address");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "fake", input: "unknown shape passes through" })
      });
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        error: { type: "upstream_not_allowed", provider: "openai" }
      });
    } finally {
      await gateway.close();
      await upstream.close();
    }
  });

  it("streams OpenAI and Anthropic upstream responses without logging secrets or bodies", async () => {
    const logs: StructuredLogEvent[] = [];
    const openai = await startFakeUpstream("openai");
    const anthropic = await startFakeUpstream("anthropic");
    const { baseUrl, close } = await startProductionGateway(logs, {
      openai: `${openai.baseUrl}/v1/responses`,
      anthropic: `${anthropic.baseUrl}/v1/messages`
    });
    try {
      const openaiResponse = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          authorization: "Bearer fake-production-openai-key",
          "content-type": "application/json",
          "x-request-id": "prod-openai"
        },
        body: JSON.stringify({
          model: "fake",
          stream: true,
          input: "BODY_CANARY_OPENAI_DO_NOT_LOG"
        })
      });
      const openaiStream = await openaiResponse.text();
      expect(openaiStream).toContain("response.output_text.delta");

      const anthropicResponse = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "anthropic-beta": "fake-beta",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "x-api-key": "fake-production-anthropic-key",
          "x-request-id": "prod-anthropic"
        },
        body: JSON.stringify({
          model: "fake",
          stream: true,
          messages: [{ role: "user", content: "BODY_CANARY_ANTHROPIC_DO_NOT_LOG" }]
        })
      });
      const anthropicStream = await anthropicResponse.text();
      expect(anthropicStream).toContain("content_block_delta");

      const serialisedLogs = JSON.stringify(logs);
      expect(serialisedLogs).not.toContain("fake-production-openai-key");
      expect(serialisedLogs).not.toContain("fake-production-anthropic-key");
      expect(serialisedLogs).not.toContain("BODY_CANARY_OPENAI_DO_NOT_LOG");
      expect(serialisedLogs).not.toContain("BODY_CANARY_ANTHROPIC_DO_NOT_LOG");
      expect(logs.filter((log) => log.responseStreamed)).toHaveLength(2);
    } finally {
      await close();
      await openai.close();
      await anthropic.close();
    }
  });

  it("supports runtime bypass and kill switch", async () => {
    const { baseUrl, close } = await startProductionGateway();
    try {
      await fetch(`${baseUrl}/runtime/bypass`, { method: "POST" });
      await expect((await fetch(`${baseUrl}/status`)).json()).resolves.toMatchObject({
        mode: "bypass"
      });
      await fetch(`${baseUrl}/runtime/safe`, { method: "POST" });
      await expect((await fetch(`${baseUrl}/status`)).json()).resolves.toMatchObject({
        mode: "safe"
      });
      await fetch(`${baseUrl}/runtime/kill-switch`, { method: "POST" });
      const blocked = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "fake", input: "blocked" })
      });
      expect(blocked.status).toBe(503);
      await fetch(`${baseUrl}/runtime/resume`, { method: "POST" });
      await expect((await fetch(`${baseUrl}/status`)).json()).resolves.toMatchObject({
        killSwitchActive: false
      });
    } finally {
      await close();
    }
  });

  it("enforces request-size limits and returns clear provider errors", async () => {
    const openai = await startFakeUpstream("openai");
    const { baseUrl, close } = await startProductionGateway(
      [],
      {
        openai: `${openai.baseUrl}/v1/responses`
      },
      32
    );
    try {
      const tooLarge = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: "x".repeat(100) })
      });
      expect(tooLarge.status).toBe(413);

      const providerError = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger_provider_error: true })
      });
      expect(providerError.status).toBe(502);
      await expect(providerError.json()).resolves.toMatchObject({
        error: { type: "provider_error", provider: "openai", upstreamStatus: 502 }
      });
    } finally {
      await close();
      await openai.close();
    }
  });
});

async function startGateway(logs: StructuredLogEvent[] = []) {
  const gateway = createFakeGateway({ log: (event) => logs.push(event) });
  await listen(gateway.server);
  const address = gateway.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: gateway.close
  };
}

async function startProductionGateway(
  logs: StructuredLogEvent[] = [],
  upstreams: Partial<Record<ProviderFamily, string>> = {},
  maxRequestBytes = 1_000_000
) {
  const allowlist = Object.values(upstreams).map((url) => new URL(url).origin);
  const gateway = createLocalGateway({
    log: (event) => logs.push(event),
    maxRequestBytes,
    upstreamAllowlist: allowlist,
    upstreams
  });
  await listen(gateway.server);
  const address = gateway.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: gateway.close
  };
}

async function startFakeUpstream(provider: ProviderFamily) {
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const local = createFakeGateway();
    local.server.listen(0, "127.0.0.1", () => resolve(local.server));
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    provider
  };
}

function listen(server: import("node:http").Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
}

async function postStream(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stream: true })
  });
  expect(response.status).toBe(200);
  return response.text();
}

function postProviderError(url: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ trigger_provider_error: true })
  });
}
