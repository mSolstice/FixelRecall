#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createFakeGateway } from "../../packages/proxy/dist/index.js";

const logs = [];
const gateway = createFakeGateway({ log: (event) => logs.push(event) });

await new Promise((resolve) => gateway.server.listen(0, "127.0.0.1", resolve));
const address = gateway.server.address();
if (address === null || typeof address === "string") {
  throw new Error("Expected loopback TCP address");
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const body = await readFile("tests/fixtures/openai/codex-responses-request.json", "utf8");

try {
  const response = await fetch(`${baseUrl}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: "Bearer fake-openai-smoke-key",
      "content-type": "application/json",
      "x-request-id": "smoke-openai"
    },
    body
  });

  const text = await response.text();
  if (response.status !== 200 || !text.includes("response.output_text.delta")) {
    throw new Error(`OpenAI fake route smoke failed with ${response.status}: ${text}`);
  }

  const serialisedLogs = JSON.stringify(logs);
  if (serialisedLogs.includes("fake-openai-smoke-key") || serialisedLogs.includes(body)) {
    throw new Error("OpenAI fake route smoke leaked a fake credential or raw body");
  }

  console.log(`PASS OpenAI fake gateway smoke: ${baseUrl}/v1/responses`);
} finally {
  await gateway.close();
}
