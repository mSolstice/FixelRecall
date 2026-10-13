import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  codexSubscriptionPaths,
  resolveCodexSubscriptionRoute,
  validateCodexSubscriptionBaseUrl
} from "@fixel-recall/providers-openai";
import { CanaryAdmissionError, createCanaryAdmission, type CanaryLimits } from "./canary.js";

export { createCanaryAdmission, CanaryAdmissionError, type CanaryLimits } from "./canary.js";

export type ProviderFamily = "openai" | "anthropic";
export type GatewayMode = "safe" | "bypass";

export interface ProxyRoute {
  readonly method: "GET" | "POST";
  readonly path: string;
}

export interface StructuredLogEvent {
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly provider?: ProviderFamily;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly authRedacted: true;
  readonly bodyLogged: false;
  readonly event: "request_completed";
  readonly mode: GatewayMode;
  readonly killSwitchActive: boolean;
  readonly requestBytes: number;
  readonly responseStreamed: boolean;
}

export interface GatewayMetrics {
  readonly startedAtMs: number;
  readonly totalRequests: number;
  readonly providerRequests: Readonly<Record<ProviderFamily, number>>;
  readonly rejectedRequests: number;
  readonly streamedResponses: number;
  readonly authValuesRetained: false;
  readonly rawBodiesPersisted: false;
}

export interface LocalGatewayOptions {
  readonly requestTimeoutMs?: number;
  readonly maxRequestBytes?: number;
  readonly bindHost?: "127.0.0.1" | "::1";
  readonly mode?: GatewayMode;
  readonly killSwitchActive?: boolean;
  readonly upstreams?: Partial<Record<ProviderFamily, string>>;
  readonly upstreamAllowlist?: readonly string[];
  readonly codexSubscription?: { readonly baseUrl: string };
  readonly canary?: CanaryLimits;
  readonly log?: (event: StructuredLogEvent) => void;
}

export interface LocalGateway {
  readonly server: Server;
  readonly bindHost: "127.0.0.1" | "::1";
  readonly close: () => Promise<void>;
  readonly setBypass: (enabled: boolean) => void;
  readonly setKillSwitch: (enabled: boolean) => void;
  readonly status: () => GatewayStatus;
}

export interface GatewayStatus {
  readonly gateway: "fixel-recall-local";
  readonly mode: GatewayMode;
  readonly killSwitchActive: boolean;
  readonly bindHost: "127.0.0.1" | "::1";
  readonly routes: readonly string[];
  readonly upstreamAllowlist: readonly string[];
  readonly metrics: GatewayMetrics;
}

export interface FakeGatewayOptions {
  readonly requestTimeoutMs?: number;
  readonly log?: (event: StructuredLogEvent) => void;
}

export type FakeGateway = LocalGateway;

export const healthRoute: ProxyRoute = {
  method: "GET",
  path: "/health"
};

export const statusRoute: ProxyRoute = {
  method: "GET",
  path: "/status"
};

export const openAIResponsesRoute: ProxyRoute = {
  method: "POST",
  path: "/v1/responses"
};

export const anthropicMessagesRoute: ProxyRoute = {
  method: "POST",
  path: "/v1/messages"
};

const defaultRequestTimeoutMs = 5_000;
const defaultMaxRequestBytes = 1_000_000;
const providerRoutes = ["/v1/responses", "/v1/messages"] as const;

