import { describe, expect, it } from "vitest";

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createContextBlockIdentity,
  createLocalContextVault,
  createProjectIdentity,
  createSessionIdentity,
  createVaultNamespace,
  type IdentityClock,
  type RandomSource
} from "@fixel-recall/vault";

import {
  createLocalRetrievalMcpServer,
  createRetrievalService,
  describeExactContextTool,
  type GetExactContextInput,
  type RetrievalLogEvent
} from "./index.js";

const localSecret = "fake-local-identity-secret-for-retrieval-tests-0001";
const projectPath = "/Users/example/work/retrieval-project";
const fixedClock: IdentityClock = {
  now: () => new Date("2026-07-16T00:00:00.000Z")
};

function bytes(value: number): RandomSource {
  return {
    randomBytes: (size) => new Uint8Array(size).fill(value)
  };
}

async function fixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "fixel-recall-retrieval-test-"));
  const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
  const session = createSessionIdentity({
    projectId: project.projectId,
    ttlMs: 60_000,
    clock: fixedClock,
    randomSource: bytes(21)
  });
  const namespace = createVaultNamespace(project.projectId, session.sessionId);
  const block = createContextBlockIdentity(namespace, { randomSource: bytes(22) });
  const logs: RetrievalLogEvent[] = [];
  const vault = createLocalContextVault({
    rootDir,
    maxBlockBytes: 2_000,
    clock: fixedClock
  });
  const service = createRetrievalService({
    vault,
    maxSearchChars: 500,
    maxReturnChars: 80,
    maxLineSpan: 5,
    logger: { info: (event) => logs.push(event) }
  });
  await vault.storeBlock({
    identity: block,
    sourceCategory: "documentation",
    authorisedOriginalContent: [
      "line one: setup",
      "line two: target needle with exact value CTX-123",
      "line three: more context",
      "line four: final note"
    ].join("\n"),
    expiresAt: new Date("2026-07-16T00:10:00.000Z")
  });
  return { block, logs, namespace, project, rootDir, service, session, vault };
}

function inputFrom(
  block: { projectId: string; sessionId: string; blockId: string },
  override: Partial<GetExactContextInput> = {}
): GetExactContextInput {
  return {
    project_id: block.projectId,
    session_id: block.sessionId,
    block_id: block.blockId,
    query: "needle",
    max_chars: 80,
    ...override
  };
}

function blockFile(
  rootDir: string,
  block: { projectId: string; sessionId: string; blockId: string }
) {
  return path.join(
    rootDir,
    "projects",
    block.projectId,
    "sessions",
    block.sessionId,
    "blocks",
    block.blockId,
    "block.json"
  );
}

describe("describeExactContextTool", () => {
  it("describes the architecture-approved tool name and schema", () => {
    expect(describeExactContextTool()).toMatchObject({
      name: "get_exact_context",
      inputSchema: {
        required: ["project_id", "session_id", "block_id", "max_chars"]
      }
    });
  });
});

describe("get_exact_context retrieval service", () => {
  it("retrieves a narrow matching section with integrity and truncation metadata", async () => {
    const { block, logs, service } = await fixture();
    const result = await service.getExactContext(inputFrom(block, { max_chars: 24 }));

    expect(result).toEqual({
      project_id: block.projectId,
      session_id: block.sessionId,
      block_id: block.blockId,
      source_label: "documentation",
      integrity_status: "verified",
      truncated: true,
      content: "line two: target needle "
    });
    expect(logs.at(-1)).toMatchObject({
      event: "exact_context_retrieval",
      outcome: "ok",
      returnedChars: 24,
      truncated: true,
      sourceCategory: "documentation"
    });
    expect(JSON.stringify(logs)).not.toContain("target needle");
  });

  it("retrieves by narrow line range", async () => {
    const { block, service } = await fixture();
    const result = await service.getExactContext(
      inputFrom(block, {
        query: undefined,
        line_start: 2,
        line_end: 3,
        max_chars: 80
      })
    );

    expect(result?.content).toBe(
      ["line two: target needle with exact value CTX-123", "line three: more context"].join("\n")
    );
    expect(result?.truncated).toBe(false);
  });

  it("returns nothing for missing blocks", async () => {
    const { namespace, service } = await fixture();
    const missing = createContextBlockIdentity(namespace, { randomSource: bytes(23) });

    await expect(service.getExactContext(inputFrom(missing))).resolves.toBeNull();
  });

  it("returns nothing for wrong project and wrong session", async () => {
    const { block, namespace, service } = await fixture();
    const otherProject = createProjectIdentity({
      projectPath: "/Users/example/work/other-retrieval-project",
      localIdentitySecret: localSecret
    });
    const otherSession = createSessionIdentity({
      projectId: namespace.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(24)
    });

    await expect(
      service.getExactContext(inputFrom({ ...block, projectId: otherProject.projectId }))
    ).resolves.toBeNull();
    await expect(
      service.getExactContext(inputFrom({ ...block, sessionId: otherSession.sessionId }))
    ).resolves.toBeNull();
  });

  it("returns nothing for expired blocks and deleted sessions", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "fixel-recall-retrieval-test-"));
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const session = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(25)
    });
    const namespace = createVaultNamespace(project.projectId, session.sessionId);
    const block = createContextBlockIdentity(namespace, { randomSource: bytes(26) });
    const vault = createLocalContextVault({
      rootDir,
      maxBlockBytes: 2_000,
      clock: { now: () => new Date("2026-07-16T00:02:00.000Z") }
    });
    const service = createRetrievalService({
      vault,
      maxSearchChars: 500,
      maxReturnChars: 80,
      maxLineSpan: 5
    });
    await vault.storeBlock({
      identity: block,
      sourceCategory: "documentation",
      authorisedOriginalContent: "expired needle",
      createdAt: new Date("2026-07-16T00:00:00.000Z"),
      expiresAt: new Date("2026-07-16T00:01:00.000Z")
    });

    await expect(service.getExactContext(inputFrom(block))).resolves.toBeNull();
    await vault.deleteSession(namespace);
    await expect(service.getExactContext(inputFrom(block))).resolves.toBeNull();
  });

  it("rejects traversal strings and oversized requests", async () => {
    const { block, service } = await fixture();

    await expect(
      service.getExactContext(inputFrom(block, { block_id: "../secret", max_chars: 80 }))
    ).resolves.toBeNull();
    await expect(service.getExactContext(inputFrom(block, { max_chars: 81 }))).resolves.toBeNull();
  });

  it("rejects broad regex abuse instead of treating query as a pattern", async () => {
    const { block, service } = await fixture();

    await expect(service.getExactContext(inputFrom(block, { query: ".*" }))).resolves.toBeNull();
    await expect(
      service.getExactContext(inputFrom(block, { query: "[\\s\\S]*" }))
    ).resolves.toBeNull();
  });

  it("returns nothing on integrity failure", async () => {
    const { block, rootDir, service } = await fixture();
    const file = blockFile(rootDir, block);
    const record = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    record.authorisedOriginalContent = "tampered needle";
    await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");

    await expect(service.getExactContext(inputFrom(block))).resolves.toBeNull();
  });
});

describe("local retrieval MCP server", () => {
  it("exposes get_exact_context through a local MCP-compatible call wrapper", async () => {
    const { block, service } = await fixture();
    const server = createLocalRetrievalMcpServer(service);
    const result = await server.callTool({
      name: "get_exact_context",
      arguments: inputFrom(block, { max_chars: 80 })
    });

    expect(server.tools).toHaveLength(1);
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      source_label: "documentation",
      integrity_status: "verified"
    });
  });
});
