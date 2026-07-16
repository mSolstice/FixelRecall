import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

export type SyntheticOrigin = "synthetic";
export type HostKind = "codex" | "claude-code" | "both";
export type CacheIntensity = "low" | "medium" | "high" | "very-high";
export type Sensitivity = "low" | "medium" | "high" | "critical";
export type RiskPreference = "conservative" | "balanced" | "experimental";
export type WorkloadKind =
  | "repetitive_build_logs"
  | "long_prose_documentation"
  | "typescript_source"
  | "git_diff"
  | "shell_transcript"
  | "sql_migration"
  | "json_configuration"
  | "completed_tool_results"
  | "active_tool_state"
  | "malformed_tool_state"
  | "secret_heavy_error_logs"
  | "hindi_documentation"
  | "japanese_documentation"
  | "arabic_bidirectional_text"
  | "emoji_technical_symbols";

export interface SyntheticArtifact {
  readonly dataOrigin: SyntheticOrigin;
  readonly seed: number;
}

export interface SyntheticUserProfile extends SyntheticArtifact {
  readonly id: string;
  readonly label: string;
  readonly host: HostKind;
  readonly languages: readonly string[];
  readonly workloadMix: {
    readonly prose: number;
    readonly logs: number;
    readonly code: number;
    readonly commands: number;
    readonly toolState: number;
  };
  readonly cacheIntensity: CacheIntensity;
  readonly exactnessSensitivity: Sensitivity;
  readonly latencySensitivity: Exclude<Sensitivity, "critical">;
  readonly riskPreference: RiskPreference;
  readonly expectedVerdict: string;
}

export interface SyntheticWorkload extends SyntheticArtifact {
  readonly id: string;
  readonly kind: WorkloadKind;
  readonly label: string;
  readonly content: string;
  readonly expectedSafetyNotes: readonly string[];
}

export interface FakeSecretCanaries extends SyntheticArtifact {
  readonly openAIKey: string;
  readonly anthropicKey: string;
  readonly bearerToken: string;
  readonly privateKey: string;
  readonly password: string;
}

export interface SyntheticUsageDay {
  readonly dayIndex: number;
  readonly sessions: number;
  readonly requestsPerSession: number;
  readonly originalTokenEstimate: number;
  readonly eligibleTokenEstimate: number;
  readonly cachedTokens: number;
  readonly imageTokens: number;
  readonly addedLatencyMs: number;
  readonly retrievalCalls: number;
  readonly benchmarkOutcome: "pass" | "fail" | "neutral";
  readonly policyPreset: "Observe Only" | "Protect First" | "Save More" | "Lab Mode";
  readonly host: HostKind;
  readonly modelSimulator: "openai-synthetic" | "anthropic-synthetic";
}

export interface SyntheticUsageHistory extends SyntheticArtifact {
  readonly id: string;
  readonly days: readonly SyntheticUsageDay[];
}

export interface FakeProfileBundle extends SyntheticArtifact {
  readonly id: string;
  readonly status:
    | "valid"
    | "expired"
    | "revoked"
    | "unknown_signing_key"
    | "modified_payload"
    | "rollback_version"
    | "client_version_mismatch"
    | "renderer_mismatch"
    | "multilingual"
    | "provider_change_replacement";
  readonly signature: string;
  readonly keyId: string;
}

export interface FakePolicyBundle extends SyntheticArtifact {
  readonly id: string;
  readonly level: "organisation" | "team" | "repository" | "user";
  readonly preset: "Protect First" | "Save More" | "Audit Only" | "Lab Mode";
  readonly signatureStatus: "valid" | "invalid" | "expired" | "offline_cached";
  readonly mandatory: boolean;
}

export interface MultilingualCorpusEntry extends SyntheticArtifact {
  readonly id: string;
  readonly script: string;
  readonly language: string;
  readonly content: string;
}

export interface AuditEventFixture extends SyntheticArtifact {
  readonly id: string;
  readonly eventType:
    | "installation"
    | "compatibility_audit"
    | "policy_selection"
    | "block_decision"
    | "secret_detection"
    | "text_fallback"
    | "rendering"
    | "retrieval"
    | "benchmark"
    | "projection"
    | "badge_generation"
    | "provider_change"
    | "canary"
    | "policy_conflict"
    | "uninstall"
    | "tampered";
  readonly previousHash: string;
  readonly eventHash: string;
  readonly tampered: boolean;
}

