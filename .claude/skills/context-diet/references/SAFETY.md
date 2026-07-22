# Context Diet Safety

Use this file when explaining policy decisions or checking whether content may be transformed.

## Safe-mode floor

Keep native:

- Current instructions
- Code, diffs, commands and SQL
- Paths, URLs, IDs, hashes and numbers
- Tool arguments and active tool state
- Unknown formats
- Secret-sensitive values

Never render or persist credentials or secret-sensitive spans.

## Failure rule

If parsing, scanning, rendering, vault storage, profile validation or rebuilding fails, preserve the
original provider content unchanged.

## Explanations

Explain decisions with reason codes and plain language. Do not improve a savings figure or
recommendation by weakening a safety rule.
