#!/usr/bin/env node
// Builds the exact directory that gets published: packages/cli/npm-package/
//   bundle/index.js  - the CLI and all workspace code in one file
//   README.md
//   package.json     - the CLI manifest minus dev-only fields (workspace: links, build scripts)
// Publish from that directory so the manifest on npm is clean and self-contained.

import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = join(root, "packages", "cli");
const stage = join(cliDir, "npm-package");

execFileSync("node", [join(root, "scripts", "bundle-cli.mjs")], { stdio: "inherit" });

await rm(stage, { force: true, recursive: true });
await mkdir(join(stage, "bundle"), { recursive: true });
await copyFile(join(cliDir, "bundle", "index.js"), join(stage, "bundle", "index.js"));
await copyFile(join(cliDir, "README.md"), join(stage, "README.md"));

const manifest = JSON.parse(await readFile(join(cliDir, "package.json"), "utf8"));
delete manifest.devDependencies;
delete manifest.scripts;
await writeFile(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`staged ${manifest.name}@${manifest.version} -> ${stage}`);