export type FakeProviderScenario =
  | "normal"
  | "stream"
  | "tool_call"
  | "tool_output"
  | "image_ack"
  | "error_400"
  | "error_401"
  | "error_403"
  | "error_413"
  | "error_422"
  | "error_429"
  | "timeout"
  | "disconnect"
  | "changed_model";

export interface FakeProviderSimulator {
  readonly provider: "openai" | "anthropic";
  readonly url: string;
  close(): Promise<void>;
}

export interface FakeProviderOptions {
  readonly seed: number;
  readonly scenario?: FakeProviderScenario;
  readonly port?: number;
}

interface Rng {
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createSeededSyntheticUsers(seed: number): readonly SyntheticUserProfile[] {
  const rng = createRng(seed);
  const base = syntheticUserTemplates();
  return base.map((user, index) => ({
    ...user,
    dataOrigin: "synthetic",
    seed,
    label: `${user.label} ${rng.int(10, 99)}`,
    workloadMix: rotateMix(user.workloadMix, index, rng.int(0, 3))
  }));
}

export function createSeededWorkloads(seed: number): readonly SyntheticWorkload[] {
  return workloadTemplates().map((workload) => ({
    ...workload,
    dataOrigin: "synthetic",
    seed,
    content: `${workload.content}\n\nSYNTHETIC_SEED=${seed}`
  }));
}

export function createFakeSecretCanaries(seed: number): FakeSecretCanaries {
  return {
    dataOrigin: "synthetic",
    seed,
    openAIKey: `cd_test_openai_${String(seed).padStart(24, "0")}`,
    anthropicKey: `cd_test_anthropic_${String(seed).padStart(22, "0")}`,
    bearerToken: "Bearer cd_test_bearer_do_not_log",
    privateKey: [
      "-----BEGIN FAKE PRIVATE KEY-----",
      "CD_TEST_ONLY_NOT_A_REAL_KEY",
      "-----END FAKE PRIVATE KEY-----"
    ].join("\n"),
    password: "password=CD_TEST_PASSWORD_NEVER_STORE"
  };
}

export function createSyntheticUsageHistory(seed: number, days: 30 | 90): SyntheticUsageHistory {
  const rng = createRng(seed);
  return {
    dataOrigin: "synthetic",
    seed,
    id: `synthetic-usage-${seed}-${days}`,
    days: Array.from({ length: days }, (_, dayIndex) => {
      const sessions = rng.int(1, 5);
      const requestsPerSession = rng.int(2, 12);
      const originalTokenEstimate = rng.int(3_000, 35_000);
      const eligibleTokenEstimate = rng.int(
        500,
        Math.max(800, Math.floor(originalTokenEstimate * 0.55))
      );
      return {
        dayIndex,
        sessions,
        requestsPerSession,
        originalTokenEstimate,
        eligibleTokenEstimate,
        cachedTokens: rng.int(0, Math.floor(originalTokenEstimate * 0.8)),
        imageTokens: rng.int(0, Math.floor(eligibleTokenEstimate * 0.5)),
        addedLatencyMs: rng.int(0, 2_500),
        retrievalCalls: rng.int(0, 8),
        benchmarkOutcome: rng.pick(["pass", "fail", "neutral"]),
        policyPreset: rng.pick(["Observe Only", "Protect First", "Save More", "Lab Mode"]),
        host: rng.pick(["codex", "claude-code", "both"]),
        modelSimulator: rng.pick(["openai-synthetic", "anthropic-synthetic"])
      };
    })
  };
}

export function createFakeProfileBundles(seed: number): readonly FakeProfileBundle[] {
  const statuses: readonly FakeProfileBundle["status"][] = [
    "valid",
    "expired",
    "revoked",
    "unknown_signing_key",
    "modified_payload",
    "rollback_version",
    "client_version_mismatch",
    "renderer_mismatch",
    "multilingual",
    "provider_change_replacement"
  ];
  return statuses.map((status, index) => ({
    dataOrigin: "synthetic",
    seed,
    id: `synthetic-profile-${status}`,
    status,
    signature: `synthetic-signature-${seed}-${index}`,
    keyId: status === "unknown_signing_key" ? "synthetic-unknown-key" : "synthetic-test-key"
  }));
}

export function createFakePolicyBundles(seed: number): readonly FakePolicyBundle[] {
  return [
    {
      dataOrigin: "synthetic",
      seed,
      id: "org-protect-first",
      level: "organisation",
      preset: "Protect First",
      signatureStatus: "valid",
      mandatory: true
    },
    {
      dataOrigin: "synthetic",
      seed,
      id: "team-save-more",
      level: "team",
      preset: "Save More",
      signatureStatus: "valid",
      mandatory: false
    },
    {
      dataOrigin: "synthetic",
      seed,
      id: "repo-audit-only",
      level: "repository",
      preset: "Audit Only",
      signatureStatus: "valid",
      mandatory: false
    },
    {
      dataOrigin: "synthetic",
      seed,
      id: "user-lab-mode",
      level: "user",
      preset: "Lab Mode",
      signatureStatus: "valid",
      mandatory: false
    },
    {
      dataOrigin: "synthetic",
      seed,
      id: "expired-policy",
      level: "team",
      preset: "Protect First",
      signatureStatus: "expired",
      mandatory: true
    },
    {
      dataOrigin: "synthetic",
      seed,
      id: "invalid-signature-policy",
      level: "organisation",
      preset: "Protect First",
      signatureStatus: "invalid",
      mandatory: true
    },
    {
      dataOrigin: "synthetic",
      seed,
      id: "conflicting-mandatory-rules",
      level: "organisation",
      preset: "Protect First",
      signatureStatus: "valid",
      mandatory: true
    },
    {
      dataOrigin: "synthetic",
      seed,
      id: "offline-cached-policy",
      level: "team",
      preset: "Save More",
      signatureStatus: "offline_cached",
      mandatory: false
    }
  ];
}

export function createMultilingualCorpus(seed: number): readonly MultilingualCorpusEntry[] {
  const entries: readonly (readonly [string, string, string])[] = [
    ["latin", "English", "Synthetic documentation about context budgets."],
    ["devanagari", "Hindi", "यह सिंथेटिक दस्तावेज़ सुरक्षित परीक्षण के लिए है।"],
    ["japanese", "Japanese", "これは合成テスト用のドキュメントです。"],
    ["arabic", "Arabic", "هذا نص اصطناعي لاختبار الاتجاه ثنائي اللغة."],
    ["emoji-symbols", "Mixed", "Synthetic status: PASS ✅; latency <= 20ms; token Δ = 42."]
  ];
  return entries.map(([script, language, content]) => ({
    dataOrigin: "synthetic",
    seed,
    id: `synthetic-${script}`,
    script,
    language,
    content
  }));
}

export function createAuditEventFixtures(seed: number): readonly AuditEventFixture[] {
  const events: readonly AuditEventFixture["eventType"][] = [
    "installation",
    "compatibility_audit",
    "policy_selection",
    "block_decision",
    "secret_detection",
    "text_fallback",
    "rendering",
    "retrieval",
    "benchmark",
    "projection",
    "badge_generation",
    "provider_change",
    "canary",
    "policy_conflict",
    "uninstall",
    "tampered"
  ];
  let previousHash = `synthetic-root-${seed}`;
  return events.map((eventType, index) => {
    const eventHash = `synthetic-hash-${seed}-${index}-${eventType}`;
    const event = {
      dataOrigin: "synthetic" as const,
      seed,
      id: `audit-${eventType}`,
      eventType,
      previousHash,
      eventHash,
      tampered: eventType === "tampered"
    };
    previousHash = eventHash;
    return event;
  });
}

export async function startOpenAIFakeProvider(
  options: FakeProviderOptions
): Promise<FakeProviderSimulator> {
  return startFakeProvider("openai", options);
}

export async function startAnthropicFakeProvider(
  options: FakeProviderOptions
): Promise<FakeProviderSimulator> {
  return startFakeProvider("anthropic", options);
}

async function startFakeProvider(
  provider: "openai" | "anthropic",
  options: FakeProviderOptions
): Promise<FakeProviderSimulator> {
  const scenario = options.scenario ?? "normal";
  const server = http.createServer((request, response) => {
    void handleProviderRequest(provider, options.seed, scenario, request, response);
  });
  server.listen({ host: "127.0.0.1", port: options.port ?? 0 });
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("fake provider failed to bind to loopback");
  }
  return {
    provider,
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.close();
      await once(server, "close");
    }
  };
}

