# Claude Website Handoff: Context Diet On Fixel

Use this file first when giving Claude Code context for adding Context Diet to the Fixel website.

## Goal

Add Context Diet to the Fixel website as a **flagship local tool**, not just another small markdown
skill.

Fixel site:

```text
https://fixel-skills.vercel.app/index.html
```

Main Context Diet repo:

```text
https://github.com/mSolstice/ContextDiet
```

Fixel skills/catalog repo:

```text
https://github.com/mSolstice/Fixel-skills
```

## Read These Files In Order

1. `docs/CONTEXT_DIET_WEBSITE_DESIGN_CONTENT.md`
2. `docs/CONTEXT_DIET_WEBSITE_BLUEPRINT.md`
3. `docs/LANDING_PAGE_COPY_DRAFT.md`
4. `docs/CONTEXT_DIET_VIDEO_SCRIPT.md`

If Claude already has the Context Diet `README.md`, use that as the product source of truth for
technical scope and release claims.

## Non-Negotiable Claims

Say:

```text
Context Diet for macOS CLI.
Available for macOS CLI users of Codex CLI and Claude Code CLI.
Local-first. Safety-first. Evidence-first.
```

Do not say:

```text
Broad hosted/enterprise production deployment.
Savings guarantees.
Works on Windows.
Works on WSL.
Supports Codex IDE.
Supports Claude Code IDE.
Hosted service.
Published package.
```

## Creative Direction

Use this core line:

```text
Shrink The Context. Keep The Details.
```

The page should feel like a cluttered coding-agent session becoming clean, safe and understandable.

Visual metaphor:

```text
Old context pile -> policy scanner -> image memory + vault -> smaller request with exact recovery
```

Do not make it generic SaaS. Keep it in the existing Fixel style: precise, technical, dark console
motifs, mono labels, evidence-first copy.

## Expected Output From Claude

Claude should produce:

- updated homepage section
- new `context-diet.html`
- new `docs-context-diet.html`
- updated site data in `assets/js/content.js`
- optional video placeholder if real video files are not yet present
- no public release or package publish
- no claims outside the supported scope

Claude should report changed files and any remaining risks.
