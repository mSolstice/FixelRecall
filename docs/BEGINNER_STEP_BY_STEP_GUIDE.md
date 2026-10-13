# Fixel Recall Beginner Build Guide

This guide assumes you are not a programmer.

You do not need to understand every line of code. You do need to follow the order, check the results
and avoid skipping red warnings.

Think of the coding agent as a junior engineering team. You are the product owner. Your job is to
give one clear task, ask for proof, save the working checkpoint, and only then move forward.

# Part A: What you need before starting

## 1. A computer

Recommended:

- macOS, or
- Linux, or
- Windows with WSL 2

macOS is the easiest starting point for your current setup.

## 2. Install Git

Git is a save-history system for code.

Check whether it is installed:

```bash
git --version
```

A version number means it is installed.

## 3. Install Node.js 24 LTS or Node.js 26

Node.js runs the Fixel Recall service.

Install the current Node.js 24 LTS release from the official Node.js website, or use Node.js 26 if
that is the version already available on your machine.

Check:

```bash
node --version
```

The answer should begin with `v24` or `v26`.

## 4. Install pnpm 11

pnpm installs and manages project packages.

Run:

```bash
npm install --global corepack@latest
corepack enable pnpm
corepack use pnpm@latest-11
```

Check:

```bash
pnpm --version
```

The answer should begin with `11`.

## 5. Install Codex and Claude Code

You can build with either tool, but both must be used for compatibility testing later.

Confirm Codex:

```bash
codex --version
```

Confirm Claude Code:

```bash
claude --version
```

Do not worry if one is not installed on Day 1. Install both before the dual-platform transport
tests.

# Part B: Create the project folder

## 1. Make a new folder

In Terminal:

```bash
mkdir fixel-recall
cd fixel-recall
```

## 2. Start Git

```bash
git init
```

## 3. Copy this build pack into the folder

Copy all files and hidden folders from the downloaded pack.

Your folder should contain:

```text
AGENTS.md
CLAUDE.md
README.md
docs/
skill-source/
.agents/
.claude/
```

On macOS, hidden folders begin with a dot. Finder may hide them.

Press:

```text
Command + Shift + .
```

to show hidden files.

## 4. Check the files

```bash
find . -maxdepth 3 -type f | sort
```

You should see the blueprint and build prompt files.

## 5. Make the first save point

```bash
git add .
git commit -m "Add Fixel Recall build pack"
```

If Git asks for your name or email, follow the message it prints and run the commit again.

# Part C: Open the project in your coding agent

## Codex

Open the `fixel-recall` folder in the editor that has Codex, or run Codex from the project folder.

Ask:

```text
Tell me the repository root and list the project instruction files you loaded. Do not edit anything.
```

It should mention `AGENTS.md`.

## Claude Code

From the same folder:

```bash
claude
```

Ask:

```text
Tell me the repository root and list the project instruction files you loaded. Do not edit anything.
```

It should mention `CLAUDE.md` and the imported `AGENTS.md`.

In Claude Code, you can also inspect memory loading using its memory command.

# Part D: How to run the build prompts

Open:

`docs/UPDATED_BUILD_PROMPTS_CODEX_AND_CLAUDE.md`

Start with Prompt 0.

Copy only the text inside that prompt's copy box.

Paste it into Codex or Claude Code.

## After the agent finishes

Check five things:

1. Did it list the files it changed?
2. Did it run the required commands?
3. Did it say which tests passed?
4. Did it report any warning or blocker?
5. Did it stop at the requested checkpoint?

If the answer says a test failed, do not move forward.

Paste:

```text
Fix the failed checks without changing the approved scope. Explain the root cause, make the smallest fix, rerun all checks required by this prompt, and report the exact result.
```

## Save every working checkpoint

After a prompt passes:

```bash
git status
git add .
git commit -m "Complete prompt NUMBER: SHORT DESCRIPTION"
```

