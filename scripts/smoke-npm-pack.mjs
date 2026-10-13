#!/usr/bin/env node
// "Test it like a stranger would": pack the CLI, then install the tarball into a clean
// folder with an empty HOME and an empty npm cache, with no repository on the path.
// Fails (non-zero exit) if anything a first-time user would hit is broken.

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stageDir = join(repo, "packages", "cli", "npm-package");
const work = mkdtempSync(join(tmpdir(), "fixel-recall-smoke-"));
const home = join(work, "home");
const app = join(work, "app");
const cache = join(work, "npm-cache");
const dirs = [home, app, cache, join(work, "pack")];
for (const dir of dirs) {
  execFileSync("mkdir", ["-p", dir]);
}

// A clean environment: nothing inherited that could hide a missing file.
const env = {
  HOME: home,
  PATH: process.env.PATH,
  npm_config_cache: cache,
  npm_config_update_notifier: "false"
};
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === "" ? "" : `\n      ${detail}`}`);
  if (!ok) failures += 1;
};
const run = (cmd, args, options = {}) =>
  spawnSync(cmd, args, { cwd: app, encoding: "utf8", env, ...options });

try {
  // 1. stage exactly what would be published, then pack it
  execFileSync("node", [join(repo, "scripts", "stage-npm-package.mjs")], { stdio: "ignore" });
  const packJson = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", join(work, "pack")],
    {
      cwd: stageDir,
      encoding: "utf8",
      env: { ...env, HOME: process.env.HOME }
    }
  );
  const packed = JSON.parse(packJson.slice(packJson.indexOf("[")))[0];
  const tarball = join(work, "pack", packed.filename);
  const files = packed.files.map((file) => file.path).sort();
  check(
    "tarball contains only bundle/index.js, README.md and package.json",
    JSON.stringify(files) === JSON.stringify(["README.md", "bundle/index.js", "package.json"]),
    files.join(", ")
  );
  console.log(`      ${packed.filename}  ${(packed.size / 1024).toFixed(0)} KB packed`);

  const manifest = JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], { encoding: "utf8" })
  );
  check(
    "published manifest has no runtime dependencies",
    manifest.dependencies === undefined,
    JSON.stringify(manifest.dependencies)
  );
  check(
    "published manifest has no workspace: specifiers",
    !JSON.stringify(manifest).includes("workspace:")
  );
  check(
    "published manifest declares bin and Node >=24",
    manifest.bin?.["fixel-recall"] === "./bundle/index.js" && manifest.engines?.node === ">=24"
  );

  // 2. install the tarball like a user
  execFileSync("npm", ["init", "-y"], { cwd: app, env, stdio: "ignore" });
  const install = run("npm", ["install", tarball, "--no-audit", "--no-fund"]);
  check("npm install of the tarball succeeds", install.status === 0, install.stderr);
  const bin = join(app, "node_modules", ".bin", "fixel-recall");
  check("npm links a symlinked bin", existsSync(bin) && lstatSync(bin).isSymbolicLink());

  // 3. the commands a stranger runs first
  const version = run(bin, ["--version"]);
  check(
    "--version works through the symlink",
    version.status === 0 && version.stdout.trim() === manifest.version,
    `${version.stdout} ${version.stderr}`
  );
  const help = run(bin, ["--help"]);
  check(
    "--help prints usage",
    help.status === 0 && help.stdout.includes("Usage: fixel-recall <command>")
  );
  const bare = run(bin, []);
  check(
    "no arguments prints help instead of an error",
    bare.status === 0 && bare.stdout.includes("Usage:")
  );

  // 4. npx-style: fetch into a throwaway cache and run, nothing installed first
  const npx = run("npm", [
    "exec",
    "--yes",
    `--package=${tarball}`,
    "--",
    "fixel-recall",
    "--version"
  ]);
  check(
    "npx-style run from the tarball works",
    npx.status === 0 && npx.stdout.trim() === manifest.version,
    `${npx.stdout} ${npx.stderr}`
  );

  // 5. setup is a dry run until you say yes (no TTY here, so no prompt)
  const dry = run(bin, ["setup", "codex"]);
  check(
    "setup without a terminal is a dry run and writes nothing",
    dry.status === 0 && dry.stdout.includes("Dry run") && !existsSync(join(home, ".fixel-recall")),
    dry.stdout + dry.stderr
  );

  // 6. --yes applies into HOME with no environment variable, then undoes it
  const apply = run(bin, ["setup", "codex", "--yes"]);
  const manifestPath = join(home, ".fixel-recall", "install-manifest.json");
  check(
    "setup --yes applies into $HOME without FIXEL_RECALL_CONFIG_ROOT",
    apply.status === 0 && existsSync(manifestPath),
    apply.stdout + apply.stderr
  );
  const rollback = run(bin, ["rollback", "--yes"]);
  check(
    "rollback --yes restores",
    rollback.status === 0 && rollback.stdout.includes("rollback"),
    rollback.stdout + rollback.stderr
  );

  // 7. the real prompt, through a genuine pseudo-terminal (so stdin/stdout are TTYs)
  const pty = `
