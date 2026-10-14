import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import {
  createLocalContextVault,
  createProjectIdentity,
  createSessionIdentity,
  createVaultNamespace
} from "@fixel-recall/vault";
import { createRetrievalService, createLocalRetrievalMcpServer } from "@fixel-recall/retrieval-mcp";
import { createLocalGateway, type StructuredLogEvent } from "./index.js";
import {
  createRetrievalLease,
  replaceSyntheticReferences,
  type ReferenceReplacementOptions
} from "./reference-replacement.js";

const oldText = "The garden was peaceful and the afternoon light filled the courtyard. "
  .repeat(100)
  .trim();
const messages = [
  { role: "user", content: oldText },
  { role: "assistant", content: "I have read the history." },
  { role: "user", content: "Please recall the old description when needed." }
];
function body(provider: "openai" | "anthropic", text = oldText): Buffer {
  const turns = messages.map((message, i) => (i === 0 ? { ...message, content: text } : message));
  return Buffer.from(
    JSON.stringify(
      provider === "openai"
        ? {
            model: "synthetic",
            instructions: "Keep exact details.",
            input: turns,
            tools: [{ type: "function", name: "get_exact_context", parameters: { type: "object" } }]
          }
        : {
            model: "synthetic",
            system: "Keep exact details.",
            max_tokens: 100,
            messages: turns,
            tools: [{ name: "get_exact_context", input_schema: { type: "object" } }]
          },
      null,
      2
    )
  );
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "fixel-reference-"));
  const project = createProjectIdentity({
    projectPath: root,
    localIdentitySecret: "synthetic-local-secret-for-test-only"
  });
  const session = createSessionIdentity({ projectId: project.projectId, ttlMs: 3600000 });
  const namespace = createVaultNamespace(project.projectId, session.sessionId);
  const vault = createLocalContextVault({ rootDir: root, maxBlockBytes: 30000 });
  const retrieval = createRetrievalService({
    vault,
    authority: namespace,
    maxReturnChars: 20000,
    maxSearchChars: 20000,
    maxLineSpan: 200
  });
  const options: ReferenceReplacementOptions = {
    lease: createRetrievalLease({ namespace, ttlMs: 60000 }),
    vault,
    retrieval,
    approvedSyntheticModels: ["synthetic"],
    expectedRetrievalOverheadBytes: 500
  };
  return { root, options, mcp: createLocalRetrievalMcpServer(retrieval) };
}
async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("missing address");
  return `http://127.0.0.1:${address.port}`;
}

describe.each(["openai", "anthropic"] as const)(
  "synthetic reference replacement %s",
  (provider) => {
    it("captures smaller requests, preserves current turns and recovers exact history through MCP", async () => {
      const { root, options, mcp } = await fixture();
      const captures: Buffer[] = [];
      const upstream = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        captures.push(Buffer.concat(chunks));
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ ok: true }));
      });
      const url = await listen(upstream);
      const logs: StructuredLogEvent[] = [];
      const gateway = createLocalGateway({
        upstreams: { [provider]: url },
        upstreamAllowlist: [url],
        experimentalReferenceReplacement: options,
        log: (event) => logs.push(event)
      });
      const gatewayUrl = await listen(gateway.server);
      try {
        const original = body(provider);
        const send = async () => {
          const response = await fetch(
            `${gatewayUrl}/v1/${provider === "openai" ? "responses" : "messages"}`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: "Bearer fake-canary",
                "x-api-key": "fake-canary"
              },
              body: original
            }
          );
          expect(await response.text()).toBe('{"ok":true}');
        };
        await send();
        const captured = captures[0]!;
        expect(captured.length).toBeLessThan(original.length);
        const rebuilt = JSON.parse(captured.toString());
        const turns = provider === "openai" ? rebuilt.input : rebuilt.messages;
        expect(turns.slice(1)).toEqual(messages.slice(1));
        expect(provider === "openai" ? rebuilt.instructions : rebuilt.system).toBe(
          "Keep exact details."
        );
        const args = JSON.parse(turns[0].content.slice(turns[0].content.indexOf("{")));
        const recovered = await mcp.callTool({ name: "get_exact_context", arguments: args });
        const exact = JSON.parse(recovered.content[0].text).content;
        expect(Buffer.from(exact).equals(Buffer.from(oldText))).toBe(true);
        // Deterministic task: the recovered history must support the same sentence count.
        expect(exact.split(".").length).toBe(oldText.split(".").length);
        console.info(
          JSON.stringify({
            evidenceOrigin: "synthetic",
            provider,
            bytesBefore: original.length,
            bytesAfter: captured.length,
            fullRecoveryBytes: Buffer.byteLength(recovered.content[0].text),
            taskPassed: true
          })
        );
        expect(JSON.stringify(logs)).not.toContain(oldText);
        expect(JSON.stringify(logs)).not.toContain("fake-canary");
        gateway.setBypass(true);
        await send();
        expect(captures[1]?.equals(original)).toBe(true);
        gateway.setKillSwitch(true);
        const stopped = await fetch(
          `${gatewayUrl}/v1/${provider === "openai" ? "responses" : "messages"}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: "Bearer fake",
              "x-api-key": "fake"
            },
            body: original
          }
        );
        expect(stopped.status).toBe(503);
        expect(captures).toHaveLength(2);
      } finally {
        await gateway.close();
        await new Promise<void>((resolve) => upstream.close(() => resolve()));
        await rm(root, { recursive: true, force: true });
      }
    });

    it("keeps original bytes for protected text, unknown models, failed recovery and negative savings", async () => {
      const { root, options } = await fixture();
      try {
        for (const text of [
          oldText + " /private/code.ts",
          oldText + " const x = 1;",
          oldText + " password=fake-secret-canary",
          oldText + " TICKET-123"
        ]) {
          const original = body(provider, text);
          expect((await replaceSyntheticReferences(original, provider, options)).body).toBe(
            original
          );
        }
        const original = body(provider);
        for (const changed of [
          { ...options, approvedSyntheticModels: [] },
          { ...options, expectedRetrievalOverheadBytes: 100000 },
          { ...options, retrieval: { getExactContext: async () => null } },
          {
            ...options,
            vault: {
              ...options.vault,
              storeBlock: async () => {
                throw new Error("fake failure");
              }
            }
          }
        ])
          expect((await replaceSyntheticReferences(original, provider, changed)).body).toBe(
            original
          );
        const unknown = Buffer.from('{ "model": "synthetic", "input": "unknown" }');
        expect((await replaceSyntheticReferences(unknown, provider, options)).body).toBe(unknown);
        // A registered vault block is insufficient if the host request does not expose retrieval.
        const noTool = JSON.parse(original.toString());
        delete noTool.tools;
        const missing = Buffer.from(JSON.stringify(noTool));
        expect((await replaceSyntheticReferences(missing, provider, options)).body).toBe(missing);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
);
