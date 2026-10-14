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
  createContextCatalogue,
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
    authority: namespace,
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

describe("context cell catalogue", () => {
  it.each(["Codex", "Claude Code"])(
    "supports scoped discovery then exact retrieval for %s",
    async () => {
      const { vault, block, namespace, service } = await fixture();
      const server = createLocalRetrievalMcpServer(
        service,
        createContextCatalogue({
          vault,
          authority: namespace,
          references: [{ blockId: block.blockId }]
        })
      );
      expect(server.tools.map((tool) => tool.name)).toEqual([
        "get_exact_context",
        "find_context_cells"
      ]);
      const discovery = await server.callTool({
        name: "find_context_cells",
        arguments: { query: "documentation", limit: 1 }
      });
      const page = JSON.parse(discovery.content[0].text) as { cells: { block_id: string }[] };
      expect(page.cells[0]?.block_id).toBe(block.blockId);
      expect(discovery.content[0].text).not.toContain("needle");
      const result = await server.callTool({
        name: "get_exact_context",
        arguments: inputFrom(block)
      });
      expect(result.content[0].text).toContain("needle");
      const absent = await server.callTool({
        name: "find_context_cells",
        arguments: { query: "needle" }
      });
      expect(JSON.parse(absent.content[0].text).cells).toEqual([]);
    }
  );

  it("rejects model-controlled authority, registration, regex and oversized discovery", async () => {
    const { vault, block, namespace, service } = await fixture();
    const server = createLocalRetrievalMcpServer(
      service,
      createContextCatalogue({
        vault,
        authority: namespace,
        references: [{ blockId: block.blockId }]
      })
    );
    for (const args of [
      { project_id: "FAKE-SECRET" },
      { references: [] },
      { query: ".*" },
      { query: "x".repeat(81) },
      { limit: 21 },
      { offset: -1 },
      { limit: "1" },
      []
    ]) {
      const result = await server.callTool({ name: "find_context_cells", arguments: args });
      expect(result).toEqual({
        isError: true,
        content: [{ type: "text", text: "invalid discovery request" }]
      });
    }
  });

  it("returns allowlisted metadata without text, paths or invented freshness", async () => {
    const { vault, block, namespace } = await fixture();
    const catalogue = createContextCatalogue({
      vault,
      authority: namespace,
      references: [{ blockId: block.blockId }]
    });
    const page = await catalogue.list();
    expect(page.cells).toHaveLength(1);
    expect(page.cells[0]).toEqual({
      block_id: block.blockId,
      category: "documentation",
      description: "Documentation",
      created_at: fixedClock.now().toISOString(),
      expires_at: "2026-07-16T00:10:00.000Z",
      integrity_status: "verified",
      source_freshness: "unknown",
      trust: "untrusted_source_data",
      related_block_ids: []
    });
    expect(JSON.stringify(page)).not.toContain("needle");
    expect(JSON.stringify(page)).not.toContain(projectPath);
    expect(JSON.stringify(page)).not.toContain(namespace.projectId);
    expect(JSON.stringify(page)).not.toContain(namespace.sessionId);
    expect(await catalogue.list()).toEqual(page);
  });

  it("never discovers a known block under a different host session or project", async () => {
    const { vault, block, namespace } = await fixture();
    const otherSession = createSessionIdentity({
      projectId: namespace.projectId,
      ttlMs: 60000,
      clock: fixedClock,
      randomSource: bytes(70)
    });
    const otherProject = createProjectIdentity({
      projectPath: "/tmp/other",
      localIdentitySecret: localSecret
    });
    for (const authority of [
      { ...namespace, sessionId: otherSession.sessionId },
      { ...namespace, projectId: otherProject.projectId }
    ]) {
      expect(
        (
          await createContextCatalogue({
            vault,
            authority,
            references: [{ blockId: block.blockId }]
          }).list()
        ).cells
      ).toEqual([]);
    }
  });

  it("filters missing relations and rechecks deletion on every read", async () => {
    const { vault, block, namespace } = await fixture();
    const missing = createContextBlockIdentity(namespace, { randomSource: bytes(71) });
    const catalogue = createContextCatalogue({
      vault,
      authority: namespace,
      references: [
        { blockId: block.blockId, relatedBlockIds: [missing.blockId] },
        { blockId: missing.blockId }
      ]
    });
    expect((await catalogue.list()).cells[0]?.related_block_ids).toEqual([]);
    await vault.deleteSession(namespace);
    expect((await catalogue.list()).cells).toEqual([]);
  });

  it("excludes expired blocks", async () => {
    const { rootDir, block, namespace } = await fixture();
    const vault = createLocalContextVault({
      rootDir,
      maxBlockBytes: 2000,
      clock: { now: () => new Date("2026-07-17") }
    });
    expect(
      (
        await createContextCatalogue({
          vault,
          authority: namespace,
          references: [{ blockId: block.blockId }]
        }).list()
      ).cells
    ).toEqual([]);
  });

  it("fails closed on corruption without returning exception details", async () => {
    const { vault, rootDir, block, namespace } = await fixture();
    await writeFile(blockFile(rootDir, block), "FAKE-CANARY-CORRUPTION", "utf8");
    const page = await createContextCatalogue({
      vault,
      authority: namespace,
      references: [{ blockId: block.blockId }]
    }).list();
    expect(page).toEqual({ cells: [], next_offset: null, truncated: false, unavailable: true });
    expect(JSON.stringify(page)).not.toContain("FAKE-CANARY");
  });

  it("paginates in registration order and bounds serialized output", async () => {
    const { vault, block, namespace } = await fixture();
    const second = createContextBlockIdentity(namespace, { randomSource: bytes(72) });
    await vault.storeBlock({
      identity: second,
      sourceCategory: "documentation",
      authorisedOriginalContent: "Another section",
      expiresAt: new Date("2026-07-16T00:10:00.000Z")
    });
    const catalogue = createContextCatalogue({
      vault,
      authority: namespace,
      references: [
        { blockId: block.blockId, relatedBlockIds: [second.blockId] },
        { blockId: second.blockId }
      ],
      maxMetadataBytes: 1024
    });
    const first = await catalogue.list({ limit: 1 });
    expect(first.next_offset).toBe(1);
    expect(first.cells[0]?.related_block_ids).toEqual([second.blockId]);
    expect((await catalogue.list({ offset: 1 })).cells[0]?.block_id).toBe(second.blockId);
    expect(Buffer.byteLength(JSON.stringify(await catalogue.list()))).toBeLessThanOrEqual(1024);
    await expect(catalogue.list({ limit: 21 })).rejects.toThrow("bounds");
  });

  it("rejects traversal, duplicate and oversized registrations", async () => {
    const { vault, block, namespace } = await fixture();
    const options = { vault, authority: namespace };
    expect(() =>
      createContextCatalogue({ ...options, references: [{ blockId: "../private" }] })
    ).toThrow();
    expect(() =>
      createContextCatalogue({
        ...options,
        references: [{ blockId: block.blockId }, { blockId: block.blockId }]
      })
    ).toThrow("duplicate");
    expect(() =>
      createContextCatalogue({
        ...options,
        references: Array.from({ length: 101 }, () => ({ blockId: block.blockId }))
      })
    ).toThrow("limit");
  });
});