import os, pty, select, sys, time
pid, fd = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
out, sent, end = b"", False, time.time() + 30
while time.time() < end:
    ready, _, _ = select.select([fd], [], [], 0.5)
    if not ready:
        continue
    try:
        data = os.read(fd, 4096)
    except OSError:
        break
    if not data:
        break
    out += data
    if not sent and b"(y/N)" in out:
        os.write(fd, (os.environ["ANSWER"] + "\\n").encode())
        sent = True
sys.stdout.write(out.decode("utf8", "replace"))
`;
  // A fresh HOME: rollback above keeps its manifest on purpose, which would mask the check.
  const home2 = join(work, "home2");
  execFileSync("mkdir", ["-p", home2]);
  const manifestPath2 = join(home2, ".fixel-recall", "install-manifest.json");
  const prompted = (answer, args) =>
    run("python3", ["-c", pty, bin, ...args], { env: { ...env, HOME: home2, ANSWER: answer } });
  const declined = prompted("n", ["setup", "codex"]);
  check(
    "interactive prompt appears and 'n' makes no changes",
    declined.stdout.includes("Apply these changes? (y/N)") &&
      declined.stdout.includes("No changes were made.") &&
      !existsSync(manifestPath2),
    declined.stdout + declined.stderr
  );
  const accepted = prompted("y", ["setup", "codex"]);
  check(
    "interactive prompt applies on 'y'",
    accepted.stdout.includes("Apply these changes? (y/N)") && existsSync(manifestPath2),
    accepted.stdout + accepted.stderr
  );

  // 8. what setup writes into Codex and Claude config must keep working after setup exits
  const written = (home, files) =>
    files
      .map((file) => (existsSync(join(home, file)) ? readFileSync(join(home, file), "utf8") : ""))
      .join("\n");
  const configFiles = [
    ".codex/config.toml",
    ".claude.json",
    ".fixel-recall/mcp.json",
    ".claude/settings.json"
  ];

  const home3 = join(work, "home3");
  execFileSync("mkdir", ["-p", home3]);
  const viaNpx = run(
    "npm",
    [
      "exec",
      "--yes",
      `--package=${tarball}`,
      "--",
      "fixel-recall",
      "setup",
      "both",
      "--mcp",
      "--yes"
    ],
    { env: { ...env, HOME: home3 } }
  );
  const npxText = written(home3, configFiles);
  check("setup through npx exits cleanly", viaNpx.status === 0, viaNpx.stdout + viaNpx.stderr);
  check(
    "npx run writes a pinned npx launcher, never a path into the npx cache",
    npxText.includes('command = "npx"') &&
      npxText.includes(`fixel-recall@${manifest.version}`) &&
      !/_npx/.test(npxText),
    npxText.slice(0, 600)
  );
  check(
    "npx run never writes the bare name that needs a global install",
    !/command = "fixel-recall"|"command": "fixel-recall"/.test(npxText)
  );

  const home4 = join(work, "home4");
  execFileSync("mkdir", ["-p", home4]);
  const viaBin = run(bin, ["setup", "codex", "--mcp", "--yes"], { env: { ...env, HOME: home4 } });
  const toml4 = written(home4, [".codex/config.toml"]);
  const recorded = /args = \["([^"]+)","mcp","retrieval"\]/.exec(toml4)?.[1];
  check(
    "a normal install records the real file, not the .bin symlink",
    viaBin.status === 0 &&
      recorded !== undefined &&
      existsSync(recorded) &&
      realpathSync(recorded) === recorded,
    `${recorded} | ${viaBin.stdout.slice(0, 200)}`
  );
  if (recorded !== undefined && existsSync(recorded)) {
    const init = JSON.stringify({ id: 1, jsonrpc: "2.0", method: "initialize", params: {} });
    const server = spawnSync("node", [recorded, "mcp", "retrieval"], {
      encoding: "utf8",
      env: { ...env, HOME: home4 },
      input: `${init}\n`,
      timeout: 20000
    });
    check(
      "the recorded command starts the MCP server and it answers initialize",
      server.stdout.includes("fixel-recall-retrieval"),
      server.stdout + server.stderr
    );
  }

  check(
    "nothing was written outside the isolated HOME",
    readdirSync(work).sort().join() === "app,home,home2,home3,home4,npm-cache,pack"
  );
} finally {
  rmSync(work, { force: true, recursive: true });
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
