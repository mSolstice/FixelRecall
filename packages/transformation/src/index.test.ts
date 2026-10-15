import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { createLocalGateway } from "../../proxy/src/index.js";
import { describe, it, expect } from "vitest";
import { isoTimestamp } from "@fixel-recall/core";
import {
  createLocalContextVault,
  createProjectIdentity,
  createSessionIdentity,
  createVaultNamespace
} from "@fixel-recall/vault";
import { createPxpipeCompatibleRenderer } from "@fixel-recall/renderer";
import {
  createTransformationPipeline,
  deduplicateLogs,
  reconstructLogs,
  type TransformationOptions
} from "./index.js";

const template = {
  literals: [
    "Routine historical worker observation recorded successfully for component ",
    " with current state ",
    "."
  ]
};
const logs = Array.from(
  { length: 800 },
  () => `${template.literals[0]}worker${template.literals[1]}ready.\r\n`
).join("");
const prose = "The garden was quiet and the afternoon light filled the courtyard. ".repeat(10);

describe("exact log encoding", () => {
  it("preserves order, duplicates, Unicode, pipes and line endings", () => {
    const text = "prefix a|雪 suffix\r\nprefix  suffix\nprefix spaces  suffix";
    const sheet = deduplicateLogs(text, { literals: ["prefix ", " suffix"] });
    expect(sheet).not.toBeNull();
    expect(reconstructLogs(sheet!)).toBe(text);
  });
  it("rejects unmatched, critical and multiline input", () => {
    for (const text of [logs + "unknown", logs + "ERROR failure\n", "a\nb\nc\n"]) {
      expect(deduplicateLogs(text, template)).toBeNull();
    }
  });
});