async function handleProviderRequest(
  provider: "openai" | "anthropic",
  seed: number,
  scenario: FakeProviderScenario,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  drainRequest(request);
  if (scenario === "timeout") {
    await delay(25);
  }
  if (scenario === "disconnect") {
    request.socket.destroy();
    return;
  }
  if (scenario.startsWith("error_")) {
    const status = Number(scenario.slice("error_".length));
    writeJson(response, status, {
      data_origin: "synthetic",
      seed,
      error: { type: "synthetic_provider_error", status }
    });
    return;
  }
  if (scenario === "stream") {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "x-context-diet-data-origin": "synthetic"
    });
    response.write(
      `data: ${JSON.stringify({ data_origin: "synthetic", seed, delta: "hello" })}\n\n`
    );
    response.write(
      `data: ${JSON.stringify({ data_origin: "synthetic", seed, delta: "done" })}\n\n`
    );
    response.end("data: [DONE]\n\n");
    return;
  }
  response.setHeader("x-context-diet-data-origin", "synthetic");
  if (scenario === "changed_model") {
    response.setHeader("x-synthetic-model-version", `${provider}-changed-${seed}`);
  }
  writeJson(
    response,
    200,
    provider === "openai" ? openAIResponse(seed, scenario) : anthropicResponse(seed, scenario)
  );
}