describe("get_exact_context retrieval service", () => {
  it.each(["\r\n", "\n", "\r"])("preserves original line separators %j", async (separator) => {
    const { vault, block, service } = await fixture();
    const original = ["first", "second", "third"].join(separator);
    await vault.storeBlock({
      identity: block,
      sourceCategory: "documentation",
      authorisedOriginalContent: original,
      expiresAt: new Date("2026-07-16T00:10:00.000Z")
    });
    const result = await service.getExactContext(
      inputFrom(block, { query: undefined, line_start: 1, line_end: 2 })
    );
    expect(result?.content).toBe(`first${separator}second`);
    expect(result?.content).toBe(
      original.slice(result?.source_range.start, result?.source_range.end)
    );
  });

  it("does not split Unicode pairs and bounds line searches", async () => {
    const { vault, block, namespace } = await fixture();
    await vault.storeBlock({
      identity: block,
      sourceCategory: "documentation",
      authorisedOriginalContent: "a😀b\nlater",
      expiresAt: new Date("2026-07-16T00:10:00.000Z")
    });
    const service = createRetrievalService({
      vault,
      authority: namespace,
      maxSearchChars: 4,
      maxReturnChars: 80,
      maxLineSpan: 5
    });
    const result = await service.getExactContext(inputFrom(block, { query: "a", max_chars: 2 }));
    expect(result?.content).toBe("a");
    expect(result?.truncated).toBe(true);
    await expect(
      service.getExactContext(inputFrom(block, { query: undefined, line_start: 2, line_end: 2 }))
    ).resolves.toBeNull();
  });

  it("returns nothing and logs only a safe code on storage failure", async () => {
    const { vault, block, namespace, logs } = await fixture();
    const service = createRetrievalService({
      vault: {
        ...vault,
        retrieveBlock: async () => {
          throw new Error("FAKE-SECRET-STORAGE-ERROR");
        }
      },
      authority: namespace,
      maxSearchChars: 500,
      maxReturnChars: 80,
      maxLineSpan: 5,
      logger: { info: (event) => logs.push(event) }
    });
    await expect(service.getExactContext(inputFrom(block))).resolves.toBeNull();
    expect(logs.at(-1)?.outcome).toBe("vault_unavailable");
    expect(JSON.stringify(logs)).not.toContain("FAKE-SECRET");
  });

  it("denies a valid stored block without host authority", async () => {
    const { vault, block } = await fixture();
    const service = createRetrievalService({
      vault,
      maxSearchChars: 500,
      maxReturnChars: 80,
      maxLineSpan: 5
    });
    await expect(service.getExactContext(inputFrom(block))).resolves.toBeNull();
  });

  it("denies known valid IDs from another host session before reading the vault", async () => {
    const { vault, block, namespace } = await fixture();
    const otherSession = createSessionIdentity({
      projectId: namespace.projectId,
      ttlMs: 60000,
      clock: fixedClock,
      randomSource: bytes(50)
    });
    let reads = 0;
    const service = createRetrievalService({
      authority: { projectId: namespace.projectId, sessionId: otherSession.sessionId },
      vault: {
        ...vault,
        retrieveBlock: async (identity) => {
          reads++;
          return vault.retrieveBlock(identity);
        }
      },
      maxSearchChars: 500,
      maxReturnChars: 80,
      maxLineSpan: 5
    });
    await expect(service.getExactContext(inputFrom(block))).resolves.toBeNull();
    expect(reads).toBe(0);
  });

  it("does not log arbitrary fake secrets supplied as IDs", async () => {
    const { service, block, logs } = await fixture();
    const canary = "FAKE-CANARY-DO-NOT-LOG";
    await service.getExactContext(inputFrom(block, { block_id: canary }));
    expect(JSON.stringify(logs)).not.toContain(canary);
  });

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
      source_range: { start: 16, end: 40, unit: "utf16" },
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
      authority: namespace,
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
