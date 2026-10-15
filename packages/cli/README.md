# fixel-recall

Image memory with exact recovery for Claude Code and Codex CLI.

Fixel Recall is a local Safe-mode gateway that keeps code, commands, IDs and secrets protected.
Context compression is an in-development capability; the current live gateway forwards supported
requests unchanged.

> Shrink the context. Keep the details.

## Try it

```bash
npx fixel-recall setup
```

`setup` shows exactly which files it would change, then asks `Apply these changes? (y/N)`. Nothing
is written until you answer yes. `rollback` and `uninstall` work the same way.

Then start the local gateway and keep using `codex` or `claude` as normal:

```bash
npx fixel-recall start
```

The start command prints a local dashboard URL such as `http://127.0.0.1:4317/dashboard`. Keep the
gateway process running, then open that URL in a browser to see privacy-safe activity metadata. The
page never displays prompts, code, credentials or raw vault content.

Run `npx fixel-recall --help` for every command.

## What it does

- Runs a local loopback gateway (127.0.0.1 only), in Safe mode by default.
- Keeps code, commands, paths and IDs exact. Secrets are never rendered.
- Provides the local components for future safe image memory and exact recovery.
- Keeps authorised original text available through local retrieval when configured.
- Preserves the original text when it is uncertain, and reports savings honestly.
- No remote analytics by default.

## Scope

Configuration support covers Codex CLI/IDE and Claude Code CLI/VS Code on macOS, Linux, Windows and
WSL. Run `npx fixel-recall platform doctor` before setup. Non-macOS public release claims require a
green platform-specific CI run and canary. Cursor is supported through the Codex IDE extension, not
through Cursor's native AI traffic. Requires Node.js 24 or newer.

## Links

- Website: https://fixel-skills.vercel.app/fixel-recall.html
- Source and docs: https://github.com/mSolstice/FixelRecall