function openAIResponse(seed: number, scenario: FakeProviderScenario): Record<string, unknown> {
  return {
    data_origin: "synthetic",
    id: `resp_synthetic_${seed}`,
    object: "response",
    output: [
      {
        type: scenario === "tool_call" ? "function_call" : "message",
        content:
          scenario === "image_ack"
            ? [{ type: "output_text", text: "Synthetic image input acknowledged." }]
            : [{ type: "output_text", text: "Synthetic OpenAI-shaped response." }]
      }
    ],
    tool_output:
      scenario === "tool_output" ? { status: "synthetic tool output accepted" } : undefined
  };
}

function anthropicResponse(seed: number, scenario: FakeProviderScenario): Record<string, unknown> {
  return {
    data_origin: "synthetic",
    id: `msg_synthetic_${seed}`,
    type: "message",
    role: "assistant",
    content: [
      scenario === "tool_call"
        ? { type: "tool_use", id: "toolu_synthetic", name: "synthetic_tool", input: {} }
        : {
            type: "text",
            text:
              scenario === "image_ack"
                ? "Synthetic image block acknowledged."
                : "Synthetic Anthropic-shaped response."
          }
    ],
    cache_control: scenario === "tool_output" ? { type: "ephemeral" } : undefined,
    model_version:
      scenario === "changed_model" ? `anthropic-changed-${seed}` : "anthropic-synthetic"
  };
}

function writeJson(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function drainRequest(request: IncomingMessage): void {
  request.on("data", () => undefined);
}

function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (items) => items[Math.floor(next() * items.length)] as never
  };
}

function syntheticUserTemplates(): readonly Omit<SyntheticUserProfile, "seed" | "dataOrigin">[] {
  return [
    user(
      "u-log-heavy",
      "Log-heavy solo developer",
      "codex",
      ["en"],
      "low",
      "medium",
      "medium",
      "conservative",
      "RECOMMENDED",
      [10, 55, 5, 10, 20]
    ),
    user(
      "u-code-heavy",
      "Code-heavy security engineer",
      "claude-code",
      ["en"],
      "high",
      "critical",
      "high",
      "conservative",
      "AUDIT_ONLY",
      [5, 10, 55, 20, 10]
    ),
    user(
      "u-high-cache",
      "Highly cached documentation user",
      "both",
      ["en"],
      "very-high",
      "medium",
      "low",
      "balanced",
      "NOT_WORTH_USING",
      [70, 10, 5, 5, 10]
    ),
    user(
      "u-multilingual",
      "Multilingual developer",
      "claude-code",
      ["en", "hi", "ja"],
      "medium",
      "high",
      "medium",
      "balanced",
      "RETEST_REQUIRED",
      [45, 15, 10, 5, 25]
    ),
    user(
      "u-tool-heavy",
      "Tool-heavy agent builder",
      "codex",
      ["en"],
      "medium",
      "high",
      "medium",
      "balanced",
      "RECOMMENDED_WITH_RESTRICTIONS",
      [10, 15, 15, 10, 50]
    ),
    user(
      "u-team-policy",
      "Team-managed developer",
      "both",
      ["en"],
      "medium",
      "high",
      "medium",
      "conservative",
      "RECOMMENDED_WITH_RESTRICTIONS",
      [35, 20, 20, 10, 15]
    ),
    user(
      "u-provider-change",
      "Provider-change canary",
      "both",
      ["en"],
      "medium",
      "medium",
      "medium",
      "conservative",
      "RETEST_REQUIRED",
      [35, 25, 10, 10, 20]
    ),
    user(
      "u-adversarial-secret",
      "Secret-leak adversarial fixture",
      "both",
      ["en"],
      "low",
      "critical",
      "high",
      "conservative",
      "AUDIT_ONLY",
      [10, 50, 10, 10, 20]
    )
  ];
}

