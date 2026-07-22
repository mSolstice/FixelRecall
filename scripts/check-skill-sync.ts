#!/usr/bin/env node

import { runSkillSyncCli } from "./sync-skills.ts";

process.exitCode = await runSkillSyncCli(true);
