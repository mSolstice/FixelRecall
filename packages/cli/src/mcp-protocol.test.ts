import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createContextCatalogue,
  createLocalRetrievalMcpServer,
  createRetrievalService
} from "@fixel-recall/retrieval-mcp";
import {
  createContextBlockIdentity,
  createLocalContextVault,
  createProjectIdentity,
  createSessionIdentity,
  createVaultNamespace,
  type IdentityClock,
  type RandomSource
} from "@fixel-recall/vault";

import { respondToMcpLine } from "./index.js";

const clock: IdentityClock = { now: () => new Date("2026-07-16T00:00:00.000Z") };
const bytes = (value: number): RandomSource => ({
  randomBytes: (size) => new Uint8Array(size).fill(value)
});

let root: string;
let server: ReturnType<typeof createLocalRetrievalMcpServer>;
let block: { projectId: string; sessionId: string; blockId: string };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "fixel-recall-mcp-"));
  const project = createProjectIdentity({
    localIdentitySecret: "fake-local-identity-secret-for-mcp-tests-0001",
    projectPath: "/Users/example/work/mcp-project"
  });
  const session = createSessionIdentity({
    clock,
    projectId: project.projectId,
    randomSource: bytes(31),
    ttlMs: 60_000
  });
  const namespace = createVaultNamespace(project.projectId, session.sessionId);
  const identity = createContextBlockIdentity(namespace, { randomSource: bytes(32) });
  block = {
    blockId: identity.blockId,
    projectId: identity.projectId,
    sessionId: identity.sessionId
  };
  const vault = createLocalContextVault({ clock, maxBlockBytes: 2_000, rootDir: root });
  await vault.storeBlock({
    authorisedOriginalContent: "line one\nline two: exact value CTX-123\nline three",
    expiresAt: new Date("2026-07-16T00:10:00.000Z"),
    identity,
    sourceCategory: "documentation"
  });
  server = createLocalRetrievalMcpServer(
    createRetrievalService({
      authority: namespace,
      maxLineSpan: 5,
      maxReturnChars: 80,
      maxSearchChars: 500,
      vault
    }),
    createContextCatalogue({
      vault,
      authority: namespace,
      references: [{ blockId: identity.blockId }]
    })
  );
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

const ask = async (message: unknown): Promise<Record<string, unknown> | null> => {
  const reply = await respondToMcpLine(server, JSON.stringify(message));
  return reply === null ? null : (JSON.parse(reply) as Record<string, unknown>);
};

describe("retrieval MCP server protocol (JSON-RPC 2.0 over stdio)", () => {
  it("answers initialize with its server info and tool capability", async () => {
    const reply = await ask({ id: 1, jsonrpc: "2.0", method: "initialize", params: {} });
    expect(reply).toMatchObject({
      id: 1,
      jsonrpc: "2.0",
      result: { capabilities: { tools: {} }, serverInfo: { name: "fixel-recall-retrieval" } }
    });
  });

  it("lists exact retrieval and discovery tools", async () => {
    const reply = await ask({ id: 2, jsonrpc: "2.0", method: "tools/list" });
    const tools = (reply?.["result"] as { tools: { name: string }[] }).tools;
    expect(tools.map((tool) => tool.name)).toEqual(["get_exact_context", "find_context_cells"]);
  });

  it("returns the exact stored text for an authorised block (real vault round trip)", async () => {
    const reply = await ask({
      id: 3,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {
          block_id: block.blockId,
          max_chars: 80,
          project_id: block.projectId,
          query: "CTX-123",
          session_id: block.sessionId
        },
        name: "get_exact_context"
      }
    });
    const result = reply?.["result"] as { content: { text: string }[] };
    expect(result.content[0]?.text).toContain("CTX-123");
  });

  it("returns nothing for a block that is not in the vault", async () => {
    const reply = await ask({
      id: 4,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: {
          block_id: "ctx_blk_does_not_exist",
          max_chars: 80,
          project_id: block.projectId,
          session_id: block.sessionId
        },
        name: "get_exact_context"
      }
    });
    const result = reply?.["result"] as { content: { text: string }[] };
    expect(result.content[0]?.text).not.toContain("CTX-123");
  });

  it("answers ping", async () => {
    expect(await ask({ id: 5, jsonrpc: "2.0", method: "ping" })).toMatchObject({
      id: 5,
      result: {}
    });
  });

  it("reports an unknown method as a top-level JSON-RPC error, not inside result", async () => {
    const reply = await ask({ id: 6, jsonrpc: "2.0", method: "no/such/method" });
    expect(reply).toMatchObject({ error: { code: -32601 }, id: 6 });
    expect(reply).not.toHaveProperty("result");
  });

  it("never replies to notifications", async () => {
    expect(await ask({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect(await ask({ jsonrpc: "2.0", method: "notifications/cancelled" })).toBeNull();
    expect(await ask({ jsonrpc: "2.0", method: "no/such/method" })).toBeNull();
  });

  it("reports bad JSON and non-requests with a null id", async () => {
    expect(JSON.parse((await respondToMcpLine(server, "not json")) ?? "")).toMatchObject({
      error: { code: -32700 },
      id: null
    });
    expect(await ask({ jsonrpc: "2.0" })).toMatchObject({ error: { code: -32600 }, id: null });
  });

  it("ignores blank lines", async () => {
    expect(await respondToMcpLine(server, "   ")).toBeNull();
  });
});