function user(
  id: string,
  label: string,
  host: HostKind,
  languages: readonly string[],
  cacheIntensity: CacheIntensity,
  exactnessSensitivity: Sensitivity,
  latencySensitivity: Exclude<Sensitivity, "critical">,
  riskPreference: RiskPreference,
  expectedVerdict: string,
  mix: readonly [number, number, number, number, number]
): Omit<SyntheticUserProfile, "seed" | "dataOrigin"> {
  return {
    id,
    label,
    host,
    languages,
    cacheIntensity,
    exactnessSensitivity,
    latencySensitivity,
    riskPreference,
    expectedVerdict,
    workloadMix: { prose: mix[0], logs: mix[1], code: mix[2], commands: mix[3], toolState: mix[4] }
  };
}

function rotateMix(
  mix: SyntheticUserProfile["workloadMix"],
  index: number,
  offset: number
): SyntheticUserProfile["workloadMix"] {
  return {
    prose: mix.prose + ((index + offset) % 2),
    logs: mix.logs,
    code: mix.code,
    commands: mix.commands,
    toolState: mix.toolState
  };
}

function workloadTemplates(): readonly Omit<SyntheticWorkload, "seed" | "dataOrigin">[] {
  return [
    workload("repetitive_build_logs", "Repetitive build logs", "SYNTHETIC build ok\n".repeat(5), [
      "old logs may be eligible"
    ]),
    workload(
      "long_prose_documentation",
      "Long prose documentation",
      "Synthetic docs explain safe context reduction in general terms.",
      ["gist-safe prose"]
    ),
    workload(
      "typescript_source",
      "TypeScript source",
      "export function syntheticAdd(a: number, b: number) { return a + b; }",
      ["code stays native"]
    ),
    workload(
      "git_diff",
      "Git diff",
      "diff --git a/synthetic.ts b/synthetic.ts\n+const synthetic = true;",
      ["diff stays native"]
    ),
    workload("shell_transcript", "Shell transcript", "$ pnpm test\nSYNTHETIC PASS", [
      "commands stay native"
    ]),
    workload(
      "sql_migration",
      "SQL migration",
      "CREATE TABLE synthetic_items (id TEXT PRIMARY KEY);",
      ["SQL stays native"]
    ),
    workload("json_configuration", "JSON configuration", '{"synthetic":true,"mode":"safe"}', [
      "JSON keys exact"
    ]),
    workload(
      "completed_tool_results",
      "Completed tool results",
      "Tool result: synthetic lookup completed.",
      ["completed old tool result may qualify"]
    ),
    workload(
      "active_tool_state",
      "Active tool state",
      "tool_call_id=synthetic-active awaiting result",
      ["active state stays native"]
    ),
    workload(
      "malformed_tool_state",
      "Malformed tool state",
      "{ tool_use: synthetic missing close",
      ["malformed state passes through"]
    ),
    workload(
      "secret_heavy_error_logs",
      "Secret-heavy error logs",
      "Error included cd_test_openai_000000000000000000000000",
      ["fake secret blocks rendering"]
    ),
    workload("hindi_documentation", "Hindi documentation", "यह सिंथेटिक हिंदी दस्तावेज़ है।", [
      "requires glyph profile"
    ]),
    workload(
      "japanese_documentation",
      "Japanese documentation",
      "これは合成された日本語文書です。",
      ["requires glyph profile"]
    ),
    workload("arabic_bidirectional_text", "Arabic bidirectional text", "هذا مستند عربي اصطناعي.", [
      "requires bidi profile"
    ]),
    workload(
      "emoji_technical_symbols",
      "Emoji and technical symbols",
      "Synthetic ✅ Δ tokens <= 42",
      ["requires symbol coverage"]
    )
  ];
}

function workload(
  kind: WorkloadKind,
  label: string,
  content: string,
  expectedSafetyNotes: readonly string[]
): Omit<SyntheticWorkload, "seed" | "dataOrigin"> {
  return { id: `workload-${kind}`, kind, label, content, expectedSafetyNotes };
}
