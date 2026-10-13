# Fixel Recall Synthetic Test Data Specification

## Purpose

This document defines the only user and provider data allowed during the current build phase.

All data is invented. It must be clearly labelled as synthetic in code, reports, dashboards, cards,
badges and exports.

## Global rules

- No real API keys.
- No real provider requests.
- No private repository content.
- No copied production logs.
- No personal user information.
- No hidden network dependency.
- Random generators must support a fixed seed.
- Fixtures must be small enough to inspect.
- Adversarial canary values must be obviously fake.
- CI must run with outbound network disabled where practical.

## Data packages

Suggested package:

```text
packages/test-data/
├── users/
├── workloads/
├── providers/
├── registries/
├── policies/
├── multilingual/
├── secrets/
├── audit/
└── factories/
```

## Synthetic user schema

```ts
type SyntheticUserProfile = {
  id: string;
  label: string;
  host: "codex" | "claude-code" | "both";
  languages: string[];
  workloadMix: {
    prose: number;
    logs: number;
    code: number;
    commands: number;
    toolState: number;
  };
  cacheIntensity: "low" | "medium" | "high" | "very-high";
  exactnessSensitivity: "low" | "medium" | "high" | "critical";
  latencySensitivity: "low" | "medium" | "high";
  riskPreference: "conservative" | "balanced" | "experimental";
  expectedVerdict: string;
};
```

## Seed users

### `u-log-heavy`

Expected:

- Significant eligible context
- Safe preset recommendation
- Positive simulated projection

### `u-code-heavy`

Expected:

- Most content protected
- Audit Only or Not Worth Using
- No pressure to loosen safety

### `u-high-cache`

Expected:

- Negligible net saving
- Not Worth Using
- Explanation highlights caching

### `u-multilingual`

Expected:

- Latin profile passes
- Unsupported script initially falls back
- Approved script profile later enables selected blocks

### `u-tool-heavy`

Expected:

- Completed old tool results may qualify
- Open tool calls remain native
- Broken tool pairs pass through

### `u-team-policy`

Expected:

- Mandatory organisation preset wins
- User gets a conflict explanation

### `u-provider-change`

Expected:

- Trusted profile begins enabled
- Synthetic version change quarantines it
- Failed canary keeps it disabled
- Passing canary creates new evidence

### `u-adversarial-secret`

Expected:

- Zero canary persistence
- Zero canary rendering
- Zero badge or audit leakage

## Fake secret canaries

Use obviously fake values such as:

```text
cd_test_openai_000000000000000000000000
cd_test_anthropic_0000000000000000000000
Bearer cd_test_bearer_do_not_log
-----BEGIN FAKE PRIVATE KEY-----
CD_TEST_ONLY_NOT_A_REAL_KEY
-----END FAKE PRIVATE KEY-----
password=CD_TEST_PASSWORD_NEVER_STORE
```

Do not mimic a real live credential format so closely that automated systems mistake it for a usable
key.

## Synthetic provider simulators

### OpenAI-shaped simulator

Must support:

- Normal response
- Streaming response
- Tool call
- Tool output
- Image input acknowledgement
- 400
- 401
- 403
- 413
- 422
- 429
- Timeout
- Disconnect
- Changed model version header

### Anthropic-shaped simulator

Must support:

- Normal message
- Streaming events
- `tool_use`
- `tool_result`
- Image block acknowledgement
- Cache-control fixture
- Beta-header fixture
- 400
- 401
- 403
- 413
- 422
- 429
- Timeout
- Disconnect
- Changed model version metadata

## Workload corpus

Create deterministic samples for:

1. Repetitive build logs
2. Long prose documentation
3. TypeScript source
4. Git diff
5. Shell transcript
6. SQL migration
7. JSON configuration
8. Completed tool results
9. Active tool state
10. Malformed tool state
11. Secret-heavy error logs
12. Hindi documentation
13. Japanese documentation
14. Arabic bidirectional text
15. Mixed emoji and technical symbols

## Synthetic usage history

Generate 30 and 90-day histories containing:

- Sessions per day
- Requests per session
- Original token estimate
- Eligible token estimate
- Cached tokens
- Image tokens
- Added latency
- Retrieval calls
- Benchmark outcome
- Policy preset
- Host and model simulator

Every generated history must record:

```text
data_origin = synthetic
seed = <integer>
```

## Local signed registry fixtures

Create:

- Valid profile
- Expired profile
- Revoked profile
- Unknown signing key
- Modified payload
- Rollback version
- Client-version mismatch
- Renderer mismatch
- Multilingual profile
- Provider-change replacement profile

Use test signing keys generated specifically for fixtures.

Never use production signing material.

## Team policy fixtures

Create:

- Organisation Protect First policy
- Team Save More policy
- Repository Audit Only policy
- User Lab Mode preference
- Expired policy
- Invalid signature
- Conflicting mandatory rules
- Offline cached policy

## Audit fixtures

Create events for:

- Installation
- Compatibility audit
- Policy selection
- Block decision
- Secret detection
- Text fallback
- Rendering
- Retrieval
- Benchmark
- Projection
- Badge generation
- Provider change
- Canary
- Policy conflict
- Uninstall

Add a tampered event fixture to prove verification fails.

## Network-isolation test

The complete synthetic suite should run with outbound connections blocked.

Any unexpected network attempt fails the test.

Allowed:

- Loopback only
- Local fake-provider ports
- Local registry simulator
- Local leaderboard simulator
- Local dashboard
