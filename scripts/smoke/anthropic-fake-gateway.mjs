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
const body = await readFile("tests/fixtures/anthropic/claude-messages-request.json", "utf8");

try {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": "fake-anthropic-smoke-key",
      "x-request-id": "smoke-anthropic"
    },
    body
  });

  const text = await response.text();
  if (response.status !== 200 || !text.includes("content_block_delta")) {
    throw new Error(`Anthropic fake route smoke failed with ${response.status}: ${text}`);
  }

  const serialisedLogs = JSON.stringify(logs);
  if (serialisedLogs.includes("fake-anthropic-smoke-key") || serialisedLogs.includes(body)) {
    throw new Error("Anthropic fake route smoke leaked a fake credential or raw body");
  }

  console.log(`PASS Anthropic fake gateway smoke: ${baseUrl}/v1/messages`);
} finally {
  await gateway.close();
}
