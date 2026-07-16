#!/usr/bin/env node

import { existsSync } from "node:fs";

const requiredPaths = [
  "skill-source/context-diet/SKILL.md",
  ".agents/skills/context-diet/SKILL.md",
  ".claude/skills/context-diet/SKILL.md"
];

const missing = requiredPaths.filter((path) => !existsSync(path));

if (missing.length > 0) {
  console.error(`FAIL skill drift placeholder: missing ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("PASS skill drift placeholder: canonical and generated skill files exist");
}
