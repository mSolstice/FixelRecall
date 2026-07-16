import { describe, expect, it } from "vitest";

import { createFakeGateway, healthRoute, type StructuredLogEvent } from "./index.js";

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
        gateway: "context-diet-fake"
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

async function startGateway(logs: StructuredLogEvent[] = []) {
  const gateway = createFakeGateway({ log: (event) => logs.push(event) });
  await new Promise<void>((resolve) => {
    gateway.server.listen(0, "127.0.0.1", resolve);
  });
  const address = gateway.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: gateway.close
  };
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
