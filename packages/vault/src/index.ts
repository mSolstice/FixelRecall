import type { SourceCategory } from "@fixel-recall/core";

import {
  createHash,
  createHmac,
  randomBytes as nodeRandomBytes,
  timingSafeEqual
} from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, mkdir, open, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

export type ProjectId = string & { readonly __brand: "ProjectId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type ContextBlockId = string & { readonly __brand: "ContextBlockId" };

export type SessionStatus = "active" | "expired" | "deleted";

export interface VaultNamespace {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
}

export interface ProjectIdentity {
  readonly projectId: ProjectId;
  readonly canonicalPathFingerprint: string;
}

export interface SessionIdentity {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly status: SessionStatus;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export interface ContextBlockIdentity {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly blockId: ContextBlockId;
}

export interface StoredContextBlock {
  readonly projectId: ProjectId;
  readonly sessionId: SessionId;
  readonly blockId: ContextBlockId;
  readonly sourceCategory: SourceCategory;
  readonly integrityHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly authorisedOriginalContent: string;
  readonly deleted: boolean;
}

export interface LocalContextVaultOptions {
  readonly rootDir: string;
  readonly maxBlockBytes: number;
  readonly clock?: IdentityClock;
}

export interface StoreContextBlockInput {
  readonly identity: ContextBlockIdentity;
  readonly sourceCategory: SourceCategory;
  readonly authorisedOriginalContent: string;
  readonly createdAt?: Date;
  readonly expiresAt: Date;
  readonly secretSensitiveSpanCount?: number;
  readonly metadata?: Record<string, string>;
}

export interface LocalContextVault {
  storeBlock(input: StoreContextBlockInput): Promise<StoredContextBlock>;
  retrieveBlock(identity: ContextBlockIdentity): Promise<StoredContextBlock | null>;
  deleteSession(namespace: VaultNamespace): Promise<void>;
  cleanupExpired(): Promise<number>;
  cleanupCrashArtifacts(): Promise<number>;
}

export interface IdentityLifecycle {
  readonly project: ProjectIdentity;
  readonly session: SessionIdentity;
}

export interface IdentityClock {
  now(): Date;
}

export interface RandomSource {
  randomBytes(size: number): Uint8Array;
}

export interface IdentityRuntime {
  readonly clock?: IdentityClock;
  readonly randomSource?: RandomSource;
}

export interface CreateProjectIdentityInput {
  readonly projectPath: string;
  readonly localIdentitySecret: string;
}

export interface CreateSessionInput extends IdentityRuntime {
  readonly projectId: ProjectId;
  readonly ttlMs: number;
}

export interface ResumeSessionInput extends IdentityRuntime {
  readonly session: SessionIdentity;
}

const PROJECT_ID_PATTERN = /^prj_[A-Za-z0-9_-]{32}$/;
const SESSION_ID_PATTERN = /^ses_[A-Za-z0-9_-]{32}$/;
const BLOCK_ID_PATTERN = /^blk_[A-Za-z0-9_-]{43}$/;
const FINGERPRINT_PATTERN = /^fp_[A-Za-z0-9_-]{22}$/;
const BLOCK_FILE_NAME = "block.json";
const TEMP_FILE_PREFIX = ".tmp-";
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

const defaultClock: IdentityClock = {
  now: () => new Date()
};

const defaultRandomSource: RandomSource = {
  randomBytes: (size) => nodeRandomBytes(size)
};

export function createVaultNamespace(projectId: ProjectId, sessionId: SessionId): VaultNamespace {
  assertProjectId(projectId);
  assertSessionId(sessionId);
  return { projectId, sessionId };
}

export function createProjectIdentity(input: CreateProjectIdentityInput): ProjectIdentity {
  if (input.localIdentitySecret.length < 32) {
    throw new Error("local identity secret must be at least 32 characters");
  }
  const canonicalProjectPath = path.resolve(input.projectPath);
  const digest = createHmac("sha256", input.localIdentitySecret)
    .update(canonicalProjectPath)
    .digest();
  const projectId = `prj_${base64Url(digest).slice(0, 32)}` as ProjectId;
  const canonicalPathFingerprint = `fp_${base64Url(digest.subarray(16)).slice(0, 22)}`;
  assertProjectId(projectId);
  assertFingerprint(canonicalPathFingerprint);
  return { projectId, canonicalPathFingerprint };
}

export function createSessionIdentity(input: CreateSessionInput): SessionIdentity {
  assertProjectId(input.projectId);
  if (!Number.isSafeInteger(input.ttlMs) || input.ttlMs <= 0) {
    throw new Error("session ttl must be a positive safe integer");
  }
  const clock = input.clock ?? defaultClock;
  const createdAt = clock.now();
  const expiresAt = new Date(createdAt.getTime() + input.ttlMs);
  const sessionId = randomId("ses", 24, SESSION_ID_PATTERN, input.randomSource);
  return {
    projectId: input.projectId,
    sessionId,
    status: "active",
    createdAt,
    expiresAt
  };
}

export function resumeSessionIdentity(input: ResumeSessionInput): SessionIdentity {
  assertSessionIdentity(input.session);
  if (input.session.status === "deleted") {
    throw new Error("deleted sessions cannot be resumed");
  }
  const clock = input.clock ?? defaultClock;
  if (clock.now().getTime() >= input.session.expiresAt.getTime()) {
    return expireSessionIdentity(input.session);
  }
  return input.session;
}

export function expireSessionIdentity(session: SessionIdentity): SessionIdentity {
  assertSessionIdentity(session);
  if (session.status === "deleted") {
    return session;
  }
  return { ...session, status: "expired" };
}

export function deleteSessionIdentity(session: SessionIdentity): SessionIdentity {
  assertSessionIdentity(session);
  return { ...session, status: "deleted" };
}

export function createContextBlockIdentity(
  namespace: VaultNamespace,
  runtime: IdentityRuntime = {}
): ContextBlockIdentity {
  const scopedNamespace = createVaultNamespace(namespace.projectId, namespace.sessionId);
  return {
    ...scopedNamespace,
    blockId: randomId("blk", 32, BLOCK_ID_PATTERN, runtime.randomSource)
  };
}

export function assertProjectId(value: string): asserts value is ProjectId {
  assertOpaqueId(value, PROJECT_ID_PATTERN, "project id");
}

export function assertSessionId(value: string): asserts value is SessionId {
  assertOpaqueId(value, SESSION_ID_PATTERN, "session id");
}

export function assertContextBlockId(value: string): asserts value is ContextBlockId {
  assertOpaqueId(value, BLOCK_ID_PATTERN, "context block id");
}

export function assertSameProject(left: ProjectId, right: ProjectId): void {
  assertProjectId(left);
  assertProjectId(right);
  if (!safeStringEqual(left, right)) {
    throw new Error("project scope mismatch");
  }
}

export function assertSameSession(left: VaultNamespace, right: VaultNamespace): void {
  assertSameProject(left.projectId, right.projectId);
  assertSessionId(left.sessionId);
  assertSessionId(right.sessionId);
  if (!safeStringEqual(left.sessionId, right.sessionId)) {
    throw new Error("session scope mismatch");
  }
}

export function assertBlockInScope(block: ContextBlockIdentity, namespace: VaultNamespace): void {
  assertContextBlockId(block.blockId);
  assertSameSession(block, namespace);
}

export function createLocalContextVault(options: LocalContextVaultOptions): LocalContextVault {
  if (!Number.isSafeInteger(options.maxBlockBytes) || options.maxBlockBytes <= 0) {
    throw new Error("max block bytes must be a positive safe integer");
  }
  const rootDir = path.resolve(options.rootDir);
  const clock = options.clock ?? defaultClock;
  const resolveProjectDir = (projectId: ProjectId) => path.join(rootDir, "projects", projectId);
  const resolveSessionDir = (namespace: VaultNamespace) =>
    path.join(resolveProjectDir(namespace.projectId), "sessions", namespace.sessionId);
  const resolveBlockDir = (identity: ContextBlockIdentity) =>
    path.join(resolveSessionDir(identity), "blocks", identity.blockId);
  const resolveBlockFile = (identity: ContextBlockIdentity) =>
    path.join(resolveBlockDir(identity), BLOCK_FILE_NAME);

  async function ensureVaultRoot(): Promise<void> {
    await ensurePrivateDirectory(rootDir);
    await ensurePrivateDirectory(path.join(rootDir, "projects"));
    await ensurePrivateDirectory(path.join(rootDir, "tmp"));
  }

  async function storeBlock(input: StoreContextBlockInput): Promise<StoredContextBlock> {
    assertBlockInScope(input.identity, input.identity);
    if ((input.secretSensitiveSpanCount ?? 0) > 0) {
      throw new Error("secret-sensitive spans must not be stored");
    }
    if (input.metadata !== undefined && Object.keys(input.metadata).length > 0) {
      throw new Error("vault metadata storage is not supported yet");
    }
    const contentBytes = Buffer.byteLength(input.authorisedOriginalContent, "utf8");
    if (contentBytes > options.maxBlockBytes) {
      throw new Error("context block exceeds configured size limit");
    }
    assertDate(input.expiresAt, "expiresAt");
    const createdAt = input.createdAt ?? clock.now();
    assertDate(createdAt, "createdAt");
    if (input.expiresAt.getTime() <= createdAt.getTime()) {
      throw new Error("expiresAt must be after createdAt");
    }

    await ensureVaultRoot();
    const blockDir = resolveBlockDir(input.identity);
    await ensurePrivateDirectory(resolveProjectDir(input.identity.projectId));
    await ensurePrivateDirectory(
      path.join(resolveProjectDir(input.identity.projectId), "sessions")
    );
    await ensurePrivateDirectory(resolveSessionDir(input.identity));
    await ensurePrivateDirectory(path.join(resolveSessionDir(input.identity), "blocks"));
    await ensurePrivateDirectory(blockDir);

    const stored: StoredContextBlock = {
      projectId: input.identity.projectId,
      sessionId: input.identity.sessionId,
      blockId: input.identity.blockId,
      sourceCategory: input.sourceCategory,
      integrityHash: hashContent(input.authorisedOriginalContent),
      createdAt,
      expiresAt: input.expiresAt,
      authorisedOriginalContent: input.authorisedOriginalContent,
      deleted: false
    };
    await atomicWriteJson(resolveBlockFile(input.identity), serializeStoredBlock(stored));
    return stored;
  }

  async function retrieveBlock(identity: ContextBlockIdentity): Promise<StoredContextBlock | null> {
    assertBlockInScope(identity, identity);
    const blockFile = resolveBlockFile(identity);
    let raw: string;
    try {
      raw = await readFile(blockFile, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
    const stored = parseStoredBlock(raw);
    assertBlockInScope(stored, identity);
    if (stored.deleted) {
      return null;
    }
    if (clock.now().getTime() >= stored.expiresAt.getTime()) {
      await markBlockDeleted(stored);
      return null;
    }
    if (hashContent(stored.authorisedOriginalContent) !== stored.integrityHash) {
      throw new Error("integrity check failed");
    }
    return stored;
  }

  async function deleteSession(namespace: VaultNamespace): Promise<void> {
    const scopedNamespace = createVaultNamespace(namespace.projectId, namespace.sessionId);
    const sessionDir = resolveSessionDir(scopedNamespace);
    try {
      await rm(sessionDir, { recursive: true, force: true });
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  async function cleanupExpired(): Promise<number> {
    await ensureVaultRoot();
    let count = 0;
    for (const identity of await listBlockIdentities(rootDir)) {
      const block = await retrieveBlock(identity);
      if (block === null) {
        count += 1;
      }
    }
    return count;
  }

  async function cleanupCrashArtifacts(): Promise<number> {
    await ensureVaultRoot();
    return removeTempFiles(rootDir);
  }

  async function markBlockDeleted(block: StoredContextBlock): Promise<void> {
    const deletedBlock: StoredContextBlock = { ...block, deleted: true };
    await atomicWriteJson(resolveBlockFile(deletedBlock), serializeStoredBlock(deletedBlock));
  }

  return { cleanupCrashArtifacts, cleanupExpired, deleteSession, retrieveBlock, storeBlock };
}

function assertSessionIdentity(session: SessionIdentity): void {
  assertProjectId(session.projectId);
  assertSessionId(session.sessionId);
  if (!(session.createdAt instanceof Date) || Number.isNaN(session.createdAt.getTime())) {
    throw new Error("session createdAt must be a valid date");
  }
  if (!(session.expiresAt instanceof Date) || Number.isNaN(session.expiresAt.getTime())) {
    throw new Error("session expiresAt must be a valid date");
  }
}

function serializeStoredBlock(block: StoredContextBlock): string {
  return `${JSON.stringify(
    {
      projectId: block.projectId,
      sessionId: block.sessionId,
      blockId: block.blockId,
      sourceCategory: block.sourceCategory,
      integrityHash: block.integrityHash,
      createdAt: block.createdAt.toISOString(),
      expiresAt: block.expiresAt.toISOString(),
      authorisedOriginalContent: block.authorisedOriginalContent,
      deleted: block.deleted
    },
    null,
    2
  )}\n`;
}

function parseStoredBlock(raw: string): StoredContextBlock {
  const value = parseJsonObject(raw);
  const projectId = readString(value, "projectId");
  const sessionId = readString(value, "sessionId");
  const blockId = readString(value, "blockId");
  assertProjectId(projectId);
  assertSessionId(sessionId);
  assertContextBlockId(blockId);
  const createdAt = new Date(readString(value, "createdAt"));
  const expiresAt = new Date(readString(value, "expiresAt"));
  assertDate(createdAt, "createdAt");
  assertDate(expiresAt, "expiresAt");
  return {
    projectId,
    sessionId,
    blockId,
    sourceCategory: readSourceCategory(value, "sourceCategory"),
    integrityHash: readIntegrityHash(value, "integrityHash"),
    createdAt,
    expiresAt,
    authorisedOriginalContent: readString(value, "authorisedOriginalContent"),
    deleted: readBoolean(value, "deleted")
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("stored block must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function readString(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  if (typeof field !== "string") {
    throw new Error(`stored block ${key} must be a string`);
  }
  return field;
}

function readBoolean(value: Record<string, unknown>, key: string): boolean {
  const field = value[key];
  if (typeof field !== "boolean") {
    throw new Error(`stored block ${key} must be a boolean`);
  }
  return field;
}

function readSourceCategory(value: Record<string, unknown>, key: string): SourceCategory {
  const field = readString(value, key);
  const allowed: readonly SourceCategory[] = [
    "current_instruction",
    "conversation_history",
    "tool_call",
    "tool_result",
    "source_code",
    "terminal_output",
    "documentation",
    "external_content",
    "unknown"
  ];
  if (!allowed.includes(field as SourceCategory)) {
    throw new Error("stored block sourceCategory is invalid");
  }
  return field as SourceCategory;
}

function readIntegrityHash(value: Record<string, unknown>, key: string): string {
  const field = readString(value, key);
  if (!/^sha256:[a-f0-9]{64}$/.test(field)) {
    throw new Error("stored block integrityHash is invalid");
  }
  return field;
}

function hashContent(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function assertDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
}

async function ensurePrivateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: DIRECTORY_MODE });
  await chmodIfSupported(directory, DIRECTORY_MODE);
}

async function atomicWriteJson(filePath: string, content: string): Promise<void> {
  const directory = path.dirname(filePath);
  await ensurePrivateDirectory(directory);
  const tempPath = path.join(directory, `${TEMP_FILE_PREFIX}${process.pid}-${Date.now()}.json`);
  const file = await open(
    tempPath,
    fsConstants.O_CREAT | fsConstants.O_TRUNC | fsConstants.O_WRONLY,
    FILE_MODE
  );
  try {
    await file.writeFile(content, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  await chmodIfSupported(tempPath, FILE_MODE);
  await rename(tempPath, filePath);
  await chmodIfSupported(filePath, FILE_MODE);
}

async function listBlockIdentities(rootDir: string): Promise<readonly ContextBlockIdentity[]> {
  const projectsDir = path.join(rootDir, "projects");
  let projectEntries: readonly string[];
  try {
    projectEntries = await readdir(projectsDir);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const identities: ContextBlockIdentity[] = [];
  for (const projectIdValue of projectEntries) {
    try {
      assertProjectId(projectIdValue);
    } catch {
      continue;
    }
    const sessionsDir = path.join(projectsDir, projectIdValue, "sessions");
    for (const sessionIdValue of await safeReadDir(sessionsDir)) {
      try {
        assertSessionId(sessionIdValue);
      } catch {
        continue;
      }
      const blocksDir = path.join(sessionsDir, sessionIdValue, "blocks");
      for (const blockIdValue of await safeReadDir(blocksDir)) {
        try {
          assertContextBlockId(blockIdValue);
        } catch {
          continue;
        }
        identities.push({
          projectId: projectIdValue,
          sessionId: sessionIdValue,
          blockId: blockIdValue
        });
      }
    }
  }
  return identities;
}

async function safeReadDir(directory: string): Promise<readonly string[]> {
  try {
    return await readdir(directory);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function removeTempFiles(directory: string): Promise<number> {
  let count = 0;
  for (const entry of await safeReadDir(directory)) {
    const target = path.join(directory, entry);
    const targetStat = await stat(target);
    if (targetStat.isDirectory()) {
      count += await removeTempFiles(target);
    } else if (targetStat.isFile() && entry.startsWith(TEMP_FILE_PREFIX)) {
      await rm(target, { force: true });
      count += 1;
    }
  }
  return count;
}

async function chmodIfSupported(target: string, mode: number): Promise<void> {
  try {
    await chmod(target, mode);
  } catch (error) {
    if (!isNodeError(error) || (error.code !== "ENOSYS" && error.code !== "EPERM")) {
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function assertOpaqueId(value: string, pattern: RegExp, label: string): void {
  if (!pattern.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new Error(`${label} must not be a filesystem path`);
  }
}

function assertFingerprint(value: string): void {
  if (!FINGERPRINT_PATTERN.test(value)) {
    throw new Error("project fingerprint is invalid");
  }
}

function randomId(
  prefix: "ses",
  byteLength: number,
  pattern: RegExp,
  randomSource?: RandomSource
): SessionId;
function randomId(
  prefix: "blk",
  byteLength: number,
  pattern: RegExp,
  randomSource?: RandomSource
): ContextBlockId;
function randomId(
  prefix: "ses" | "blk",
  byteLength: number,
  pattern: RegExp,
  randomSource: RandomSource = defaultRandomSource
): SessionId | ContextBlockId {
  const id = `${prefix}_${base64Url(randomSource.randomBytes(byteLength))}`;
  if (!pattern.test(id)) {
    throw new Error(`${prefix} id generation failed validation`);
  }
  return prefix === "ses" ? (id as SessionId) : (id as ContextBlockId);
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
