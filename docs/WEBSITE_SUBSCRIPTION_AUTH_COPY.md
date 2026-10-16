# Website Copy Update: Subscription Auth

Use this as a content handoff for the Fixel Recall website page.

## Main Message

```text
No key paste into Fixel Recall. No hosted proxy. No extra Fixel Recall account.

Fixel Recall runs locally. Its documented gateway path uses API-key authentication kept in the
provider CLI's normal secret store.
```

## Short Section

### Authentication Boundary

Fixel Recall does not require you to paste provider API keys into the app.

For Codex CLI, the default custom-provider setup uses an API key through `OPENAI_API_KEY`.

For Claude Code CLI, Fixel Recall routes through `ANTHROPIC_BASE_URL` with API-key authentication.

Subscription-session routing through a third-party gateway is unproven and is not claimed.

## FAQ Copy

### Do I need an API key?

The documented gateway setup requires the provider API key to remain in the provider CLI's normal
secret store or environment. Fixel Recall never stores or prints it.

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
