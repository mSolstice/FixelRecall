import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createFakeGateway,
  createLocalGateway,
  healthRoute,
  type ProviderFamily,
  type StructuredLogEvent
} from "./index.js";

const rawBodyPersistenceStatuses = [400, 401, 403, 404, 409, 413, 415, 422, 429] as const;
const rawBodyPersistenceProviders = [
  { provider: "openai", route: "/v1/responses" },
  { provider: "anthropic", route: "/v1/messages" }
] as const satisfies readonly { readonly provider: ProviderFamily; readonly route: string }[];

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
        gateway: "fixel-recall-local",
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
        gateway: "fixel-recall-local",
        mode: "safe"
      });

      const status = await fetch(`${baseUrl}/status`);
      await expect(status.json()).resolves.toMatchObject({
        gateway: "fixel-recall-local",
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
        headers: { authorization: "Bearer fake-key", "content-type": "application/json" },
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

  it("requires exact upstream origin allowlist matches", async () => {
    const capturedHeaders: Record<string, string> = {};
    const upstream = await startHeaderCaptureUpstream(capturedHeaders);
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
        headers: {
          authorization: "Bearer fake-prefix-allowlist-leak-key",
          "content-type": "application/json"
        },
        body: JSON.stringify({ model: "fake", input: "prefix allowlist test" })
      });
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        error: { type: "upstream_not_allowed", provider: "openai" }
      });
      expect(capturedHeaders.authorization).toBeUndefined();
    } finally {
      await gateway.close();
      await upstream.close();
    }
  });

  it("sets outbound content length to the actual forwarded bytes", async () => {
    const captured: { declared?: string; body: Buffer } = { body: Buffer.alloc(0) };
    const upstream = await startBodyCaptureUpstream(captured);
    const gateway = await startProductionGateway([], {
      openai: `${upstream.baseUrl}/v1/responses`
    });
    try {
      const body = Buffer.from(JSON.stringify({ model: "synthetic", input: "length canary" }));
      const response = await fetch(`${gateway.baseUrl}/v1/responses`, {
        method: "POST",
        headers: { authorization: "Bearer fake", "content-type": "application/json" },
        body
      });
      expect(response.status).toBe(200);
      expect(captured.declared).toBe(String(captured.body.length));
      expect(captured.body.equals(body)).toBe(true);
    } finally {
      await gateway.close();
      await upstream.close();
    }
  });

  it.each(["timeout", "throw", "invalid-json", "mutation"])(
    "preserves original bytes on transformation %s",
    async (failure) => {
      const captured: { declared?: string; body: Buffer } = { body: Buffer.alloc(0) };
      const logs: StructuredLogEvent[] = [];
      const upstream = await startBodyCaptureUpstream(captured);
      const gateway = createLocalGateway({
        log: (event) => logs.push(event),
        upstreams: { openai: upstream.baseUrl },
        upstreamAllowlist: [upstream.baseUrl],
        transformationTimeoutMs: 5,
        transformRequest: async (copy) => {
          if (failure === "timeout") return new Promise<Buffer>(() => {});
          if (failure === "invalid-json") return Buffer.from("{");
          if (failure === "mutation") copy.fill(0);
          throw new Error("synthetic failure");
        }
      });
      await listen(gateway.server);
      const address = gateway.server.address();
      if (!address || typeof address === "string") throw new Error("missing address");
      try {
        const body = Buffer.from('{ "model": "synthetic", "input": "unchanged" }');
        const response = await fetch(`http://127.0.0.1:${address.port}/v1/responses`, {
          method: "POST",
          headers: { authorization: "Bearer fake", "content-type": "application/json" },
          body
        });
        await response.text();
        expect(response.status).toBe(200);
        expect(captured.body.equals(body)).toBe(true);
        expect(logs[0]?.transformation).toMatchObject({
          outcome: "original",
          strategy: "native",
          reasonCodes: ["transformation_failed_keep_native"],
          bytesBefore: body.length,
          bytesAfter: body.length
        });
      } finally {
        await gateway.close();
        await upstream.close();
      }
    }
  );

  it("blocks upstream redirects without forwarding credentials to the redirected host", async () => {
    const redirectedHeaders: Record<string, string> = {};
    const redirected = await startHeaderCaptureUpstream(redirectedHeaders);
    const redirecting = await startRedirectUpstream(`${redirected.baseUrl}/capture`);
    const logs: StructuredLogEvent[] = [];
    const { baseUrl, close } = await startProductionGateway(logs, {
      openai: `${redirecting.baseUrl}/v1/responses`
    });
    try {
      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          authorization: "Bearer fake-redirect-leak-key",
          "content-type": "application/json",
          "x-request-id": "redirect-block-test"
        },
        body: JSON.stringify({ model: "fake", input: "REDIRECT_BODY_CANARY_DO_NOT_LOG" })
      });
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toMatchObject({
        error: { type: "upstream_redirect_blocked", provider: "openai", upstreamStatus: 302 }
      });
      expect(redirectedHeaders.authorization).toBeUndefined();
      const serialisedLogs = JSON.stringify(logs);
      expect(serialisedLogs).not.toContain("fake-redirect-leak-key");
      expect(serialisedLogs).not.toContain("REDIRECT_BODY_CANARY_DO_NOT_LOG");
    } finally {
      await close();
      await redirecting.close();
      await redirected.close();
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

  it("forwards Anthropic bearer auth for subscription-style routing without logging it", async () => {
    const logs: StructuredLogEvent[] = [];
    const capturedHeaders: Record<string, string> = {};
    const anthropic = await startHeaderCaptureUpstream(capturedHeaders);
    const { baseUrl, close } = await startProductionGateway(logs, {
      anthropic: `${anthropic.baseUrl}/v1/messages`
    });
    try {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "anthropic-version": "2023-06-01",
          authorization: "Bearer fake-anthropic-subscription-token",
          "content-type": "application/json",
          "x-request-id": "anthropic-subscription-auth"
        },
        body: JSON.stringify({
          model: "fake",
          messages: [{ role: "user", content: "BODY_CANARY_SUBSCRIPTION_AUTH_DO_NOT_LOG" }]
        })
      });

      expect(response.status).toBe(200);
      expect(capturedHeaders.authorization).toBe("Bearer fake-anthropic-subscription-token");
      expect(capturedHeaders["x-api-key"]).toBeUndefined();

      const serialisedLogs = JSON.stringify(logs);
      expect(serialisedLogs).not.toContain("fake-anthropic-subscription-token");
      expect(serialisedLogs).not.toContain("BODY_CANARY_SUBSCRIPTION_AUTH_DO_NOT_LOG");
    } finally {
      await close();
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
        headers: { authorization: "Bearer fake-key", "content-type": "application/json" },
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
        headers: { authorization: "Bearer fake-key", "content-type": "application/json" },
        body: JSON.stringify({ input: "x".repeat(100) })
      });
      expect(tooLarge.status).toBe(413);

      const providerError = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: { authorization: "Bearer fake-key", "content-type": "application/json" },
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

