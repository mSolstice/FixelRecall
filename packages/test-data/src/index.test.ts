import { afterEach, describe, expect, it } from "vitest";

import http from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createAuditEventFixtures,
  createFakePolicyBundles,
  createFakeProfileBundles,
  createFakeSecretCanaries,
  createMultilingualCorpus,
  createSeededSyntheticUsers,
  createSeededWorkloads,
  createSyntheticUsageHistory,
  startAnthropicFakeProvider,
  startOpenAIFakeProvider,
  type FakeProviderSimulator,
  type SyntheticArtifact
} from "./index.js";

const runningProviders: FakeProviderSimulator[] = [];

afterEach(async () => {
  await Promise.all(runningProviders.splice(0).map((provider) => provider.close()));
});

describe("seeded synthetic factories", () => {
  it("generates deterministic users and workloads by seed", () => {
    expect(createSeededSyntheticUsers(42)).toEqual(createSeededSyntheticUsers(42));
    expect(createSeededSyntheticUsers(42)).not.toEqual(createSeededSyntheticUsers(43));
    expect(createSeededWorkloads(42)).toEqual(createSeededWorkloads(42));
    expect(createSeededWorkloads(42)).toHaveLength(15);
  });

  it("marks every generated fixture as synthetic", () => {
    const artifacts: readonly SyntheticArtifact[] = [
      ...createSeededSyntheticUsers(7),
      ...createSeededWorkloads(7),
      createFakeSecretCanaries(7),
      createSyntheticUsageHistory(7, 30),
      ...createFakeProfileBundles(7),
      ...createFakePolicyBundles(7),
      ...createMultilingualCorpus(7),
      ...createAuditEventFixtures(7)
    ];

    expect(artifacts.length).toBeGreaterThan(0);
    for (const artifact of artifacts) {
      expect(artifact.dataOrigin).toBe("synthetic");
      expect(artifact.seed).toBe(7);
    }
  });

  it("generates fake canaries without real credential values", () => {
    const canaries = createFakeSecretCanaries(123);

    expect(canaries.openAIKey).toContain("cd_test_openai");
    expect(canaries.anthropicKey).toContain("cd_test_anthropic");
    expect(canaries.bearerToken).toBe("Bearer cd_test_bearer_do_not_log");
    expect(canaries.privateKey).toContain("FAKE PRIVATE KEY");
    expect(JSON.stringify(canaries)).not.toContain("sk-");
  });

  it("generates 30 and 90 day usage histories", () => {
    expect(createSyntheticUsageHistory(5, 30).days).toHaveLength(30);
    expect(createSyntheticUsageHistory(5, 90).days).toHaveLength(90);
    expect(createSyntheticUsageHistory(5, 30)).toEqual(createSyntheticUsageHistory(5, 30));
  });

  it("includes required profile, policy, multilingual and audit fixtures", () => {
    expect(createFakeProfileBundles(9).map((profile) => profile.status)).toEqual(
      expect.arrayContaining([
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
      ])
    );
    expect(createFakePolicyBundles(9).map((policy) => policy.id)).toEqual(
      expect.arrayContaining([
        "org-protect-first",
        "team-save-more",
        "repo-audit-only",
        "user-lab-mode",
        "expired-policy",
        "invalid-signature-policy",
        "conflicting-mandatory-rules",
        "offline-cached-policy"
      ])
    );
    expect(createMultilingualCorpus(9).map((entry) => entry.script)).toEqual(
      expect.arrayContaining(["latin", "devanagari", "japanese", "arabic", "emoji-symbols"])
    );
    expect(createAuditEventFixtures(9).map((event) => event.eventType)).toContain("tampered");
  });

  it("keeps test outputs in a temporary test directory", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-diet-test-data-"));
    const outputPath = path.join(tempDir, "usage-history.json");

    await writeFile(
      outputPath,
      JSON.stringify(createSyntheticUsageHistory(11, 30), null, 2),
      "utf8"
    );

    expect(outputPath.startsWith(os.tmpdir())).toBe(true);
    expect(await readFile(outputPath, "utf8")).toContain('"dataOrigin": "synthetic"');
  });
});