export function createLocalGateway(options: LocalGatewayOptions = {}): LocalGateway {
  const requestTimeoutMs = options.requestTimeoutMs ?? defaultRequestTimeoutMs;
  const maxRequestBytes = options.maxRequestBytes ?? defaultMaxRequestBytes;
  const bindHost = options.bindHost ?? "127.0.0.1";
  let mode = options.mode ?? "safe";
  let killSwitchActive = options.killSwitchActive ?? false;
  const upstreams = options.upstreams ?? {};
  const upstreamAllowlist = options.upstreamAllowlist ?? [];
  const metrics = createMetrics();
  const subscriptionBase =
    options.codexSubscription === undefined
      ? undefined
      : validateCodexSubscriptionBaseUrl(options.codexSubscription.baseUrl);
  const admitCanary =
    options.canary === undefined ? undefined : createCanaryAdmission(options.canary);
  const activeRequests = new Set<AbortController>();
  let canaryModelLookups = 0;

  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestId = readRequestId(request);
    const route = normaliseRoute(request.url ?? "/");
    const method = request.method ?? "GET";
    let statusCode = 500;
    let provider: ProviderFamily | undefined;
    let requestBytes = 0;
    let responseStreamed = false;

    const abortController = new AbortController();
    activeRequests.add(abortController);
    const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs);
    request.on("aborted", () => abortController.abort());
    response.on("close", () => {
      if (!response.writableEnded) abortController.abort();
    });

    try {
      const controlResult = await maybeHandleControlRoute({
        method,
        route,
        requestId,
        response,
        status: () => gateway.status(),
        setBypass: (enabled) => {
          mode = enabled ? "bypass" : "safe";
        },
        setKillSwitch: (enabled) => {
          killSwitchActive = enabled;
          if (enabled) for (const controller of activeRequests) controller.abort();
        }
      });
      if (controlResult !== null) {
        statusCode = controlResult;
        return;
      }

      const subscriptionRoute =
        subscriptionBase === undefined
          ? undefined
          : resolveCodexSubscriptionRoute(method, request.url ?? "/", subscriptionBase);
      if (subscriptionRoute === undefined && (method !== "POST" || !isProviderRoute(route))) {
        statusCode = 404;
        writeJson(response, statusCode, requestId, {
          error: { type: "not_found", message: "route is not available on the local gateway" }
        });
        return;
      }

      provider =
        subscriptionRoute !== undefined || route === openAIResponsesRoute.path
          ? "openai"
          : "anthropic";
      metrics.providerRequests[provider] += 1;

      if (!hasProviderAuth(request, provider)) {
        statusCode = 401;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: { type: "authentication_required", message: "provider authentication is required" }
        });
        return;
      }

      if (method === "POST" && !hasJsonContentType(request)) {
        statusCode = 415;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: {
            type: "unsupported_media_type",
            message: "content-type must be application/json"
          }
        });
        return;
      }

      if (killSwitchActive) {
        statusCode = 503;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: { type: "kill_switch_active", message: "Fixel Recall gateway is disabled" }
        });
        return;
      }

      const upstreamUrl = subscriptionRoute?.upstreamUrl ?? upstreams[provider];
      if (upstreamUrl === undefined || !isAllowedUpstream(upstreamUrl, upstreamAllowlist)) {
        statusCode = 502;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: {
            type: "upstream_not_allowed",
            provider,
            message: "No allowlisted upstream is configured for this provider"
          }
        });
        return;
      }

      const body = await readLimitedBody(request, method === "GET" ? 0 : maxRequestBytes);
      requestBytes = body.length;
      if (method === "POST") {
        validateJsonBody(body);
        admitCanary?.(provider, mode, body);
      } else if (admitCanary !== undefined) {
        if (mode !== "safe" || canaryModelLookups >= 1) {
          throw new CanaryAdmissionError("canary_models_limit");
        }
        canaryModelLookups += 1;
      }
      const upstreamResponse = await fetch(upstreamUrl, {
        method,
        headers: forwardHeaders(request, provider, subscriptionRoute !== undefined),
        body: method === "POST" ? body : undefined,
        redirect: "manual",
        signal: abortController.signal
      });

      statusCode = upstreamResponse.status;
      if (isRedirectStatus(upstreamResponse.status)) {
        statusCode = 502;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: {
            type: "upstream_redirect_blocked",
            provider,
            upstreamStatus: upstreamResponse.status,
            message: "Provider upstream redirect was blocked by allowlist policy"
          }
        });
        return;
      }
      if (!upstreamResponse.ok) {
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: {
            type: "provider_error",
            provider,
            upstreamStatus: upstreamResponse.status,
            message: "Provider upstream returned an error"
          }
        });
        return;
      }

      responseStreamed = true;
      metrics.streamedResponses += 1;
      await streamUpstreamResponse(upstreamResponse, response, requestId);
    } catch (error) {
      if (!response.headersSent) {
        const gatewayError = classifyGatewayError(error);
        statusCode = gatewayError.statusCode;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: { type: gatewayError.type, message: gatewayError.message }
        });
      } else {
        response.destroy();
      }
    } finally {
      clearTimeout(timeout);
      activeRequests.delete(abortController);
      metrics.totalRequests += 1;
      options.log?.({
        authRedacted: true,
        bodyLogged: false,
        durationMs: Date.now() - startedAt,
        event: "request_completed",
        killSwitchActive,
        method,
        mode,
        provider,
        requestBytes,
        requestId,
        responseStreamed,
        route,
        statusCode
      });
    }
  });

  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs + 1_000;

  const gateway: LocalGateway = {
    server,
    bindHost,
    close: () =>
      new Promise((resolve, reject) => {
        for (const controller of activeRequests) controller.abort();
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
    setBypass: (enabled) => {
      mode = enabled ? "bypass" : "safe";
    },
    setKillSwitch: (enabled) => {
      killSwitchActive = enabled;
      if (enabled) for (const controller of activeRequests) controller.abort();
    },
    status: () => ({
      bindHost,
      gateway: "fixel-recall-local",
      killSwitchActive,
      metrics: {
        ...metrics,
        providerRequests: { ...metrics.providerRequests }
      },
      mode,
      routes: [
        healthRoute.path,
        statusRoute.path,
        openAIResponsesRoute.path,
        anthropicMessagesRoute.path,
        ...(subscriptionBase === undefined ? [] : Object.values(codexSubscriptionPaths))
      ],
      upstreamAllowlist
    })
  };

  return gateway;
}

export function createFakeGateway(options: FakeGatewayOptions = {}): FakeGateway {
  const requestTimeoutMs = options.requestTimeoutMs ?? defaultRequestTimeoutMs;
  const bindHost = "127.0.0.1" as const;
  let mode: GatewayMode = "safe";
  let killSwitchActive = false;
  const metrics = createMetrics();
  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestId = readRequestId(request);
    const route = normaliseRoute(request.url ?? "/");
    const method = request.method ?? "GET";
    let statusCode = 500;
    let provider: ProviderFamily | undefined;
    let requestBytes = 0;
    let responseStreamed = false;

    try {
      const controlResult = await maybeHandleControlRoute({
        method,
        requestId,
        response,
        route,
        setBypass: (enabled) => {
          mode = enabled ? "bypass" : "safe";
        },
        setKillSwitch: (enabled) => {
          killSwitchActive = enabled;
        },
        status: () => gateway.status()
      });
      if (controlResult !== null) {
        statusCode = controlResult;
        return;
      }
      if (method !== "POST" || !isProviderRoute(route)) {
        statusCode = 404;
        writeJson(response, statusCode, requestId, {
          error: { type: "not_found", message: "fake gateway route not found" }
        });
        return;
      }
      if (killSwitchActive) {
        statusCode = 503;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: { type: "kill_switch_active", message: "Fixel Recall gateway is disabled" }
        });
        return;
      }
      provider = route === openAIResponsesRoute.path ? "openai" : "anthropic";
      metrics.providerRequests[provider] += 1;
      if (!hasProviderAuth(request, provider)) {
        statusCode = 401;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: { type: "authentication_required", message: "provider authentication is required" }
        });
        return;
      }
      if (!hasJsonContentType(request)) {
        statusCode = 415;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: {
            type: "unsupported_media_type",
            message: "content-type must be application/json"
          }
        });
        return;
      }
      const bodyBuffer = await readLimitedBody(request, defaultMaxRequestBytes);
      requestBytes = bodyBuffer.length;
      const parsed = parseJsonObject(bodyBuffer);
      statusCode =
        provider === "openai"
          ? await handleOpenAIResponses(parsed, response, requestId)
          : await handleAnthropicMessages(parsed, response, requestId);
      responseStreamed = parsed["stream"] === true;
      if (responseStreamed) {
        metrics.streamedResponses += 1;
      }
    } catch (error) {
      if (!response.headersSent) {
        const gatewayError = classifyGatewayError(error);
        statusCode = gatewayError.statusCode;
        metrics.rejectedRequests += 1;
        writeJson(response, statusCode, requestId, {
          error: { type: gatewayError.type, message: gatewayError.message }
        });
      }
    } finally {
      metrics.totalRequests += 1;
      options.log?.({
        authRedacted: true,
        bodyLogged: false,
        durationMs: Date.now() - startedAt,
        event: "request_completed",
        killSwitchActive,
        method,
        mode,
        provider,
        requestBytes,
        requestId,
        responseStreamed,
        route,
        statusCode
      });
    }
  });

  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs + 1_000;

  const gateway: LocalGateway = {
    bindHost,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    server,
    setBypass: (enabled) => {
      mode = enabled ? "bypass" : "safe";
    },
    setKillSwitch: (enabled) => {
      killSwitchActive = enabled;
    },
    status: () => ({
      bindHost,
      gateway: "fixel-recall-local",
      killSwitchActive,
      metrics: { ...metrics, providerRequests: { ...metrics.providerRequests } },
      mode,
      routes: [
        healthRoute.path,
        statusRoute.path,
        openAIResponsesRoute.path,
        anthropicMessagesRoute.path
      ],
      upstreamAllowlist: ["fake-provider"]
    })
  };

  return gateway;
}

