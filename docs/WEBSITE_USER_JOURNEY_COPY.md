# Website Copy: Fixel Recall User Journey

Use this to add a clear “how it works in daily life” section to the Fixel Recall website.

## Section Title

```text
What Happens After You Install It?
```

## Short Intro

```text
Fixel Recall does not replace your coding agent. It sits locally between your CLI and the provider route, then gives you a safer, clearer view of what your context is doing.
```

## Journey Cards

### 1. Start The Local Gateway

Command:

```bash
node packages/cli/dist/index.js start
```

What the user sees:

```text
Fixel Recall gateway listening
Gateway URL: http://127.0.0.1:4317
Safety mode: Safe
Credentials are kept in memory only and are not printed.
```

Benefit:

```text
The user knows Fixel Recall is local, loopback-only and running in Safe mode.
```

### 2. Keep Using Codex Or Claude Normally

Command:

```bash
codex
```

or:

```bash
claude
```

What the user sees:

```text
Their normal coding CLI workflow.
```

Benefit:

```text
No new prompt habit. No “use Fixel Recall” phrase needed every time. Once configured, the gateway works in the background.
```

### 3. Check Status

Command:

```bash
node packages/cli/dist/index.js status
```

What the user sees:

```text
Fixel Recall status

Gateway: running
Safety mode: Safe
Hosts: both
Credentials: not displayed
```

Benefit:

```text
The user can confirm routing and safety mode without exposing credentials.
```

### 4. See Whether It Saved Anything

Command:

```bash
node packages/cli/dist/index.js benchmark
```

What the user sees:

```text
Original input cost
Compressed input cost
Image cost
Added latency
Net saving
Verdict
Evidence label
```

Benefit:

```text
Fixel Recall does not just claim savings. It reports whether the setup looks worth using, neutral or not worth enabling.
```

### 5. Understand The Safety Decision

Command:

```bash
node packages/cli/dist/index.js explain
```

What the user sees:

```text
This block stayed native because it contained source code and exact file paths.
Safe mode keeps that content unchanged.
```

Benefit:

```text
The user can see why Fixel Recall shrank something, protected something or passed it through unchanged.
```

### 6. Retrieve Exact Context

Command:

```bash
node packages/cli/dist/index.js retrieve --block-id BLOCK_ID
```

What the user sees:

```text
Returned exact section from local vault.
Credentials: not displayed.
```

Benefit:

```text
Old context can be shrunk without losing authorised exact text. Recovery is narrow, local and scoped.
```

### 7. Roll Back Or Uninstall

Rollback command:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js rollback --confirm
```

Uninstall command:

```bash
FIXEL_RECALL_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js uninstall --confirm
```

What the user sees:

```text
Rollback complete: backed-up files were restored from the install manifest.
```

or:

```text
Uninstall complete: only Fixel Recall managed entries were removed.
```

Benefit:

```text
The user can try Fixel Recall without feeling trapped.
```

## Website Layout Recommendation

Place this section after the main “Shrink The Context. Keep The Details.” explanation and before
technical setup.

Recommended visual structure:

- A left-side terminal mockup showing the commands.
- A right-side vertical timeline with the seven journey cards.
- Small badges: `local`, `Safe mode`, `credentials hidden`, `rollback available`.
- Keep each card short. The command and result should do most of the explaining.

## Simple Summary Line

```text
Use your coding CLI as usual. Fixel Recall runs locally in the background, then shows what it protected, what it shrank and whether it was actually worth it.
```
