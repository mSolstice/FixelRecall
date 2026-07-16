#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createSyntheticBenchmarkArtifacts } from "../packages/benchmark/dist/index.js";

const outputDirectory = valueAfter("--output") ?? "artifacts/context-diet-synthetic-benchmark";
const seed = Number(valueAfter("--seed") ?? "1");

if (!Number.isInteger(seed) || seed < 0) {
  throw new Error("Synthetic benchmark seed must be a non-negative integer.");
}

const artifacts = createSyntheticBenchmarkArtifacts(seed);
const badgesDirectory = join(outputDirectory, "badges");

await mkdir(badgesDirectory, { recursive: true });
await writeFile(
  join(outputDirectory, "context-diet-synthetic-benchmark.evidence.json"),
  `${JSON.stringify(artifacts.evidence, null, 2)}\n`,
  "utf8"
);
await writeFile(
  join(outputDirectory, "context-diet-synthetic-benchmark.summary.md"),
  `${artifacts.markdownSummary}\n`,
  "utf8"
);
await writeFile(
  join(outputDirectory, "context-diet-synthetic-benchmark.pr-comment.md"),
  `${artifacts.pullRequestCommentText}\n`,
  "utf8"
);
await writeFile(
  join(outputDirectory, "README-embed-instructions.md"),
  `${artifacts.readmeEmbedInstructions}\n`,
  "utf8"
);
await writeFile(
  join(badgesDirectory, "context-diet-benchmark.svg"),
  `${artifacts.badges.benchmark_passing}\n`,
  "utf8"
);
await writeFile(
  join(badgesDirectory, "context-diet-input-reduction.svg"),
  `${artifacts.badges.synthetic_input_reduction}\n`,
  "utf8"
);
await writeFile(
  join(badgesDirectory, "context-diet-protected-imaged.svg"),
  `${artifacts.badges.protected_values_imaged}\n`,
  "utf8"
);
await writeFile(
  join(badgesDirectory, "context-diet-compatibility.svg"),
  `${artifacts.badges.compatibility_status}\n`,
  "utf8"
);

if (process.env.GITHUB_STEP_SUMMARY !== undefined) {
  await writeFile(process.env.GITHUB_STEP_SUMMARY, `${artifacts.markdownSummary}\n`, {
    encoding: "utf8",
    flag: "a"
  });
}

console.log(`Wrote synthetic benchmark artifacts to ${outputDirectory}`);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
