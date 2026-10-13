# Claude Model Canary Matrix

This matrix is synthetic only. It does not approve real Claude models for image-rendered context.

## Cases

The local Anthropic adapter tests cover:

- ordinary text
- streaming requests
- completed tool-use and tool-result relationships
- active or malformed tool state
- cache-control fields
- image blocks
- exact strings such as UUIDs and hashes
- unknown blocks and fields

Each case must round-trip unchanged. Active or malformed tool state must keep all content native.
Unknown shapes must pass through unchanged. A failed check is a fallback to the original request,
not a partial transformation.

## Candidate Profiles

The current candidate families are Claude Opus 5.5, Claude Sonnet 5.5 and Claude Haiku 5.5. Each
profile is synthetic, dated, and marked `canary`. Passing this matrix does not change the profile to
`enabled`. Imaging remains disabled until separate model-specific evidence verifies:

- exact-string, structure and gist thresholds
- glyph and language coverage
- image dimensions and image-token accounting
- streaming and tool continuity
- current pricing and cache treatment
- renderer output and protected-span exclusion
- expiry and approval metadata

## Run Locally

From the repository in Terminal:

```bash
pnpm exec vitest run packages/providers-anthropic/src/model-canary.test.ts
```

This command uses only local fixtures and fake values. It sends no requests to Anthropic and reads
no credentials.
