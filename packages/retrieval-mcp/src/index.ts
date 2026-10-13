import {
  assertContextBlockId,
  assertProjectId,
  assertSessionId,
  type ContextBlockIdentity,
  type LocalContextVault,
  type StoredContextBlock
} from "@fixel-recall/vault";

export const exactContextToolName = "get_exact_context";

export interface ExactContextToolDescriptor {
  readonly name: typeof exactContextToolName;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required: readonly string[];
  };
}

export interface RetrievalServiceOptions {
  readonly vault: LocalContextVault;
  readonly maxSearchChars: number;
  readonly maxReturnChars: number;
  readonly maxLineSpan: number;
  readonly logger?: RetrievalLogger;
}

export interface RetrievalLogger {
  info(event: RetrievalLogEvent): void;
}

export interface RetrievalLogEvent {
  readonly event: "exact_context_retrieval";
  readonly projectId: string;
  readonly sessionId: string;
  readonly blockId: string;
  readonly outcome: RetrievalOutcome;
  readonly sourceCategory?: string;
  readonly returnedChars: number;
  readonly truncated: boolean;
}

export type RetrievalOutcome =
  | "ok"
  | "not_found"
  | "invalid_input"
  | "oversized_request"
  | "integrity_failure";

export interface GetExactContextInput {
  readonly project_id: string;
  readonly session_id: string;
  readonly block_id: string;
  readonly query?: string;
  readonly line_start?: number;
  readonly line_end?: number;
  readonly max_chars: number;
}

export interface ExactContextResult {
  readonly project_id: string;
  readonly session_id: string;
  readonly block_id: string;
  readonly source_label: string;
  readonly integrity_status: "verified";
  readonly truncated: boolean;
  readonly content: string;
}

export interface RetrievalService {
  getExactContext(input: GetExactContextInput): Promise<ExactContextResult | null>;
}

export interface LocalMcpToolCall {
  readonly name: string;
  readonly arguments: unknown;
}

export interface LocalMcpToolResult {
  readonly content: readonly [{ readonly type: "text"; readonly text: string }];
  readonly isError?: boolean;
}

export interface LocalRetrievalMcpServer {
  readonly tools: readonly [ExactContextToolDescriptor];
  callTool(call: LocalMcpToolCall): Promise<LocalMcpToolResult>;
}

export function describeExactContextTool(): ExactContextToolDescriptor {
  return {
    name: exactContextToolName,
    description: "Retrieve a narrow authorised exact section from the local Fixel Recall vault.",
    inputSchema: {
      type: "object",
      required: ["project_id", "session_id", "block_id", "max_chars"],
      properties: {
        project_id: { type: "string" },
        session_id: { type: "string" },
        block_id: { type: "string" },
        query: { type: "string" },
        line_start: { type: "integer", minimum: 1 },
        line_end: { type: "integer", minimum: 1 },
        max_chars: { type: "integer", minimum: 1 }
      }
    }
  };
}

export function createRetrievalService(options: RetrievalServiceOptions): RetrievalService {
  validatePositiveLimit(options.maxSearchChars, "maxSearchChars");
  validatePositiveLimit(options.maxReturnChars, "maxReturnChars");
  validatePositiveLimit(options.maxLineSpan, "maxLineSpan");

  async function getExactContext(input: GetExactContextInput): Promise<ExactContextResult | null> {
    const parsed = parseInput(input, options.maxReturnChars, options.maxLineSpan);
    if (parsed.kind !== "valid") {
      log(options, input, parsed.outcome, 0, false);
      return null;
    }

    let block: StoredContextBlock | null;
    try {
      block = await options.vault.retrieveBlock(parsed.identity);
    } catch (error) {
      if (error instanceof Error && error.message === "integrity check failed") {
        log(options, input, "integrity_failure", 0, false);
        return null;
      }
      throw error;
    }
    if (block === null) {
      log(options, input, "not_found", 0, false);
      return null;
    }

    const section = selectNarrowSection(block.authorisedOriginalContent, parsed.selector, {
      maxSearchChars: options.maxSearchChars,
      maxReturnChars: parsed.maxChars,
      maxLineSpan: options.maxLineSpan
    });
    if (section === null) {
      log(options, input, "not_found", 0, false, block);
      return null;
    }

    log(options, input, "ok", section.content.length, section.truncated, block);
    return {
      project_id: block.projectId,
      session_id: block.sessionId,
      block_id: block.blockId,
      source_label: block.sourceCategory,
      integrity_status: "verified",
      truncated: section.truncated,
      content: section.content
    };
  }

  return { getExactContext };
}

export function createLocalRetrievalMcpServer(service: RetrievalService): LocalRetrievalMcpServer {
  return {
    tools: [describeExactContextTool()],
    async callTool(call: LocalMcpToolCall): Promise<LocalMcpToolResult> {
      if (call.name !== exactContextToolName) {
        return {
          isError: true,
          content: [{ type: "text", text: "unknown tool" }]
        };
      }
      const result = await service.getExactContext(parseToolArguments(call.arguments));
      return {
        content: [{ type: "text", text: result === null ? "" : JSON.stringify(result) }]
      };
    }
  };
}

type Selector =
  | { readonly kind: "query"; readonly query: string }
  | { readonly kind: "lines"; readonly lineStart: number; readonly lineEnd: number };

type ParsedInput =
  | {
      readonly kind: "valid";
      readonly identity: ContextBlockIdentity;
      readonly selector: Selector;
      readonly maxChars: number;
    }
  | { readonly kind: "invalid"; readonly outcome: RetrievalOutcome };

