# Fixel Recall 45-Second Video Script

Purpose: GitHub README video and future website hero/demo video.

Format: no humans, no voice, motion graphics only.

Style: clean dark UI, terminal/code editor visuals, animated context blocks, token counters, local
security icons, smooth before/after comparison.

## Title

Shrink The Context. Keep The Details.

## Core Message

Fixel Recall helps developers keep coding-agent sessions lighter, safer and easier to trust.

## Visual Script

### 0-4s: The Developer Problem

Visual:

- Dark code editor.
- Terminal running tests.
- Chat/context panel fills rapidly with old messages, logs, snippets and repeated notes.
- Token counter climbs quickly.

On-screen text:

```text
Your coding agent keeps carrying everything.
```

Motion:

- Context blocks stack upward.
- Token meter turns heavy.
- Editor subtly slows/stutters.

### 4-8s: The Hidden Cost

Visual:

- Same context pile becomes cluttered.
- Duplicate blocks pulse.
- Old logs and stale notes drift into the active request.

On-screen text:

```text
More noise.
More tokens.
Less focus.
```

Motion:

- Cost counter ticks up.
- Important code line gets visually buried under noisy blocks.

### 8-12s: Fixel Recall Enters Locally

Visual:

- A clean local gateway appears between two CLI windows and the model.
- Labels: Codex CLI, Claude Code CLI, Local Gateway.
- A loopback badge appears: `127.0.0.1`.

On-screen text:

```text
Fixel Recall runs locally.
```

Motion:

- Messy context stream flows into Fixel Recall.
- The gateway glows softly, like a filter turning on.

### 12-18s: Sort The Context

Visual:

- Context blocks split into clear lanes:
  - Safe old context
  - Exact details
  - Secrets
  - Active tool state
- Exact and secret blocks get lock icons.

On-screen text:

```text
Not all context should be compressed.
```

Micro-labels:

```text
Keep exact
Protect secrets
Shrink safe history
```

Motion:

- Code, paths, IDs and commands slide into a protected lane.
- Secrets snap behind a red lock.
- Old safe notes move toward a visual-memory lane.

### 18-25s: The Big Idea

Visual:

- Safe old context turns into a clean image page.
- Exact text moves into a local vault.
- A narrow retrieval beam connects the vault back to the agent.

On-screen text:

```text
Old safe context becomes visual memory.
Exact text stays recoverable.
```

Micro-labels:

```text
Image = gist
Vault = exact original
Retrieval = only what is needed
```

Motion:

- Text blocks compress into an image thumbnail.
- Vault door closes with exact text inside.
- A small exact snippet is retrieved, not the whole pile.

### 25-31s: Before And After

Visual:

- Split screen.
- Left side: huge text-heavy request.
- Right side: smaller request with protected exact text, visual memory and retrieval sidecar.

On-screen text:

```text
Before: 24k text tokens
After: 12k text tokens
```

Small label:

```text
Synthetic demo example
```

Motion:

- Left token bar stays tall.
- Right token bar drops.
- A checkmark appears next to "exact details preserved."

### 31-36s: Fail Safe

Visual:

- Renderer warning appears briefly.
- Instead of dropping content, original native text flows through.
- Secret block remains locked.

On-screen text:

```text
If anything fails, the original stays.
```

Micro-labels:

```text
No silent drops
No secret rendering
No raw-body logs
```

Motion:

- Failed image attempt dissolves.
- Original text route lights up.
- Safety shield appears.

### 36-41s: Developer Gains

Visual:

- Fast montage of dashboard-style cards:
  - Context X-ray
  - Safe savings
  - Risk ledger
  - Model health
  - Session control
- Terminal shows passing checks, but only briefly.

On-screen text:

```text
See what changed.
See what stayed protected.
Know if it was worth it.
```

Motion:

- Cards slide in one by one.
- Green checkmarks appear.
- A "not worth enabling" card flashes quickly to show honesty.

### 41-45s: Closing

Visual:

- Clean Fixel Recall title card.
- Thin animated line connects: Codex CLI, Claude Code CLI, Local Gateway, Vault.

On-screen text:

```text
Fixel Recall
Shrink The Context. Keep The Details.
```

Final small line:

```text
Local-first context safety for Codex CLI and Claude Code CLI.
```

Motion:

- Token pile collapses into a clean signal line.
- Vault lock closes.
- Final title holds for readability.

## Text Rules

- Use no more than 7 words per major screen.
- Use micro-labels only when the visual needs clarification.
- Avoid long paragraphs on screen.
- Keep numbers labelled as synthetic demo examples unless using verified measured evidence.
- Do not say "production ready."
- Do not promise savings.
- Do not mention unsupported platforms in the video unless the distribution page needs it nearby.

## Visual Motifs

- Context blocks: rounded rectangles representing messages, logs, code and tool output.
- Exact content: blue lock.
- Secrets: red lock.
- Old safe context: green blocks becoming image pages.
- Vault: local safe box icon.
- MCP retrieval: narrow light beam from vault to request.
- Local-first: loopback chip, `127.0.0.1`.
- Safety: shield icon, fallback route, original text preserved.
- Evidence: quick terminal checkmarks and dashboard cards.

## Suggested GitHub Caption

Fixel Recall helps coding agents stop carrying everything forever.

Safe old context can become visual memory. Exact text stays protected and recoverable in a local
vault. Secrets are never rendered. If anything fails, original content passes through unchanged.

Current scope: macOS CLI-only release candidate for Codex CLI and Claude Code CLI.
