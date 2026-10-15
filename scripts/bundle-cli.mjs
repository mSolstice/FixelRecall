#!/usr/bin/env node
// Bundles the CLI and every @fixel-recall/* workspace package into one file, so the
// published package needs no other workspace package and no runtime dependencies.
// Output: packages/cli/bundle/index.js (the file the npm `bin` points at).

import { chmod, readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = join(root, "packages", "cli");
const outfile = join(cliDir, "bundle", "index.js");

// Map "@fixel-recall/core" -> packages/core/src/index.ts, for every workspace package.
const alias = {};
for (const dir of await readdir(join(root, "packages"))) {
  try {
    const manifest = JSON.parse(
      await readFile(join(root, "packages", dir, "package.json"), "utf8")
    );
    if (typeof manifest.name === "string" && manifest.name.startsWith("@fixel-recall/")) {
      alias[manifest.name] = join(root, "packages", dir, "src", "index.ts");
    }
  } catch {
    // not a package directory
  }
}

const { version } = JSON.parse(await readFile(join(cliDir, "package.json"), "utf8"));

await build({
  alias,
  bundle: true,
  define: { __FIXEL_RECALL_VERSION__: JSON.stringify(version) },
  entryPoints: [join(cliDir, "src", "index.ts")],
  format: "esm",
  legalComments: "none",
  outfile,
  platform: "node",
  target: "node24"
});

if (process.platform !== "win32") await chmod(outfile, 0o755);
const { size } = await stat(outfile);
console.log(
  `bundled ${Object.keys(alias).length} workspace packages -> ${outfile} (${(size / 1024).toFixed(0)} KB, v${version})`
);
