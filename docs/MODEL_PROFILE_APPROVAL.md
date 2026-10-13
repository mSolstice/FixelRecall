# Model Profile Approval

A model profile is the only way Fixel Recall may image context for a provider model. Safe mode must
never guess that a new model is compatible.

## Required Profile Fields

Each versioned profile records:

- provider
- model family and model version
- status
- last tested date and expiry date
- image dimension limits
- glyph density limits
- language coverage
- image token accounting rule
- gist, structure and exact-string scores
- minimum acceptable thresholds for each score

## Approval Flow

1. Create a candidate profile with status `canary` or `disabled`.
2. Run the synthetic canary harness over:
   - prose
   - code-like structure
   - tables
   - paths
   - UUIDs
   - hashes
   - numbers
   - mixed punctuation
3. Compare observed fragments and scores against the profile thresholds.
4. Approve the profile only when all canaries pass and all scores meet or exceed thresholds.
5. Set status to `enabled`, record `lastTestedAt`, set a bounded `expiresAt`, and record approval
   metadata.

## Automatic Disable Rules

Imaging is disabled when:

- the profile is expired
- the profile status is not `enabled`
- canary evaluation fails
- scores fall below thresholds
- the requested provider, model family or version is unknown

Unknown models must resolve to a disabled profile status. They are not inferred from similar model
names.

## Claude Candidate Profiles

The repository includes synthetic, candidate-only entries for current Anthropic model families. They
are intentionally marked `canary`, have zeroed accuracy scores, and cannot enable imaging. Passing
the synthetic workload matrix does not change that status. A Claude profile may become `enabled`
only after model-specific canaries, renderer checks, pricing and image-token accounting are reviewed
and approval is recorded.

## Reapproval

Before `expiresAt`, rerun canaries and refresh the profile only if all thresholds still pass. If a
provider silently changes model behavior, mark the profile `retest_required` or `disabled` until
fresh evidence exists.
