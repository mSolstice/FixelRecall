import { describe, expect, it } from "vitest";

import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  assertBlockInScope,
  assertContextBlockId,
  assertProjectId,
  assertSameProject,
  assertSameSession,
  assertSessionId,
  createContextBlockIdentity,
  createLocalContextVault,
  createProjectIdentity,
  createSessionIdentity,
  createVaultNamespace,
  deleteSessionIdentity,
  expireSessionIdentity,
  resumeSessionIdentity,
  type IdentityClock,
  type RandomSource
} from "./index.js";

const localSecret = "fake-local-identity-secret-for-tests-only-0001";
const projectPath = "/Users/example/work/private-repo-name";
const fixedClock: IdentityClock = {
  now: () => new Date("2026-07-16T00:00:00.000Z")
};

function bytes(value: number): RandomSource {
  return {
    randomBytes: (size) => new Uint8Array(size).fill(value)
  };
}

describe("project identity", () => {
  it("is stable for the same local project and secret without exposing the raw path", () => {
    const first = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const second = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });

    expect(first).toEqual(second);
    expect(first.projectId).toMatch(/^prj_[A-Za-z0-9_-]{32}$/);
    expect(first.canonicalPathFingerprint).toMatch(/^fp_[A-Za-z0-9_-]{22}$/);
    expect(first.projectId).not.toContain("private-repo-name");
    expect(first.projectId).not.toContain("/Users/example");
  });

  it("separates different projects and different local identity secrets", () => {
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const otherProject = createProjectIdentity({
      projectPath: "/Users/example/work/other-repo-name",
      localIdentitySecret: localSecret
    });
    const otherSecret = createProjectIdentity({
      projectPath,
      localIdentitySecret: "fake-local-identity-secret-for-tests-only-0002"
    });

    expect(project.projectId).not.toBe(otherProject.projectId);
    expect(project.projectId).not.toBe(otherSecret.projectId);
  });

  it("rejects weak local identity secrets", () => {
    expect(() => createProjectIdentity({ projectPath, localIdentitySecret: "too-short" })).toThrow(
      "local identity secret must be at least 32 characters"
    );
  });
});

describe("session lifecycle", () => {
  it("creates unique session IDs scoped to a project", () => {
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const first = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(1)
    });
    const second = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(2)
    });

    expect(first.projectId).toBe(project.projectId);
    expect(first.sessionId).toMatch(/^ses_[A-Za-z0-9_-]{32}$/);
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(first.status).toBe("active");
    expect(first.expiresAt.toISOString()).toBe("2026-07-16T00:01:00.000Z");
  });

  it("resumes active sessions, expires old sessions and prevents deleted resumes", () => {
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const session = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(3)
    });

    expect(resumeSessionIdentity({ session, clock: fixedClock })).toEqual(session);
    expect(
      resumeSessionIdentity({
        session,
        clock: { now: () => new Date("2026-07-16T00:02:00.000Z") }
      }).status
    ).toBe("expired");
    expect(expireSessionIdentity(session).status).toBe("expired");
    expect(deleteSessionIdentity(session).status).toBe("deleted");
    expect(() =>
      resumeSessionIdentity({ session: deleteSessionIdentity(session), clock: fixedClock })
    ).toThrow("deleted sessions cannot be resumed");
  });

  it("rejects invalid ttl values", () => {
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });

    expect(() =>
      createSessionIdentity({
        projectId: project.projectId,
        ttlMs: 0,
        randomSource: bytes(4)
      })
    ).toThrow("session ttl must be a positive safe integer");
  });
});

