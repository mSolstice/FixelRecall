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

Run `npx fixel-recall --help` for every command.

## What it does

- Runs a local loopback gateway (127.0.0.1 only), in Safe mode by default.
- Keeps code, commands, paths and IDs exact. Secrets are never rendered.
- Provides the local components for future safe image memory and exact recovery.
- Keeps authorised original text available through local retrieval when configured.
- Preserves the original text when it is uncertain, and reports savings honestly.
- No remote analytics by default.

## Scope

Available for macOS CLI users of Codex CLI and Claude Code CLI. IDE, Windows native, WSL and broad
hosted or enterprise deployment are not included in this release. Requires Node.js 24 or newer.

## Links

- Website: https://fixel-skills.vercel.app/fixel-recall.html
- Source and docs: https://github.com/mSolstice/FixelRecall