describe("raw 4xx request body persistence", () => {
  it("does not persist raw request bodies for local gateway 4xx statuses", async () => {
    const evidenceRoot = join(tmpdir(), `fixel-recall-raw-4xx-evidence-${Date.now()}`);
    await mkdir(evidenceRoot, { recursive: true });
    const allCanaries: string[] = [];

    for (const status of rawBodyPersistenceStatuses) {
      for (const providerCase of rawBodyPersistenceProviders) {
        const canary = makeRawBodyCanary(status, providerCase.provider);
        allCanaries.push(canary);
        const logs: StructuredLogEvent[] = [];
        const evidence = await exercise4xxCase({
          canary,
          evidenceRoot,
          logs,
          provider: providerCase.provider,
          route: providerCase.route,
          status
        });

        const serialisedEvidence = JSON.stringify(evidence.safeSnapshot);
        expect(evidence.responseStatus).toBe(status);
        expect(serialisedEvidence).not.toContain(canary);
        expect(serialisedEvidence).not.toContain(evidence.rawBody);
        expect(JSON.stringify(logs)).not.toContain(canary);
        expect(JSON.stringify(logs)).not.toContain(evidence.rawBody);
        expect(
          logs.find((log) => log.route === providerCase.route && log.statusCode === status)
        ).toMatchObject({
          authRedacted: true,
          bodyLogged: false,
          route: providerCase.route,
          statusCode: status
        });
      }
    }

    const leaks = await scanForCanaries({
      canaries: allCanaries,
      roots: [process.cwd(), evidenceRoot]
    });
    expect(leaks).toEqual([]);
  }, 30_000);
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

async function startStatusUpstream(statusCode: number) {
  const server = createServer(async (request, response) => {
    let byteCount = 0;
    for await (const chunk of request) {
      byteCount += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }
    response.writeHead(statusCode, {
      "content-type": "application/json",
      "x-upstream-byte-count": String(byteCount)
    });
    response.end(
      JSON.stringify({
        error: {
          type: `synthetic_${statusCode}`,
          message: "synthetic provider error without request body"
        }
      })
    );
  });
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

async function startHeaderCaptureUpstream(capturedHeaders: Record<string, string>) {
  const server = createServer(async (request, response) => {
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        capturedHeaders[name] = value;
      }
    }
    await drainRequest(request);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

async function startBodyCaptureUpstream(captured: { declared?: string; body: Buffer }) {
  const server = createServer(async (request, response) => {
    captured.declared =
      typeof request.headers["content-length"] === "string"
        ? request.headers["content-length"]
        : undefined;
    captured.body = await readRequestBytes(request);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Expected TCP server address");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  };
}

async function readRequestBytes(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function startRedirectUpstream(location: string) {
  const server = createServer(async (request, response) => {
    await drainRequest(request);
    response.writeHead(302, {
      location
    });
    response.end();
  });
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
}

async function drainRequest(request: IncomingMessage): Promise<void> {
  for await (const chunk of request) {
    void chunk;
  }
}

async function exercise4xxCase(input: {
  readonly status: (typeof rawBodyPersistenceStatuses)[number];
  readonly provider: ProviderFamily;
  readonly route: string;
  readonly canary: string;
  readonly logs: StructuredLogEvent[];
  readonly evidenceRoot: string;
}): Promise<{
  readonly rawBody: string;
  readonly responseStatus: number;
  readonly safeSnapshot: Record<string, unknown>;
}> {
  const rawBody = JSON.stringify({
    synthetic: true,
    canary_sentence: input.canary,
    payload: `synthetic body for ${input.provider} ${input.status}`
  });
  const trigger = await create4xxTrigger(input.status, input.provider);
  const gateway = createLocalGateway({
    log: (event) => input.logs.push(event),
    maxRequestBytes: input.status === 413 ? 24 : 1_000_000,
    upstreamAllowlist: trigger.allowlist,
    upstreams: trigger.upstreams
  });
  await listen(gateway.server);
  const address = gateway.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  const headers = headersFor4xx(input.status, input.provider);
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${input.route}`, {
      method: "POST",
      headers,
      body: input.status === 400 ? `{"canary_sentence":"${input.canary}",` : rawBody
    });
    const responseBody = (await response.json()) as Record<string, unknown>;
    const status = await (await fetch(`http://127.0.0.1:${address.port}/status`)).json();
    const latestLog = input.logs.at(-1);
    const safeSnapshot = {
      auditEvents: [
        {
          bodyIncluded: false,
          errorCode: readErrorType(responseBody),
          provider: input.provider,
          requestId: latestLog?.requestId,
          status: response.status
        }
      ],
      generatedArtifacts: [],
      logs: input.logs,
      metrics: status,
      response: {
        errorCode: readErrorType(responseBody),
        requestId: response.headers.get("x-request-id"),
        status: response.status
      },
      snapshots: [
        {
          byteCount: latestLog?.requestBytes ?? 0,
          route: input.route,
          status: response.status
        }
      ],
      tempFiles: [],
      traces: [
        {
          durationMs: latestLog?.durationMs ?? 0,
          errorCode: readErrorType(responseBody),
          route: input.route,
          status: response.status
        }
      ],
      vault: []
    };
    await writeFile(
      join(input.evidenceRoot, `${input.provider}-${input.status}.json`),
      JSON.stringify(safeSnapshot, null, 2)
    );
    return { rawBody, responseStatus: response.status, safeSnapshot };
  } finally {
    await gateway.close();
    await trigger.close();
  }
}

async function create4xxTrigger(
  status: (typeof rawBodyPersistenceStatuses)[number],
  provider: ProviderFamily
): Promise<{
  readonly upstreams: Partial<Record<ProviderFamily, string>>;
  readonly allowlist: readonly string[];
  readonly close: () => Promise<void>;
}> {
  if (status === 403 || status === 404 || status === 409 || status === 422 || status === 429) {
    const upstream = await startStatusUpstream(status);
    return {
      allowlist: [upstream.baseUrl],
      close: upstream.close,
      upstreams: {
        [provider]: `${upstream.baseUrl}${provider === "openai" ? "/v1/responses" : "/v1/messages"}`
      }
    };
  }
  return {
    allowlist: ["http://127.0.0.1:1"],
    close: async () => undefined,
    upstreams: { [provider]: "http://127.0.0.1:1/synthetic" }
  };
}

function headersFor4xx(status: number, provider: ProviderFamily): Record<string, string> {
  const auth =
    provider === "openai"
      ? { authorization: `Bearer fake-${provider}-4xx-key` }
      : { "x-api-key": `fake-${provider}-4xx-key`, "anthropic-version": "2023-06-01" };
  if (status === 401) {
    return { "content-type": "application/json", "x-request-id": `raw-4xx-${provider}-${status}` };
  }
  if (status === 415) {
    return {
      ...auth,
      "content-type": "text/plain",
      "x-request-id": `raw-4xx-${provider}-${status}`
    };
  }
  return {
    ...auth,
    "content-type": "application/json",
    "x-request-id": `raw-4xx-${provider}-${status}`
  };
}

function makeRawBodyCanary(status: number, provider: ProviderFamily): string {
  return [
    "Synthetic raw 4xx body canary sentence for",
    provider,
    "status",
    String(status),
    randomSuffix()
  ].join(" ");
}

function randomSuffix(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readErrorType(responseBody: Record<string, unknown>): string {
  const error = responseBody["error"];
  if (error !== null && typeof error === "object" && !Array.isArray(error)) {
    const type = (error as { readonly type?: unknown }).type;
    return typeof type === "string" ? type : "unknown_error";
  }
  return "unknown_error";
}

async function scanForCanaries(input: {
  readonly canaries: readonly string[];
  readonly roots: readonly string[];
}): Promise<readonly string[]> {
  const leaks: string[] = [];
  for (const root of input.roots) {
    await scanPath(root, input.canaries, leaks);
  }
  return leaks;
}

async function scanPath(path: string, canaries: readonly string[], leaks: string[]): Promise<void> {
  const info = await stat(path);
  if (info.isDirectory()) {
    if (isIgnoredCanaryScanDirectory(path)) {
      return;
    }
    const children = await readdir(path);
    for (const child of children) {
      await scanPath(join(path, child), canaries, leaks);
    }
    return;
  }
  if (!info.isFile() || info.size > 2_000_000) {
    return;
  }
  const content = await readFile(path, "utf8").catch(() => "");
  for (const canary of canaries) {
    if (content.includes(canary)) {
      leaks.push(`${path}:${canary}`);
    }
  }
}

function isIgnoredCanaryScanDirectory(path: string): boolean {
  return ["/.git", "/.pnpm-store", "/node_modules", "/dist", "/coverage", "/artifacts"].some(
    (segment) => path.includes(segment)
  );
}

async function postStream(url: string): Promise<string> {
  const isOpenAI = url.endsWith("/v1/responses");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...(isOpenAI ? { authorization: "Bearer fake-key" } : { "x-api-key": "fake-key" }),
      "content-type": "application/json"
    },
    body: JSON.stringify({ stream: true })
  });
  expect(response.status).toBe(200);
  return response.text();
}

function postProviderError(url: string): Promise<Response> {
  const isOpenAI = url.endsWith("/v1/responses");
  return fetch(url, {
    method: "POST",
    headers: {
      ...(isOpenAI ? { authorization: "Bearer fake-key" } : { "x-api-key": "fake-key" }),
      "content-type": "application/json"
    },
    body: JSON.stringify({ trigger_provider_error: true })
  });
}
