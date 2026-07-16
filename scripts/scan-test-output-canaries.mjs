#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const canaries = JSON.parse(process.env.CONTEXT_DIET_TEST_CANARIES ?? "[]");
const roots = process.argv.slice(2).filter((value) => value !== "--");

if (!Array.isArray(canaries) || canaries.some((value) => typeof value !== "string")) {
  throw new Error("CONTEXT_DIET_TEST_CANARIES must be a JSON array of strings");
}

const scanRoots = roots.length === 0 ? [process.cwd()] : roots;
const leaks = [];

for (const root of scanRoots) {
  await scanPath(root);
}

if (leaks.length > 0) {
  console.error(`Canary leak detected:\n${leaks.join("\n")}`);
  process.exit(1);
}

console.log(`PASS test-output canary scan: ${scanRoots.join(", ")}`);

async function scanPath(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    if (path.includes("/.git") || path.includes("/node_modules")) {
      return;
    }
    const children = await readdir(path);
    for (const child of children) {
      await scanPath(join(path, child));
    }
    return;
  }
  if (!info.isFile() || info.size > 2_000_000) {
    return;
  }
  const content = await readFile(path, "utf8").catch(() => "");
  for (const canary of canaries) {
    if (content.includes(canary)) {
      leaks.push(`${path}:${canary}`);
    }
  }
}
