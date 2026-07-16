# Context Diet Operations

## Common commands

```bash
context-diet doctor
context-diet audit
context-diet start
context-diet status
context-diet explain
context-diet benchmark
context-diet stop
```

Use the actual installed command names from the repository if they differ.

## Operating rule

Start in Safe mode.

Before changing host routing:

1. Show the current route.
2. Show the proposed local route.
3. Explain how to restore the old route.
4. Ask for confirmation before writing user configuration.

Never put a credential in the command history when a safer environment-variable or credential helper
method exists.