interface SectionResult {
  readonly content: string;
  readonly truncated: boolean;
}

function parseInput(
  input: GetExactContextInput,
  maxReturnChars: number,
  maxLineSpan: number
): ParsedInput {
  try {
    rejectPathLike(input.project_id);
    rejectPathLike(input.session_id);
    rejectPathLike(input.block_id);
    assertProjectId(input.project_id);
    assertSessionId(input.session_id);
    assertContextBlockId(input.block_id);
  } catch {
    return { kind: "invalid", outcome: "invalid_input" };
  }

  if (!Number.isSafeInteger(input.max_chars) || input.max_chars <= 0) {
    return { kind: "invalid", outcome: "invalid_input" };
  }
  if (input.max_chars > maxReturnChars) {
    return { kind: "invalid", outcome: "oversized_request" };
  }

  const hasQuery = input.query !== undefined;
  const hasLines = input.line_start !== undefined || input.line_end !== undefined;
  if (hasQuery === hasLines) {
    return { kind: "invalid", outcome: "invalid_input" };
  }

  const selector = hasQuery
    ? parseQuerySelector(input.query)
    : parseLineSelector(input.line_start, input.line_end, maxLineSpan);
  if (selector === null) {
    return { kind: "invalid", outcome: "invalid_input" };
  }

  return {
    kind: "valid",
    identity: {
      projectId: input.project_id,
      sessionId: input.session_id,
      blockId: input.block_id
    },
    selector,
    maxChars: input.max_chars
  };
}

function parseQuerySelector(query: string | undefined): Selector | null {
  if (query === undefined || query.trim().length === 0 || query.length > 120) {
    return null;
  }
  if (looksLikeBroadRegex(query) || query.includes("\0")) {
    return null;
  }
  return { kind: "query", query };
}

function parseLineSelector(
  lineStart: number | undefined,
  lineEnd: number | undefined,
  maxLineSpan: number
): Selector | null {
  if (
    lineStart === undefined ||
    lineEnd === undefined ||
    !Number.isSafeInteger(lineStart) ||
    !Number.isSafeInteger(lineEnd) ||
    lineStart < 1 ||
    lineEnd < lineStart ||
    lineEnd - lineStart + 1 > maxLineSpan
  ) {
    return null;
  }
  return { kind: "lines", lineStart, lineEnd };
}

function selectNarrowSection(
  content: string,
  selector: Selector,
  limits: {
    readonly maxSearchChars: number;
    readonly maxReturnChars: number;
    readonly maxLineSpan: number;
  }
): SectionResult | null {
  if (selector.kind === "lines") {
    const lines = content.split(/\r?\n/);
    const selected = lines.slice(selector.lineStart - 1, selector.lineEnd).join("\n");
    if (selected.length === 0) {
      return null;
    }
    return truncate(selected, limits.maxReturnChars);
  }

  const searchWindow = content.slice(0, limits.maxSearchChars);
  const index = searchWindow.indexOf(selector.query);
  if (index < 0) {
    return null;
  }
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const nextNewline = content.indexOf("\n", index + selector.query.length);
  const lineEnd = nextNewline < 0 ? content.length : nextNewline;
  return truncate(content.slice(lineStart, lineEnd), limits.maxReturnChars);
}

function truncate(content: string, maxChars: number): SectionResult {
  if (content.length <= maxChars) {
    return { content, truncated: false };
  }
  return { content: content.slice(0, maxChars), truncated: true };
}

function parseToolArguments(value: unknown): GetExactContextInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalidToolInput();
  }
  const record = value as Record<string, unknown>;
  return {
    project_id: readToolString(record, "project_id"),
    session_id: readToolString(record, "session_id"),
    block_id: readToolString(record, "block_id"),
    query: readOptionalToolString(record, "query"),
    line_start: readOptionalToolNumber(record, "line_start"),
    line_end: readOptionalToolNumber(record, "line_end"),
    max_chars: readToolNumber(record, "max_chars")
  };
}

function invalidToolInput(): GetExactContextInput {
  return {
    project_id: "",
    session_id: "",
    block_id: "",
    query: "",
    max_chars: 0
  };
}

function readToolString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readOptionalToolString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readToolNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === "number" ? value : 0;
}

function readOptionalToolNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

function rejectPathLike(value: string): void {
  if (value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new Error("direct filesystem paths are not accepted");
  }
}

function looksLikeBroadRegex(query: string): boolean {
  return (
    query === ".*" ||
    query === ".+" ||
    query === "[\\s\\S]*" ||
    query === "(?s).*" ||
    /[.*+?()[\]{}|\\]/.test(query)
  );
}

function validatePositiveLimit(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function log(
  options: RetrievalServiceOptions,
  input: GetExactContextInput,
  outcome: RetrievalOutcome,
  returnedChars: number,
  truncated: boolean,
  block?: StoredContextBlock
): void {
  options.logger?.info({
    event: "exact_context_retrieval",
    projectId: safeLogId(input.project_id),
    sessionId: safeLogId(input.session_id),
    blockId: safeLogId(input.block_id),
    outcome,
    ...(block === undefined ? {} : { sourceCategory: block.sourceCategory }),
    returnedChars,
    truncated
  });
}

function safeLogId(value: string): string {
  return value.includes("/") || value.includes("\\") || value.includes("..") ? "invalid" : value;
}
