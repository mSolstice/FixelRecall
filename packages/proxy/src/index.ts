import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export type ProviderFamily = "openai" | "anthropic";

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
}

export interface FakeGatewayOptions {
  readonly requestTimeoutMs?: number;
  readonly log?: (event: StructuredLogEvent) => void;
}

export interface FakeGateway {
  readonly server: Server;
  readonly close: () => Promise<void>;
}

export const healthRoute: ProxyRoute = {
  method: "GET",
  path: "/health"
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

export function createFakeGateway(options: FakeGatewayOptions = {}): FakeGateway {
  const requestTimeoutMs = options.requestTimeoutMs ?? defaultRequestTimeoutMs;

  const server = createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestId = readRequestId(request);
    let statusCode = 500;
    let provider: ProviderFamily | undefined;

    request.setTimeout(requestTimeoutMs, () => {
      statusCode = 408;
      response.writeHead(statusCode, {
        "content-type": "application/json",
        "x-request-id": requestId
      });
      response.end(JSON.stringify({ error: { type: "timeout", message: "request timed out" } }));
      request.destroy();
    });

    try {
      const routeKey = `${request.method ?? "GET"} ${request.url ?? "/"}`;

      if (routeKey === "GET /health") {
        statusCode = 200;
        writeJson(response, statusCode, requestId, {
          status: "ok",
          gateway: "context-diet-fake",
          mode: "transport-feasibility"
        });
        return;
      }

      if (routeKey === "POST /v1/responses") {
        provider = "openai";
        const body = await readJsonBody(request);
        statusCode = await handleOpenAIResponses(body, response, requestId);
        return;
      }

      if (routeKey === "POST /v1/messages") {
        provider = "anthropic";
        const body = await readJsonBody(request);
        statusCode = await handleAnthropicMessages(body, response, requestId);
        return;
      }

      statusCode = 404;
      writeJson(response, statusCode, requestId, {
        error: { type: "not_found", message: "route is not part of this feasibility spike" }
      });
    } catch {
      if (!response.headersSent) {
        statusCode = 400;
        writeJson(response, statusCode, requestId, {
          error: { type: "bad_request", message: "request could not be parsed" }
        });
      }
    } finally {
      options.log?.({
        authRedacted: true,
        bodyLogged: false,
        durationMs: Date.now() - startedAt,
        event: "request_completed",
        method: request.method ?? "GET",
        provider,
        requestId,
        route: request.url ?? "/",
        statusCode
      });
    }
  });

  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs + 1_000;

  return {
    server,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      })
  };
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
    const statusCode = 200;
    writeStream(response, requestId, [
      'data: {"type":"response.output_text.delta","delta":"Fake OpenAI stream chunk 1"}\n\n',
      'data: {"type":"response.output_text.done","text":"Fake OpenAI stream done"}\n\n',
      "data: [DONE]\n\n"
    ]);
    return statusCode;
  }

  const statusCode = 200;
  writeJson(response, statusCode, requestId, {
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
  return statusCode;
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
    const statusCode = 200;
    writeStream(response, requestId, [
      'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_fake","type":"message","role":"assistant","content":[],"model":"fake-claude","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Fake Anthropic stream chunk 1"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n'
    ]);
    return statusCode;
  }

  const statusCode = 200;
  writeJson(response, statusCode, requestId, {
    id: `msg_${requestId}`,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "Fake Anthropic response" }],
    model: "fake-claude",
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 }
  });
  return statusCode;
}

function readRequestId(request: IncomingMessage): string {
  const header = request.headers["x-request-id"];
  if (typeof header === "string" && header.trim().length > 0) {
    return header;
  }
  return randomUUID();
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error("Expected JSON object body");
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