describe("context block identity and scope", () => {
  it("creates unpredictable context block IDs scoped to project and session", () => {
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const session = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(5)
    });
    const namespace = createVaultNamespace(project.projectId, session.sessionId);
    const first = createContextBlockIdentity(namespace, { randomSource: bytes(6) });
    const second = createContextBlockIdentity(namespace, { randomSource: bytes(7) });

    expect(first.projectId).toBe(project.projectId);
    expect(first.sessionId).toBe(session.sessionId);
    expect(first.blockId).toMatch(/^blk_[A-Za-z0-9_-]{43}$/);
    expect(first.blockId).not.toBe(second.blockId);
    expect(first.blockId).not.toContain("private-repo-name");
    expect(() => assertBlockInScope(first, namespace)).not.toThrow();
  });

  it("rejects path-like and malformed public IDs", () => {
    expect(() => assertProjectId("prj_/Users/example/private")).toThrow("project id is invalid");
    expect(() => assertSessionId("../ses_fake_path")).toThrow("session id is invalid");
    expect(() => assertContextBlockId("blk_C:\\Users\\Example\\secret")).toThrow(
      "context block id is invalid"
    );
    expect(() => assertSessionId("ses_short")).toThrow("session id is invalid");
  });

  it("detects cross-project and cross-session separation", () => {
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const otherProject = createProjectIdentity({
      projectPath: "/Users/example/work/other-repo-name",
      localIdentitySecret: localSecret
    });
    const session = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(8)
    });
    const otherSession = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(9)
    });
    const namespace = createVaultNamespace(project.projectId, session.sessionId);
    const block = createContextBlockIdentity(namespace, { randomSource: bytes(10) });

    expect(() => assertSameProject(project.projectId, otherProject.projectId)).toThrow(
      "project scope mismatch"
    );
    expect(() =>
      assertSameSession(namespace, createVaultNamespace(project.projectId, otherSession.sessionId))
    ).toThrow("session scope mismatch");
    expect(() =>
      assertBlockInScope(block, createVaultNamespace(otherProject.projectId, session.sessionId))
    ).toThrow("project scope mismatch");
  });
});