function createMetrics(): {
  startedAtMs: number;
  totalRequests: number;
  providerRequests: Record<ProviderFamily, number>;
  rejectedRequests: number;
  streamedResponses: number;
  authValuesRetained: false;
  rawBodiesPersisted: false;
} {
  return {
    authValuesRetained: false,
    providerRequests: { anthropic: 0, openai: 0 },
    rawBodiesPersisted: false,
    rejectedRequests: 0,
    startedAtMs: Date.now(),
    streamedResponses: 0,
    totalRequests: 0
  };
}

async function maybeHandleControlRoute(input: {
  readonly method: string;
  readonly route: string;
  readonly requestId: string;
  readonly response: ServerResponse;
  readonly status: () => GatewayStatus;
  readonly setBypass: (enabled: boolean) => void;
  readonly setKillSwitch: (enabled: boolean) => void;
}): Promise<number | null> {
  if (input.method === "GET" && input.route === healthRoute.path) {
    writeJson(input.response, 200, input.requestId, {
      status: "ok",
      gateway: "fixel-recall-local",
      mode: input.status().mode
    });
    return 200;
  }
  if (input.method === "GET" && input.route === statusRoute.path) {
    writeJson(
      input.response,
      200,
      input.requestId,
      input.status() as unknown as Record<string, unknown>
    );
    return 200;
  }
  if (input.method === "POST" && input.route === "/runtime/bypass") {
    input.setBypass(true);
    writeJson(input.response, 200, input.requestId, { mode: "bypass" });
    return 200;
  }
  if (input.method === "POST" && input.route === "/runtime/safe") {
    input.setBypass(false);
    writeJson(input.response, 200, input.requestId, { mode: "safe" });
    return 200;
  }
  if (input.method === "POST" && input.route === "/runtime/kill-switch") {
    input.setKillSwitch(true);
    writeJson(input.response, 200, input.requestId, { killSwitchActive: true });
    return 200;
  }
  if (input.method === "POST" && input.route === "/runtime/resume") {
    input.setKillSwitch(false);
    writeJson(input.response, 200, input.requestId, { killSwitchActive: false });
    return 200;
  }
  return null;
}

