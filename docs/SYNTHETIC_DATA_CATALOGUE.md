# Synthetic Data Catalogue

## Purpose

`@fixel-recall/test-data` provides deterministic simulation fixtures for Fixel Recall development.
Every artifact is invented, records `dataOrigin: "synthetic"` and includes the seed used to create
it.

No real credentials, private repositories, production logs or outbound network calls are required.

## Package

```text
packages/test-data/
├── README.md
├── package.json
├── src/
│   ├── index.ts
│   └── index.test.ts
└── tsconfig.json
```

## Factories

| Export                                    | Contents                                                                                                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSeededSyntheticUsers(seed)`        | Eight seed users from the spec: log-heavy, code-heavy, high-cache, multilingual, tool-heavy, team-policy, provider-change and adversarial-secret.                    |
| `createSeededWorkloads(seed)`             | Fifteen deterministic workload samples covering logs, prose, code, diffs, shell, SQL, JSON, tool state, secrets and multilingual text.                               |
| `createFakeSecretCanaries(seed)`          | Obviously fake OpenAI, Anthropic, bearer, private-key and password canaries.                                                                                         |
| `createSyntheticUsageHistory(seed, days)` | 30 or 90 day synthetic histories with token estimates, cache estimates, image tokens, latency, retrieval calls, benchmark outcome, preset, host and model simulator. |
| `createFakeProfileBundles(seed)`          | Valid, expired, revoked, unknown-key, modified, rollback, client-mismatch, renderer-mismatch, multilingual and provider-change profile fixtures.                     |
| `createFakePolicyBundles(seed)`           | Organisation, team, repository, user, expired, invalid-signature, conflicting and offline-cached policy fixtures.                                                    |
| `createMultilingualCorpus(seed)`          | Latin, Devanagari, Japanese, Arabic and emoji/technical-symbol samples.                                                                                              |
| `createAuditEventFixtures(seed)`          | Installation through uninstall audit events plus a tampered fixture.                                                                                                 |

## Provider Simulators

| Export                                | Shape                                     | Binding          |
| ------------------------------------- | ----------------------------------------- | ---------------- |
| `startOpenAIFakeProvider(options)`    | OpenAI Responses-shaped local simulator   | `127.0.0.1` only |
| `startAnthropicFakeProvider(options)` | Anthropic Messages-shaped local simulator | `127.0.0.1` only |

Supported scenarios:

- `normal`
- `stream`
- `tool_call`
- `tool_output`
- `image_ack`
- `error_400`
- `error_401`
- `error_403`
- `error_413`
- `error_422`
- `error_429`
- `timeout`
- `disconnect`
- `changed_model`

Each simulator exposes `close()` for clean shutdown.

## Network Isolation

The package tests allow loopback requests only. The network-isolation test intentionally rejects a
non-loopback request before it reaches the network and fails if that guard is bypassed.

## Test Output

Tests that write generated artifacts create files under the operating system temporary directory
with a `fixel-recall-test-data-` prefix.

## Use Rules

- Label all generated reports, badges, cards and dashboard rows as synthetic or simulated.
- Do not mix synthetic data with future measured production histories without an explicit origin
  label.
- Do not replace fake canaries with real-looking credentials.
- Do not make provider simulators bind to non-loopback addresses.
