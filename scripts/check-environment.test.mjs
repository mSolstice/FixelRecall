import assert from "node:assert/strict";
import { test } from "node:test";

import { checkAllowedMajor, checkRequiredMajor, parseMajorVersion } from "./check-environment.mjs";

test("parseMajorVersion reads plain semantic versions", () => {
  assert.equal(parseMajorVersion("11.2.0"), 11);
});

test("parseMajorVersion reads Node-style versions", () => {
  assert.equal(parseMajorVersion("v24.4.1"), 24);
});

test("parseMajorVersion reads versions inside CLI output", () => {
  assert.equal(parseMajorVersion("git version 2.50.1"), 2);
});

test("parseMajorVersion returns null when no version exists", () => {
  assert.equal(parseMajorVersion("not installed"), null);
});

test("checkRequiredMajor passes matching major versions", () => {
  assert.deepEqual(checkRequiredMajor("Node.js", "v24.1.0", 24), {
    status: "PASS",
    label: "Node.js",
    detail: "Node.js major version is 24."
  });
});

test("checkRequiredMajor fails mismatched major versions", () => {
  assert.deepEqual(checkRequiredMajor("pnpm", "10.9.0", 11), {
    status: "FAIL",
    label: "pnpm",
    detail: "pnpm major version is 10; allowed major versions are 11."
  });
});

test("checkRequiredMajor fails unparsable versions", () => {
  assert.deepEqual(checkRequiredMajor("pnpm", "unknown", 11), {
    status: "FAIL",
    label: "pnpm",
    detail: "pnpm version could not be parsed. Install pnpm 11."
  });
});

test("checkAllowedMajor passes any allowed major version", () => {
  assert.deepEqual(checkAllowedMajor("Node.js", "v26.0.0", [24, 26]), {
    status: "PASS",
    label: "Node.js",
    detail: "Node.js major version is 26."
  });
});

test("checkAllowedMajor fails disallowed major versions", () => {
  assert.deepEqual(checkAllowedMajor("Node.js", "v23.11.0", [24, 26]), {
    status: "FAIL",
    label: "Node.js",
    detail: "Node.js major version is 23; allowed major versions are 24 or 26."
  });
});