async function handleOpenAIResponses(
  body: Record<string, unknown>,
  response: ServerResponse,
  requestId: string
): Promise<number> {
  if (body["trigger_provider_error"] === true) {
    const statusCode = 502;
    writeJson(response, statusCode, requestId, {
      error: { type: "fake_openai_upstream_error", message: "fake OpenAI upstream error" }
    });
    return statusCode;
  }

  if (body["stream"] === true) {
    writeStream(response, requestId, [
      'data: {"type":"response.output_text.delta","delta":"Fake OpenAI stream chunk 1"}\n\n',
      'data: {"type":"response.output_text.done","text":"Fake OpenAI stream done"}\n\n',
      "data: [DONE]\n\n"
    ]);
    return 200;
  }

  writeJson(response, 200, requestId, {
    id: `resp_${requestId}`,
    object: "response",
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Fake OpenAI response" }]
      }
    ]
  });
  return 200;
}

async function handleAnthropicMessages(
  body: Record<string, unknown>,
  response: ServerResponse,
  requestId: string
): Promise<number> {
  if (body["trigger_provider_error"] === true) {
    const statusCode = 502;
    writeJson(response, statusCode, requestId, {
      error: { type: "fake_anthropic_upstream_error", message: "fake Anthropic upstream error" }
    });
    return statusCode;
  }

  if (body["stream"] === true) {
    writeStream(response, requestId, [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_fake","type":"message","role":"assistant","content":[],"model":"fake-claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Fake Anthropic stream chunk 1"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]);
    return 200;
  }

  writeJson(response, 200, requestId, {
    id: `msg_${requestId}`,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "Fake Anthropic response" }],
    model: "fake-claude",
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 }
  });
  return 200;
}

function readRequestId(request: IncomingMessage): string {
  const header = request.headers["x-request-id"];
  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }
  return randomUUID();
}