describe("local context vault", () => {
  async function fixture() {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "fixel-recall-vault-test-"));
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const session = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(11)
    });
    const namespace = createVaultNamespace(project.projectId, session.sessionId);
    const block = createContextBlockIdentity(namespace, { randomSource: bytes(12) });
    const vault = createLocalContextVault({
      rootDir,
      maxBlockBytes: 256,
      clock: fixedClock
    });
    return { block, namespace, project, rootDir, session, vault };
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

  it("stores and retrieves an authorised original block with integrity metadata", async () => {
    const { block, rootDir, vault } = await fixture();
    const stored = await vault.storeBlock({
      identity: block,
      sourceCategory: "documentation",
      authorisedOriginalContent: "Safe exact original content",
      expiresAt: new Date("2026-07-16T00:10:00.000Z")
    });

    expect(stored).toMatchObject({
      projectId: block.projectId,
      sessionId: block.sessionId,
      blockId: block.blockId,
      sourceCategory: "documentation",
      authorisedOriginalContent: "Safe exact original content",
      deleted: false
    });
    expect(stored.integrityHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    await expect(vault.retrieveBlock(block)).resolves.toMatchObject(stored);

    const storedFile = await readFile(blockFile(rootDir, block), "utf8");
    expect(storedFile).toContain("Safe exact original content");
    expect(storedFile).not.toContain("authorization");
    expect(storedFile).not.toContain(projectPath);
  });

  it.skipIf(process.platform === "win32")(
    "uses restricted permissions where supported",
    async () => {
      const { block, rootDir, vault } = await fixture();
      await vault.storeBlock({
        identity: block,
        sourceCategory: "conversation_history",
        authorisedOriginalContent: "permission test",
        expiresAt: new Date("2026-07-16T00:10:00.000Z")
      });

      const rootMode = (await stat(rootDir)).mode & 0o777;
      const fileMode = (await stat(blockFile(rootDir, block))).mode & 0o777;
      expect(rootMode).toBe(0o700);
      expect(fileMode).toBe(0o600);
    }
  );

  it("enforces size limits and rejects secret-sensitive spans", async () => {
    const { block, vault } = await fixture();

    await expect(
      vault.storeBlock({
        identity: block,
        sourceCategory: "terminal_output",
        authorisedOriginalContent: "x".repeat(257),
        expiresAt: new Date("2026-07-16T00:10:00.000Z")
      })
    ).rejects.toThrow("context block exceeds configured size limit");

    await expect(
      vault.storeBlock({
        identity: block,
        sourceCategory: "terminal_output",
        authorisedOriginalContent: "fake canary should not be stored",
        secretSensitiveSpanCount: 1,
        expiresAt: new Date("2026-07-16T00:10:00.000Z")
      })
    ).rejects.toThrow("secret-sensitive spans must not be stored");
  });

  it("proves canary secrets are not stored when secret-sensitive spans are present", async () => {
    const { block, rootDir, vault } = await fixture();
    const canary = "FAKE_CANARY_SECRET_DO_NOT_STORE_1234567890";

    await expect(
      vault.storeBlock({
        identity: block,
        sourceCategory: "terminal_output",
        authorisedOriginalContent: `token=${canary}`,
        secretSensitiveSpanCount: 1,
        expiresAt: new Date("2026-07-16T00:10:00.000Z")
      })
    ).rejects.toThrow("secret-sensitive spans must not be stored");

    await expect(readFile(blockFile(rootDir, block), "utf8")).rejects.toThrow();
  });

  it("rejects unsupported metadata instead of storing headers or model-supplied paths", async () => {
    const { block, rootDir, vault } = await fixture();
    const fakeHeader = "Bearer FAKE_HEADER_VALUE_DO_NOT_STORE";
    const fakeModelPath = "../../private/path/from/model";

    await expect(
      vault.storeBlock({
        identity: block,
        sourceCategory: "tool_result",
        authorisedOriginalContent: "authorised body",
        metadata: {
          authorization: fakeHeader,
          model_supplied_path: fakeModelPath
        },
        expiresAt: new Date("2026-07-16T00:10:00.000Z")
      })
    ).rejects.toThrow("vault metadata storage is not supported yet");

    await expect(readFile(blockFile(rootDir, block), "utf8")).rejects.toThrow();
  });

  it("isolates projects and sessions during retrieval", async () => {
    const { block, namespace, vault } = await fixture();
    await vault.storeBlock({
      identity: block,
      sourceCategory: "documentation",
      authorisedOriginalContent: "scoped content",
      expiresAt: new Date("2026-07-16T00:10:00.000Z")
    });
    const otherProject = createProjectIdentity({
      projectPath: "/Users/example/work/other-repo-name",
      localIdentitySecret: localSecret
    });
    const otherProjectIdentity = {
      ...block,
      projectId: otherProject.projectId
    };
    const otherSession = createSessionIdentity({
      projectId: namespace.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(13)
    });
    const otherSessionIdentity = {
      ...block,
      sessionId: otherSession.sessionId
    };

    await expect(vault.retrieveBlock(otherProjectIdentity)).resolves.toBeNull();
    await expect(vault.retrieveBlock(otherSessionIdentity)).resolves.toBeNull();
  });

  it("expires blocks and delete-session removes associated content", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "fixel-recall-vault-test-"));
    const project = createProjectIdentity({ projectPath, localIdentitySecret: localSecret });
    const session = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: bytes(14)
    });
    const namespace = createVaultNamespace(project.projectId, session.sessionId);
    const block = createContextBlockIdentity(namespace, { randomSource: bytes(15) });
    const vault = createLocalContextVault({
      rootDir,
      maxBlockBytes: 256,
      clock: { now: () => new Date("2026-07-16T00:02:00.000Z") }
    });

    await vault.storeBlock({
      identity: block,
      sourceCategory: "documentation",
      authorisedOriginalContent: "expired content",
      createdAt: new Date("2026-07-16T00:00:00.000Z"),
      expiresAt: new Date("2026-07-16T00:01:00.000Z")
    });
    await expect(vault.retrieveBlock(block)).resolves.toBeNull();

    await vault.deleteSession(namespace);
    await expect(readFile(blockFile(rootDir, block), "utf8")).rejects.toThrow();
  });

  it("detects corrupted stored content", async () => {
    const { block, rootDir, vault } = await fixture();
    await vault.storeBlock({
      identity: block,
      sourceCategory: "documentation",
      authorisedOriginalContent: "original content",
      expiresAt: new Date("2026-07-16T00:10:00.000Z")
    });
    const file = blockFile(rootDir, block);
    const record = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    record.authorisedOriginalContent = "tampered content";
    await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");

    await expect(vault.retrieveBlock(block)).rejects.toThrow("integrity check failed");
  });

  it("cleans crash leftovers from nested vault directories", async () => {
    const { block, rootDir, vault } = await fixture();
    const directory = path.dirname(blockFile(rootDir, block));
    await mkdir(directory, { recursive: true });
    const tempFile = path.join(directory, ".tmp-crash-leftover.json");
    await writeFile(tempFile, "partial", "utf8");

    await expect(vault.cleanupCrashArtifacts()).resolves.toBe(1);
    await expect(readFile(tempFile, "utf8")).rejects.toThrow();
  });
});
