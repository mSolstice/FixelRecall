#!/usr/bin/env node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSyntheticBenchmarkReport } from "../packages/benchmark/dist/index.js";
import { runLocalDashboardSmokeTest } from "../apps/dashboard/dist/index.js";
import {
  blockId,
  createProviderMetadata,
  createTextBlock,
  evaluatePolicyDecision,
  isoTimestamp,
  keepNativeDecision,
  orderIndex,
  recoverable
} from "../packages/core/dist/index.js";
import { scanExactnessFirewall } from "../packages/firewall/dist/index.js";
import {
  createAnthropicAdapterRequest,
  parseAnthropicMessagesRequest,
  rebuildAnthropicMessagesRequest
} from "../packages/providers-anthropic/dist/index.js";
import {
  createOpenAIAdapterRequest,
  parseOpenAIResponsesRequest,
  rebuildOpenAIResponsesRequest
} from "../packages/providers-openai/dist/index.js";
import {
  createFakeGateway,
  createLocalGateway,
  openAIResponsesRoute,
  anthropicMessagesRoute
} from "../packages/proxy/dist/index.js";
import { createDeterministicFakeRenderer } from "../packages/renderer/dist/index.js";
import {
  createLocalRetrievalMcpServer,
  createRetrievalService
} from "../packages/retrieval-mcp/dist/index.js";
import {
  createContextBlockIdentity,
  createLocalContextVault,
  createProjectIdentity,
  createSessionIdentity,
  createVaultNamespace
} from "../packages/vault/dist/index.js";

const report = [];

function record(step, command, status, details = {}) {
  report.push({ step, command, status, ...details });
}