async function readLimitedBody(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new GatewayRequestError(
        413,
        "request_too_large",
        "request exceeds configured size limit"
      );
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function parseJsonObject(body: Buffer): Record<string, unknown> {
  if (body.length === 0) {
    return {};
  }
  const parsed: unknown = JSON.parse(body.toString("utf8"));
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("Expected JSON object body");
}

async function streamUpstreamResponse(
  upstreamResponse: Response,
  response: ServerResponse,
  requestId: string
): Promise<void> {
  response.writeHead(upstreamResponse.status, {
    "cache-control": upstreamResponse.headers.get("cache-control") ?? "no-cache",
    "content-type": upstreamResponse.headers.get("content-type") ?? "application/json",
    "x-request-id": requestId
  });
  if (upstreamResponse.body === null) {
    response.end();
    return;
  }
  for await (const chunk of upstreamResponse.body) {
    response.write(chunk);
  }
  response.end();
}

function forwardHeaders(
  request: IncomingMessage,
  provider: ProviderFamily,
  subscription = false
): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  copyHeader(request, headers, "x-request-id");
  if (provider === "openai") {
    copyHeader(request, headers, "authorization");
    copyHeader(request, headers, "openai-beta");
    if (subscription) {
      copyHeader(request, headers, "chatgpt-account-id");
      copyHeader(request, headers, "originator");
      copyHeader(request, headers, "version");
    }
  } else {
    copyHeader(request, headers, "authorization");
    copyHeader(request, headers, "x-api-key");
    copyHeader(request, headers, "anthropic-version");
    copyHeader(request, headers, "anthropic-beta");
  }
  return headers;
}

function copyHeader(request: IncomingMessage, headers: Headers, name: string): void {
  const value = request.headers[name];
  if (typeof value === "string") {
    headers.set(name, value);
  }
}

function hasProviderAuth(request: IncomingMessage, provider: ProviderFamily): boolean {
  const primary =
    provider === "openai" ? request.headers["authorization"] : request.headers["x-api-key"];
  const secondary = provider === "anthropic" ? request.headers["authorization"] : undefined;
  return (
    (typeof primary === "string" && primary.trim().length > 0) ||
    (typeof secondary === "string" && secondary.trim().length > 0)
  );
}

function hasJsonContentType(request: IncomingMessage): boolean {
  const header = request.headers["content-type"];
  return typeof header === "string" && header.toLowerCase().startsWith("application/json");
}

function validateJsonBody(body: Buffer): void {
  try {
    parseJsonObject(body);
  } catch {
    throw new GatewayRequestError(400, "bad_request", "request body must be a JSON object");
  }
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  requestId: string,
  payload: Record<string, unknown>
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "x-request-id": requestId
  });
  response.end(JSON.stringify(payload));
}

function writeStream(response: ServerResponse, requestId: string, chunks: readonly string[]): void {
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": "text/event-stream",
    "x-request-id": requestId
  });

  for (const chunk of chunks) {
    response.write(chunk);
  }
  response.end();
}

function isProviderRoute(route: string): route is (typeof providerRoutes)[number] {
  return providerRoutes.includes(route as (typeof providerRoutes)[number]);
}

function normaliseRoute(url: string): string {
  return url.split("?")[0] ?? "/";
}

function isAllowedUpstream(upstreamUrl: string, allowlist: readonly string[]): boolean {
  const upstreamOrigin = parseOrigin(upstreamUrl);
  if (upstreamOrigin === null) {
    return false;
  }
  return allowlist.some((allowed) => parseOrigin(allowed) === upstreamOrigin);
}

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isRedirectStatus(statusCode: number): boolean {
  return statusCode >= 300 && statusCode < 400;
}

function classifyGatewayError(error: unknown): {
  readonly statusCode: number;
  readonly type: string;
  readonly message: string;
} {
  if (error instanceof GatewayRequestError) {
    return { statusCode: error.statusCode, type: error.type, message: error.message };
  }
  if (error instanceof CanaryAdmissionError) {
    return { statusCode: 409, type: error.code, message: error.message };
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      statusCode: 408,
      type: "timeout_or_cancelled",
      message: "request timed out or was cancelled"
    };
  }
  return { statusCode: 400, type: "bad_request", message: "request could not be handled" };
}

class GatewayRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly type: string,
    message: string
  ) {
    super(message);
  }
}