describe.each(["openai", "anthropic"] as const)("combined pipeline %s", (provider) => {
  async function fixture() {
    const root = await mkdtemp(join(tmpdir(), "fixel-transform-"));
    const project = createProjectIdentity({
      projectPath: root,
      localIdentitySecret: "synthetic-test-only-local-secret"
    });
    const session = createSessionIdentity({ projectId: project.projectId, ttlMs: 3600000 });
    const namespace = createVaultNamespace(project.projectId, session.sessionId);
    const vault = createLocalContextVault({ rootDir: root, maxBlockBytes: 100000 });
    const options: TransformationOptions = {
      namespace,
      vault,
      renderer: createPxpipeCompatibleRenderer(),
      model: "synthetic",
      profile: {
        profileId: "synthetic",
        provider,
        modelFamily: "synthetic",
        status: "enabled",
        origin: "synthetic",
        issuedAt: isoTimestamp(new Date().toISOString()),
        expiresAt: isoTimestamp(new Date(Date.now() + 3600000).toISOString())
      },
      renderLimits: {
        pageLimits: { maxPages: 1, maxCharsPerPage: 20000 },
        dimensionLimits: { maxWidthPx: 1568, maxHeightPx: 728, minFontSizePx: 4 }
      },
      approvedLogTemplates: [template],
      structuredLogInstructionsRegistered: true,
      visionSupported: true,
      classify: (index) => (index === 0 ? "historical_log" : "historical_prose"),
      estimateCost: (body) => body.length,
      estimateImageCosts: () => ({ textCost: 10000, imageCost: 100, sidecarCost: 100 }),
      verifyRecovery: async (identity, original) => {
        const record = await vault.retrieveBlock({
          ...namespace,
          blockId: identity.blockId as Parameters<typeof vault.retrieveBlock>[0]["blockId"]
        });
        return record?.authorisedOriginalContent === original;
      }
    };
    const turns = [
      { role: "user", content: logs },
      { role: "user", content: prose },
      { role: "assistant", content: "Acknowledged." },
      { role: "user", content: "Current exact request /src/auth.ts" }
    ];
    const request = Buffer.from(
      JSON.stringify(
        provider === "openai"
          ? { model: "synthetic", instructions: "Keep exact.", input: turns }
          : { model: "synthetic", system: "Keep exact.", max_tokens: 100, messages: turns }
      )
    );
    return { root, options, request, turns };
  }
  it("combines exact rows and real PNG images while preserving current turns", async () => {
    const f = await fixture();
    try {
      const result = await createTransformationPipeline(f.options)(
        f.request,
        provider,
        new AbortController().signal
      );
      expect(result.body.equals(f.request)).toBe(false);
      expect(result.audit).toMatchObject({
        outcome: "transformed",
        strategy: "mixed",
        blocksConsidered: 2,
        blocksTransformed: 2
      });
      const rebuilt = JSON.parse(result.body.toString());
      const turns = provider === "openai" ? rebuilt.input : rebuilt.messages;
      expect(turns.slice(-2)).toEqual(f.turns.slice(-2));
      expect(turns[0].content).toContain("fixel-log-v1");
      expect(turns[1].content[1].type).toBe(provider === "openai" ? "input_image" : "image");
      expect(result.body.length).toBeLessThan(f.request.length);
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });
  it("forwards mixed content through a capture gateway, with bypass and kill-switch protection", async () => {
    const f = await fixture();
    const captures: Buffer[] = [];
    const upstream = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const captured = Buffer.concat(chunks);
      expect(req.headers["content-length"]).toBe(String(captured.length));
      captures.push(captured);
      res.end("ok");
    });
    const listen = async (server: Server) => {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing address");
      return `http://127.0.0.1:${address.port}`;
    };
    const url = await listen(upstream);
    const events: Parameters<NonNullable<Parameters<typeof createLocalGateway>[0]["log"]>>[0][] =
      [];
    const gateway = createLocalGateway({
      upstreams: { [provider]: url },
      upstreamAllowlist: [url],
      transformRequest: createTransformationPipeline(f.options),
      log: (event) => events.push(event)
    });
    try {
      const base = await listen(gateway.server);
      const send = () =>
        fetch(`${base}/v1/${provider === "openai" ? "responses" : "messages"}`, {
          method: "POST",
          headers: {
            authorization: "Bearer fake",
            "x-api-key": "fake",
            "content-type": "application/json"
          },
          body: f.request
        });
      expect(await (await send()).text()).toBe("ok");
      expect(captures[0]!.equals(f.request)).toBe(false);
      expect(events[0]?.transformation).toMatchObject({
        outcome: "transformed",
        strategy: "mixed",
        blocksConsidered: 2,
        blocksTransformed: 2
      });
      gateway.setBypass(true);
      expect(await (await send()).text()).toBe("ok");
      expect(captures[1]!.equals(f.request)).toBe(true);
      gateway.setKillSwitch(true);
      expect((await send()).status).toBe(503);
      expect(captures).toHaveLength(2);
    } finally {
      await gateway.close();
      upstream.closeAllConnections();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
      await rm(f.root, { recursive: true, force: true });
    }
  });
  it("preserves original bytes on renderer, recovery, vault, profile and cost failures", async () => {
    const f = await fixture();
    try {
      const failures: TransformationOptions[] = [
        {
          ...f.options,
          renderer: {
            render: async () => {
              throw new Error("fake renderer failure");
            }
          }
        },
        { ...f.options, verifyRecovery: async () => false },
        {
          ...f.options,
          vault: {
            ...f.options.vault,
            storeBlock: async () => {
              throw new Error("fake vault failure");
            }
          }
        },
        { ...f.options, model: "other" },
        { ...f.options, profile: { ...f.options.profile, status: "expired" } },
        { ...f.options, estimateCost: () => 1 }
      ];
      for (const options of failures)
        expect(
          await createTransformationPipeline(options)(
            f.request,
            provider,
            new AbortController().signal
          )
        ).toMatchObject({ body: f.request, audit: { outcome: "original" } });
      const abort = new AbortController();
      abort.abort();
      expect(
        await createTransformationPipeline(f.options)(f.request, provider, abort.signal)
      ).toMatchObject({ body: f.request, audit: { outcome: "original" } });
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });
  it("does not cross-fallback between template and image strategies", async () => {
    const f = await fixture();
    let renderCalls = 0;
    try {
      const logResult = await createTransformationPipeline({
        ...f.options,
        approvedLogTemplates: [],
        classify: () => "historical_log",
        renderer: {
          render: async (input) => {
            renderCalls += 1;
            return f.options.renderer.render(input);
          }
        }
      })(f.request, provider, new AbortController().signal);
      expect(logResult.body).toBe(f.request);
      expect(logResult.audit.reasonCodes).toContain("template_parse_failed_keep_native");
      expect(renderCalls).toBe(0);

      const imageResult = await createTransformationPipeline({
        ...f.options,
        approvedLogTemplates: [template],
        classify: () => "historical_prose",
        renderer: {
          render: async () => {
            throw new Error("synthetic renderer failure");
          }
        }
      })(f.request, provider, new AbortController().signal);
      expect(imageResult.body).toBe(f.request);
      expect(imageResult.audit.strategy).toBe("native");
      expect(imageResult.audit.blocksTransformed).toBe(0);
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });
});