Example:

```bash
git commit -m "Complete prompt 2: scaffold monorepo"
```

# Part E: Which coding agent should you use?

You can use either one to perform most build prompts.

A practical method:

- Use Codex for Prompt 0.
- Use Claude Code to review Prompt 0.
- Use one main tool for the next feature.
- Use the other tool after every three prompts for a review.

Do not let both edit the same files at the same time.

That creates conflicting changes.

# Part F: The most important early test

Before building the renderer, Fixel Recall must prove that requests can travel through the local
gateway.

This is Prompt 3.

Why?

Because Fixel Recall only works when it sits between:

```text
Codex or Claude Code
and
OpenAI or Anthropic
```

The skill alone cannot do that.

Prompt 3 uses fake providers. It should not need a real API key.

Do not continue to the renderer until:

- Codex fake routing passes
- Claude Code fake routing passes
- Streaming passes
- Logs contain no fake credential value

# Part G: When real API keys are allowed

Not during the first prompts.

Use real provider access only after:

- Fake gateway tests pass
- Header redaction tests pass
- Upstream allowlist exists
- Kill switch works
- You understand how to restore direct routing

Never paste an API key into:

- Chat
- Markdown files
- Source files
- Test fixtures
- Screenshots
- Git commits

Use environment variables or the provider's approved credential method.

# Part H: How the files work

## `AGENTS.md`

Codex reads this as permanent project guidance.

Do not put the full blueprint here. Keep it short.

## `CLAUDE.md`

Claude Code reads this file.

It imports `AGENTS.md`, so shared rules live in one place.

## Blueprint

The blueprint is the long product document.

The agent reads it for major work.

## Architecture

This prevents the agent from mixing provider code into the core engine.

## Acceptance criteria

This is the exam paper. A feature has to pass these checks.

## Security model

This tells the agent what could go badly wrong.

## Decisions

This stops a later prompt from casually undoing earlier architecture.

## Skill source

This is the one editable skill.

Later, a script copies it into the Codex and Claude skill folders.

# Part I: Red flags

Stop and ask for a fix when the agent says:

- "I skipped tests."
- "This should probably work."
- "I mocked the second provider for now."
- "We can add Claude later."
- "I logged the body for easier debugging."
- "I stored the API key in config."
- "I compressed code because it saved more."
- "The renderer failed, so I removed that block."
- "I could not compare runs, but estimated 70% savings."
- "The skill itself intercepts the request."

Those are not small issues. They break the product promise.

# Part J: Simple review prompt

Use this after every three or four build prompts:

```text
Review all changes since the last checkpoint as a strict senior engineer.

Read AGENTS.md, CLAUDE.md, docs/ARCHITECTURE.md, docs/SECURITY_MODEL.md, docs/DUAL_PLATFORM_COMPATIBILITY.md and docs/ACCEPTANCE_CRITERIA.md.

Look for:
1. Codex-only or Claude-only assumptions
2. Provider wire types leaking into the core
3. Missing failure-path tests
4. Raw body or credential logging
5. Exact values being made render-eligible
6. Unknown input being modified
7. Fake or unsupported savings claims
8. Skill-source drift

Do not make broad refactors first. List findings by severity, show evidence, then fix critical and high findings. Rerun all checks and report the results.
```

# Part K: How to undo a bad step

See recent commits:

```bash
git log --oneline -10
```

Discard uncommitted changes only when you are certain:

```bash
git restore .
```

Never run a destructive Git command just because an agent suggests it. Ask what will be lost first.

# Part L: Definition of a good first beta

A good first beta does not need the largest headline saving.

It needs to prove:

- Both coding agents route correctly.
- Exact values remain safe.
- Secrets do not leak.
- Failures preserve original context.
- Retrieval is narrow and authorised.
- The user can see what happened.
- A benchmark result is honest.
- The system can be turned off instantly.

That is the product.

Everything else is decoration.
