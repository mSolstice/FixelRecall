# Fixel Recall Website Implementation Blueprint

Use this blueprint to add Fixel Recall to the Fixel website.

## Current Fixel Site Pattern

The current site is a static Fixel catalog site.

Observed structure:

- `index.html`
- `docs.html`
- `implementation.html`
- `why.html`
- `founder.html`
- `request.html`
- `contact.html`
- existing skill page pattern such as `skill-context-defrag.html`
- existing docs page pattern such as `docs-context-defrag.html`
- shared data in `assets/js/content.js`
- shared behavior in `assets/js/main.js`
- shared styling in `assets/css/style.css`

The homepage currently has:

- hero
- problem section
- failure index
- method
- shipped skills
- audience section
- manifesto pull quote
- close/CTA cards

The site data is rendered from `window.FIXEL_FAILURES` and `window.FIXEL_SKILLS` in
`assets/js/content.js`.

## Strategy

Fixel Recall should be added as a **flagship local tool**.

Do not treat it as only another tiny markdown skill, because Fixel Recall includes:

- TypeScript monorepo
- local gateway
- OpenAI adapter
- Anthropic adapter
- vault
- MCP retrieval server
- renderer interface
- benchmark system
- dashboard-ready metrics
- installer, rollback and uninstall safeguards
- release-readiness evidence

Best information architecture:

```text
Fixel home page = discovery and flagship teaser
fixel-recall.html = product landing page
docs-fixel-recall.html = setup and usage docs
FixelRecall GitHub repo = technical source of truth
```

## Page-By-Page Changes

### 1. `assets/js/content.js`

Add a new failure entry:

```js
{
  id: "agent-context-waste",
  title: "Agents keep resending stale context",
  domain: "context",
  status: "shipped",
  skillId: "fixel-recall"
}
```

Add a new skill/product entry:

```js
{
  id: "fixel-recall",
  name: "fixel-recall",
  tag: "CONTEXT",
  status: "shipped",
  version: "macOS CLI RC",
  oneLiner:
    "Local-first context safety for Codex CLI and Claude Code CLI. Shrinks safe old context while keeping exact text protected and recoverable.",
  href: "fixel-recall.html",
  docsHref: "docs-fixel-recall.html"
}
```

Do not add a simple `SKILL.md` install command as the primary install CTA. Fixel Recall requires a
local engine build/setup flow.

### 2. `index.html`

Add a flagship Fixel Recall section after the problem section and before the failure index.

Eyebrow:

```text
/// FLAGSHIP LOCAL TOOL
```

Headline:

```text
Shrink The Context. Keep The Details.
```

Body:

```text
Your coding agent is carrying yesterday's mess into today's task: old logs, repeated notes, stale
chat and thousands of wasted tokens.

Fixel Recall runs locally for Codex CLI and Claude Code CLI. It shrinks safe old context, keeps exact
text recoverable and protects secrets by default.
```

Benefit panels:

```text
Less Waste
Safe old context can become compact visual memory.

More Safety
Code, commands, paths, IDs, hashes and secrets stay exact.

Exact Recovery
The local vault and MCP retrieval can bring back a narrow exact section when needed.
```

CTA buttons:

```text
Explore Fixel Recall -> fixel-recall.html
Read setup docs -> docs-fixel-recall.html
GitHub -> https://github.com/mSolstice/FixelRecall
```

Visual:

- before/after token bars
- label numbers as `Synthetic demo example`
- local-first chip: `127.0.0.1`
- Safe mode chip: `Safe mode default`
- exact text vault visual

Do not use generic SaaS gradients. Keep the current Fixel technical/console style.

### 3. `fixel-recall.html`

Create a new flagship product page.

Use the same header/footer/nav shell as existing skill pages.

Recommended structure:

1. Hero
2. Demo video or placeholder
3. The problem
4. Shrink The Context. Keep The Details.
5. How it works
6. Before/after token visual
7. Local-first safety
8. Developer workflow
9. Evidence
10. Supported and not included in this release
11. Final CTA

Hero eyebrow:

```text
Fixel / Flagship Local Tool
```

Hero headline:

```text
Shrink your coding agent's context without losing the details.
```

Hero subheadline:

```text
Fixel Recall helps Codex CLI and Claude Code CLI carry less wasteful context while protecting code,
commands, secrets, paths, IDs and exact facts.
```

Hero CTAs:

```text
Watch demo
Read setup docs
View GitHub
```

How it works steps:

```text
01 Local gateway
02 Exactness Firewall
03 Policy decision
04 Image memory + vault
05 Safe fallback
```

Before/after visual:

```text
Before: 24k text tokens
After: 12k text tokens + exact recovery
Synthetic demo example. Savings are only claimed with a comparable baseline.
```

Local-first safety cards:

```text
Safe mode default
No raw body logging
Credentials not stored
Secrets never rendered
Original content preserved on failure
Rollback and uninstall available
```

Evidence cards:

```text
Local checks passed
Fake-provider validation passed
Real route canaries passed
Generated toy-project benchmark canary passed
macOS install/rollback/uninstall canary passed
GitHub Actions green by user report
```

Supported:

```text
macOS
Codex CLI
Claude Code CLI
Local loopback gateway
Safe mode
Fake-provider mode
```

Not included in this release:

```text
Codex IDE
Claude Code IDE
Windows native
WSL
Broad hosted/enterprise deployment
Guaranteed savings
Hosted deployment
```

Final CTA:

```text
Try privately on macOS CLI.
```

Buttons:

```text
Read setup docs -> docs-fixel-recall.html
View GitHub -> https://github.com/mSolstice/FixelRecall
```

### 4. `docs-fixel-recall.html`

Create a practical setup docs page.

Use existing docs page styling.

Sections:

1. Current status
2. Supported
3. Not supported
4. Clone, install and build
5. Run local checks
6. Start local gateway
7. Fake-provider mode
8. Dry-run setup
9. Confirmed setup
10. Rollback
11. Uninstall
12. Real-provider canary warning
13. Evidence links

Include commands:

```bash
git clone git@github.com:mSolstice/FixelRecall.git
cd FixelRecall
corepack enable
pnpm install
pnpm build
```

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:compatibility
pnpm check:skills
```

```bash
curl -sS http://127.0.0.1:4317/health
curl -sS http://127.0.0.1:4317/status
```

```bash
pnpm smoke:openai
pnpm smoke:anthropic
```

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp
```

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp --confirm --replace-existing-manifest
```

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js rollback --confirm
```

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js uninstall --confirm
```

Do not ask users to paste credentials into the website or into chat.

### 5. `implementation.html`

If this page lists install commands for simple markdown skills, do not show Fixel Recall as a
one-line `SKILL.md` install.

Add a small note:

```text
Fixel Recall uses a local engine and dry-run setup rather than a single markdown skill install. See
the Fixel Recall setup docs.
```

Link:

```text
docs-fixel-recall.html
```

### 6. Navigation And Footer

Do not clutter the primary nav unless there is room.

Add Fixel Recall in:

- homepage flagship section
- shipped skills/product cards
- docs skill reference list
- footer Product column

Footer link:

```text
Fixel Recall -> fixel-recall.html
```

### 7. Video Assets

Expected paths:

```text
assets/fixel-recall-demo/fixel-recall-demo.mp4
assets/fixel-recall-demo/fixel-recall-demo.webm
assets/fixel-recall-demo/fixel-recall-poster.png
```

On `fixel-recall.html`:

- place video directly below hero CTA
- use responsive 16:9 layout
- `autoplay muted loop playsinline`
- use poster image
- include accessible caption:

```text
Fixel Recall demo showing old context shrinking while exact text stays recoverable.
```

If files are missing:

- show a polished placeholder console visual
- do not break layout
- include a TODO comment listing expected asset filenames

## Design Elements

Use the current Fixel design language:

- dark console panels
- mono labels
- thin borders
- amber/green status accents already present
- terminal/coding motifs
- data-driven cards
- minimal but meaningful animation

Add only minimal new CSS.

Suggested visuals:

- token bars before/after
- cluttered context stack
- scanner lanes
- lock icons for secrets and exact values
- vault panel
- narrow retrieval beam
- local loopback chip
- Safe mode chip
- fallback route showing original text preserved

Avoid:

- generic AI purple gradients
- overstuffed feature cards
- claims outside the supported scope
- text-heavy hero
- human stock imagery

## QA Checklist

Before reporting done:

- `index.html` loads
- `fixel-recall.html` loads
- `docs-fixel-recall.html` loads
- Fixel Recall card renders from `content.js`
- links work
- mobile nav still works
- video placeholder does not break layout
- no claims outside the supported scope are made
- no real credentials appear
- no "production ready" claim appears
- Fixel Recall is scoped to macOS CLI-only
- Fixel-skills remains the catalog site
- FixelRecall remains the main product repo

Do not publish anything.