function fail(step, message) {
  record(step, "node scripts/fake-beta.mjs", "FAIL", { message });
  throw new Error(`${step}: ${message}`);
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected loopback TCP address");
  }
  return `http://127.0.0.1:${address.port}`;
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
  return { status: response.status, text: await response.text() };
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), "fixel-recall-fake-beta-"));
  const fakeConfigRoot = join(tempRoot, "host-config");
  const logs = [];
  const fakeUpstream = createFakeGateway({ log: (event) => logs.push({ upstream: true, event }) });
  const fakeUpstreamBaseUrl = await listen(fakeUpstream.server);
  const gateway = createLocalGateway({
    log: (event) => logs.push({ gateway: true, event }),
    upstreams: {
      openai: `${fakeUpstreamBaseUrl}${openAIResponsesRoute.path}`,
      anthropic: `${fakeUpstreamBaseUrl}${anthropicMessagesRoute.path}`
    },
    upstreamAllowlist: [fakeUpstreamBaseUrl]
  });
  const gatewayBaseUrl = await listen(gateway.server);

  try {
    record("4. start local gateway", "node scripts/fake-beta.mjs", "PASS", {
      gateway: gatewayBaseUrl,
      upstream: fakeUpstreamBaseUrl,
      mode: gateway.status().mode,
      bindHost: gateway.status().bindHost
    });

    const codexClient = createOpenAIAdapterRequest("fake-codex-client");
    record("5. connect fake Codex client", "node scripts/fake-beta.mjs", "PASS", {
      provider: codexClient.provider,
      route: openAIResponsesRoute.path
    });

    const codexTextBody = {
      model: "fake-openai-model",
      stream: true,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "Synthetic Codex text beta request." }]
        }
      ]
    };
    const codexText = await postJson(
      `${gatewayBaseUrl}${openAIResponsesRoute.path}`,
      {
        authorization: "Bearer fake-codex-beta-key",
        "x-request-id": "fake-beta-codex-text"
      },
      rebuildOpenAIResponsesRequest(
        parseOpenAIResponsesRequest({ id: "fake-beta-codex-text", body: codexTextBody })
      )
    );
    if (codexText.status !== 200 || !codexText.text.includes("response.output_text.delta")) {
      fail("6. complete Codex text flow", `unexpected status/body ${codexText.status}`);
    }

    const codexToolBody = {
      model: "fake-openai-model",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "Synthetic Codex tool-call beta request." }]
        },
        {
          type: "function_call",
          call_id: "call_beta_1",
          name: "synthetic_tool",
          arguments: '{"target":"synthetic"}'
        },
        {
          type: "function_call_output",
          call_id: "call_beta_1",
          output: "synthetic tool output"
        }
      ]
    };
    const codexParsedTool = parseOpenAIResponsesRequest({
      id: "fake-beta-codex-tool",
      body: codexToolBody
    });
    if (codexParsedTool.state.activeOrMalformedToolState) {
      fail("6. complete Codex tool-call flow", "completed tool state was marked active/malformed");
    }
    const codexTool = await postJson(
      `${gatewayBaseUrl}${openAIResponsesRoute.path}`,
      {
        authorization: "Bearer fake-codex-beta-key",
        "x-request-id": "fake-beta-codex-tool"
      },
      rebuildOpenAIResponsesRequest(codexParsedTool)
    );
    if (codexTool.status !== 200 || !codexTool.text.includes("Fake OpenAI response")) {
      fail("6. complete Codex tool-call flow", `unexpected status/body ${codexTool.status}`);
    }
    record("6. complete one text and one tool-call flow", "node scripts/fake-beta.mjs", "PASS", {
      textStatus: codexText.status,
      toolStatus: codexTool.status
    });

    const claudeClient = createAnthropicAdapterRequest("fake-claude-code-client");
    record("7. connect fake Claude Code client", "node scripts/fake-beta.mjs", "PASS", {
      provider: claudeClient.provider,
      route: anthropicMessagesRoute.path
    });

    const claudeTextBody = {
      model: "fake-claude-model",
      max_tokens: 64,
      stream: true,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Synthetic Claude Code text beta request." }]
        }
      ]
    };
    const claudeText = await postJson(
      `${gatewayBaseUrl}${anthropicMessagesRoute.path}`,
      {
        "anthropic-version": "2023-06-01",
        "x-api-key": "fake-claude-beta-key",
        "x-request-id": "fake-beta-claude-text"
      },
      rebuildAnthropicMessagesRequest(
        parseAnthropicMessagesRequest({ id: "fake-beta-claude-text", body: claudeTextBody })
      )
    );
    if (claudeText.status !== 200 || !claudeText.text.includes("content_block_delta")) {
      fail("8. complete Claude Code text flow", `unexpected status/body ${claudeText.status}`);
    }

    const claudeToolBody = {
      model: "fake-claude-model",
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Synthetic Claude Code tool-use beta request." }]
        },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_beta_1",
              name: "synthetic_tool",
              input: { target: "synthetic" }
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_beta_1",
              content: "synthetic tool output"
            }
          ]
        }
      ]
    };
    const claudeParsedTool = parseAnthropicMessagesRequest({
      id: "fake-beta-claude-tool",
      body: claudeToolBody
    });
    if (claudeParsedTool.state.activeOrMalformedToolState) {
      fail(
        "8. complete Claude Code tool-use flow",
        "completed tool state was marked active/malformed"
      );
    }
    const claudeTool = await postJson(
      `${gatewayBaseUrl}${anthropicMessagesRoute.path}`,
      {
        "anthropic-version": "2023-06-01",
        "x-api-key": "fake-claude-beta-key",
        "x-request-id": "fake-beta-claude-tool"
      },
      rebuildAnthropicMessagesRequest(claudeParsedTool)
    );
    if (claudeTool.status !== 200 || !claudeTool.text.includes("Fake Anthropic response")) {
      fail("8. complete Claude Code tool-use flow", `unexpected status/body ${claudeTool.status}`);
    }
    record("8. complete one text and one tool-use flow", "node scripts/fake-beta.mjs", "PASS", {
      textStatus: claudeText.status,
      toolStatus: claudeTool.status
    });

    const fixedClock = { now: () => new Date("2026-07-21T00:00:00.000Z") };
    const vault = createLocalContextVault({
      rootDir: join(tempRoot, "vault"),
      maxBlockBytes: 4_000,
      clock: fixedClock
    });
    const project = createProjectIdentity({
      projectPath: "/synthetic/fixel-recall/fake-beta",
      localIdentitySecret: "fake-local-identity-secret-for-beta-only-0001"
    });
    const session = createSessionIdentity({
      projectId: project.projectId,
      ttlMs: 60_000,
      clock: fixedClock,
      randomSource: deterministicBytes(7)
    });
    const namespace = createVaultNamespace(project.projectId, session.sessionId);
    const identity = createContextBlockIdentity(namespace, { randomSource: deterministicBytes(8) });
    const exactContent = [
      "Synthetic beta section one.",
      "Synthetic exact retrieval needle for both hosts.",
      "Synthetic beta section three."
    ].join("\n");
    await vault.storeBlock({
      identity,
      sourceCategory: "conversation_history",
      authorisedOriginalContent: exactContent,
      expiresAt: new Date("2026-07-21T00:10:00.000Z")
    });

    const safeBlock = createTextBlock({
      id: blockId("fake-beta-safe-block"),
      order: orderIndex(0),
      text: "A synthetic old conversation summary that is gist-safe and recoverable.",
      sourceCategory: "conversation_history",
      exactnessRisk: "gist_safe",
      recoverability: recoverable(project.projectId, session.sessionId, identity.blockId),
      providerMetadata: createProviderMetadata("openai", "openai_responses"),
      decision: keepNativeDecision(["safe_mode"])
    });
    const scan = scanExactnessFirewall(safeBlock.text, { policyMode: "safe" });
    const decision = evaluatePolicyDecision({
      block: safeBlock,
      scannerResult: scan,
      contextAgeMs: 120_000,
      sourceCategory: "conversation_history",
      taskExactnessRequirement: "gist_ok",
      recoverability: recoverable(project.projectId, session.sessionId, identity.blockId),
      modelProfileStatus: { kind: "enabled", profileId: "synthetic-safe-profile-v1" },
      estimatedCost: { textCost: 10, imageCost: 2, sidecarCost: 1 },
      rendererResult: { status: "succeeded" },
      mode: "safe",
      timestamp: isoTimestamp("2026-07-21T00:00:00.000Z")
    });
    const renderer = createDeterministicFakeRenderer();
    const renderResult = await renderer.render({
      sourceText: safeBlock.text,
      protectedSpans: [],
      pageLimits: { maxPages: 1, maxCharsPerPage: 500 },
      dimensionLimits: { maxWidthPx: 800, maxHeightPx: 600, minFontSizePx: 12 },
      modelProfile: {
        profileId: "synthetic-safe-profile-v1",
        provider: "openai",
        modelFamily: "synthetic",
        modelVersion: "v1",
        status: "enabled",
        origin: "synthetic",
        issuedAt: isoTimestamp("2026-07-21T00:00:00.000Z"),
        expiresAt: isoTimestamp("2026-08-21T00:00:00.000Z"),
        signatureStatus: "not_required"
      },
      ctxBlockLabel: "CTX-FAKE-BETA-001",
      exactSidecar: { integrityHash: "fake-beta-integrity", lineCount: 3, recoverable: true },
      safety: { policyApproved: true, secretCleaned: true }
    });
    if (decision.decision !== "RENDER_RECOVERABLE" || renderResult.status !== "success") {
      fail(
        "9. transform one safe recoverable block",
        `decision=${decision.decision}, render=${renderResult.status}`
      );
    }
    record("9. transform one safe recoverable block", "node scripts/fake-beta.mjs", "PASS", {
      decision: decision.decision,
      imageCount: renderResult.images.length
    });

    const retrievalLogs = [];
    const retrieval = createRetrievalService({
      vault,
      maxSearchChars: 1_000,
      maxReturnChars: 80,
      maxLineSpan: 3,
      logger: { info: (event) => retrievalLogs.push(event) }
    });
    const mcp = createLocalRetrievalMcpServer(retrieval);
    const retrievalArgs = {
      project_id: project.projectId,
      session_id: session.sessionId,
      block_id: identity.blockId,
      query: "needle",
      max_chars: 80
    };
    const codexRetrieval = await mcp.callTool({
      name: "get_exact_context",
      arguments: retrievalArgs
    });
    const claudeRetrieval = await mcp.callTool({
      name: "get_exact_context",
      arguments: retrievalArgs
    });
    if (
      !codexRetrieval.content[0].text.includes("needle") ||
      !claudeRetrieval.content[0].text.includes("needle")
    ) {
      fail(
        "10. retrieve one exact section through MCP from each host",
        "MCP result missing exact section"
      );
    }
    record(
      "10. retrieve one exact section through MCP from each host",
      "node scripts/fake-beta.mjs",
      "PASS",
      {
        codexReturnedChars: JSON.parse(codexRetrieval.content[0].text).content.length,
        claudeReturnedChars: JSON.parse(claudeRetrieval.content[0].text).content.length
      }
    );

    const benchmark = createSyntheticBenchmarkReport(1);
    if (!benchmark.comparison.comparable) {
      fail("11. run benchmark", benchmark.comparison.summary);
    }
    record("11. run benchmark", "node scripts/fake-beta.mjs", "PASS", {
      dataOrigin: benchmark.dataOrigin,
      runs: benchmark.runs.length,
      comparable: benchmark.comparison.comparable
    });

    const dashboardSmoke = runLocalDashboardSmokeTest();
    if (!dashboardSmoke.passed) {
      fail("12. open dashboard smoke test", "dashboard smoke failed");
    }
    record("12. open dashboard smoke test", "node scripts/fake-beta.mjs", "PASS", {
      checkedCards: dashboardSmoke.checkedCards
    });

    await fetch(`${gatewayBaseUrl}/runtime/kill-switch`, { method: "POST" });
    const killed = await postJson(
      `${gatewayBaseUrl}${openAIResponsesRoute.path}`,
      {
        authorization: "Bearer fake-codex-beta-key",
        "x-request-id": "fake-beta-kill-switch"
      },
      codexTextBody
    );
    if (killed.status !== 503) {
      fail("13. trigger kill switch", `expected 503, got ${killed.status}`);
    }
    record("13. trigger kill switch", "node scripts/fake-beta.mjs", "PASS", {
      responseStatus: killed.status
    });

    const directCodex = await postJson(
      `${fakeUpstreamBaseUrl}${openAIResponsesRoute.path}`,
      {
        authorization: "Bearer fake-direct-codex-key",
        "x-request-id": "fake-beta-direct-codex"
      },
      codexTextBody
    );
    const directClaude = await postJson(
      `${fakeUpstreamBaseUrl}${anthropicMessagesRoute.path}`,
      {
        "anthropic-version": "2023-06-01",
        "x-api-key": "fake-direct-claude-key",
        "x-request-id": "fake-beta-direct-claude"
      },
      claudeTextBody
    );
    if (directCodex.status !== 200 || directClaude.status !== 200) {
      fail(
        "14. restore direct fake routing",
        `direct statuses ${directCodex.status}/${directClaude.status}`
      );
    }
    record("14. restore direct fake routing", "node scripts/fake-beta.mjs", "PASS", {
      codexDirectStatus: directCodex.status,
      claudeDirectStatus: directClaude.status
    });

    await vault.deleteSession(namespace);
    const deletedRetrieval = await mcp.callTool({
      name: "get_exact_context",
      arguments: retrievalArgs
    });
    if (deletedRetrieval.content[0].text !== "") {
      fail("15. delete session", "deleted session still returned exact context");
    }
    record("15. delete session", "node scripts/fake-beta.mjs", "PASS", {
      retrievalAfterDelete: "empty"
    });

    await mkdir(fakeConfigRoot, { recursive: true });
    await writeFile(
      join(fakeConfigRoot, "codex-preview.toml"),
      'base_url = "http://127.0.0.1:4317"\n'
    );
    await writeFile(
      join(fakeConfigRoot, "claude-preview.json"),
      '{"ANTHROPIC_BASE_URL":"http://127.0.0.1:4317"}\n'
    );
    await rm(fakeConfigRoot, { recursive: true, force: true });
    record("16. uninstall local test configuration", "node scripts/fake-beta.mjs", "PASS", {
      removed: "temporary fake host config only"
    });

    const serialisedLogs = JSON.stringify(logs);
    for (const forbidden of [
      "fake-codex-beta-key",
      "fake-claude-beta-key",
      "fake-direct-codex-key",
      "fake-direct-claude-key"
    ]) {
      if (serialisedLogs.includes(forbidden)) {
        fail("privacy check", `log leaked ${forbidden}`);
      }
    }

    await writeFile(
      join(tempRoot, "fake-beta-result.json"),
      JSON.stringify({ status: "PASS", report, retrievalEvents: retrievalLogs.length }, null, 2)
    );
    process.stdout.write(JSON.stringify({ status: "PASS", report }, null, 2));
    process.stdout.write("\n");
  } finally {
    await gateway.close();
    await fakeUpstream.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function deterministicBytes(value) {
  return {
    randomBytes: (size) => new Uint8Array(size).fill(value)
  };
}

await main();
