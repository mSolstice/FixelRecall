# Website Copy Update: Subscription Auth

Use this as a content handoff for the Fixel Recall website page.

## Main Message

```text
No key paste. No hosted proxy. No extra cloud account.

Fixel Recall runs locally and works with your coding CLI's normal auth flow.
```

## Short Section

### Works With Your Existing CLI Login

Fixel Recall does not require you to paste provider API keys into the app.

For Codex CLI, Fixel Recall uses Codex custom-provider routing with `requires_openai_auth = true`,
so Codex can reuse the auth state you already signed in with.

For Claude Code CLI, Fixel Recall routes through `ANTHROPIC_BASE_URL`. If `ANTHROPIC_API_KEY` is
unset, Claude Code can keep using its normal signed-in subscription auth.

API keys are optional for users who intentionally want API-key billing.

## FAQ Copy

### Do I need an API key?

Not necessarily.

If you use Codex CLI or Claude Code CLI with a normal signed-in account, Fixel Recall is designed to
route through that local CLI flow.

API keys are only needed if you intentionally choose API-key billing.

### Does Fixel Recall store my login token?

No.

Fixel Recall forwards required authentication headers in memory only. It does not print, log, store
or persist provider credentials.

### Does Fixel Recall replace OpenAI or Anthropic?

No.

OpenAI and Anthropic provide the models and coding agents. Fixel Recall is a local safety and
efficiency layer that sits between the CLI and the provider route.

## Setup Card Copy

```text
1. Build Fixel Recall locally.
2. Start the local gateway in Safe mode.
3. Run dry-run setup.
4. Confirm setup only after reviewing the files to be touched.
5. Keep using Codex CLI or Claude Code CLI normally.
```

## Safety Card Copy

```text
Safe mode is default.
Secrets are never rendered.
Exact values stay protected.
Original text can be recovered locally when authorised.
Credentials are never stored.
```

## What Not To Claim

Do not claim:

- IDE support
- Windows native support
- WSL support
- broad hosted or enterprise deployment
- production readiness for every environment
- savings promises
- that Fixel Recall stores or manages provider credentials

## Suggested Website Placement

- Add the main message near the hero or first product explanation section.
- Add “Works With Your Existing CLI Login” near setup.
- Add the FAQ items near the bottom of the Fixel Recall page.
- Add the safety card near privacy/security content.