describe("fake provider simulators", () => {
  it("binds OpenAI-shaped simulator to loopback and returns normal responses", async () => {
    const provider = await startOpenAIFakeProvider({ seed: 101 });
    runningProviders.push(provider);

    expect(provider.url).toMatch(/^http:\/\/127\.0\.0\.1:/);
    const body = await postJson(provider.url, "/v1/responses", { data_origin: "synthetic" });

    expect(body).toMatchObject({
      data_origin: "synthetic",
      object: "response"
    });
  });

  it("supports Anthropic-shaped streaming and error cases", async () => {
    const streaming = await startAnthropicFakeProvider({ seed: 102, scenario: "stream" });
    const erroring = await startAnthropicFakeProvider({ seed: 103, scenario: "error_429" });
    runningProviders.push(streaming, erroring);

    const streamText = await postText(streaming.url, "/v1/messages", {});
    const errorBody = await postJson(erroring.url, "/v1/messages", {});

    expect(streamText).toContain("data:");
    expect(streamText).toContain("[DONE]");
    expect(errorBody).toMatchObject({
      data_origin: "synthetic",
      error: { status: 429 }
    });
  });

  it("supports changed model and image acknowledgement scenarios", async () => {
    const changed = await startOpenAIFakeProvider({ seed: 104, scenario: "changed_model" });
    const imageAck = await startAnthropicFakeProvider({ seed: 105, scenario: "image_ack" });
    runningProviders.push(changed, imageAck);

    const changedResponse = await postRaw(changed.url, "/v1/responses", {});
    const imageBody = await postJson(imageAck.url, "/v1/messages", {});

    expect(changedResponse.headers["x-synthetic-model-version"]).toBe("openai-changed-104");
    expect(JSON.stringify(imageBody)).toContain("Synthetic image block acknowledged");
  });

  it("starts and shuts down cleanly", async () => {
    const provider = await startOpenAIFakeProvider({ seed: 106, scenario: "tool_call" });
    const url = provider.url;

    await provider.close();

    await expect(postJson(url, "/v1/responses", {})).rejects.toThrow();
  });
});

describe("network isolation", () => {
  it("blocks unexpected outbound connections while allowing loopback", async () => {
    const provider = await startOpenAIFakeProvider({ seed: 107 });
    runningProviders.push(provider);

    await expect(postJson(provider.url, "/v1/responses", {})).resolves.toMatchObject({
      data_origin: "synthetic"
    });
    await expect(postJson("http://203.0.113.1:9", "/unexpected", {}, 25)).rejects.toThrow(
      "outbound network blocked"
    );
  });
});

async function postJson(
  baseUrl: string,
  pathname: string,
  body: unknown,
  timeoutMs = 250
): Promise<Record<string, unknown>> {
  const response = await postRaw(baseUrl, pathname, body, timeoutMs);
  return JSON.parse(response.body) as Record<string, unknown>;
}

async function postText(
  baseUrl: string,
  pathname: string,
  body: unknown,
  timeoutMs = 250
): Promise<string> {
  return (await postRaw(baseUrl, pathname, body, timeoutMs)).body;
}

async function postRaw(
  baseUrl: string,
  pathname: string,
  body: unknown,
  timeoutMs = 250
): Promise<{ readonly body: string; readonly headers: http.IncomingHttpHeaders }> {
  const url = new URL(pathname, baseUrl);
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("outbound network blocked");
  }

  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: "POST",
        timeout: timeoutMs,
        headers: { "content-type": "application/json" }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({ body: Buffer.concat(chunks).toString("utf8"), headers: response.headers })
        );
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error("request timed out"));
    });
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}
