# pxpipe Integration Review

## Upstream inspected

- Repository: `teamchong/pxpipe`
- Upstream branch inspected: `main`
- Latest upstream commit observed: `76f4fd2`
  (`feat: add Sol Messages bridge and history compression`), committed on 2026-07-15.
- Latest package version observed: `pxpipe-proxy` `0.9.0`.
- Licence observed: MIT License, copyright notice names `claude-image-proxy contributors`.

Sources checked:

- GitHub repository page: `https://github.com/teamchong/pxpipe`
- Commit history page: `https://github.com/teamchong/pxpipe/commits/main/`
- Raw licence: `https://raw.githubusercontent.com/teamchong/pxpipe/main/LICENSE`
- Raw package metadata: `https://raw.githubusercontent.com/teamchong/pxpipe/main/package.json`

## Licence obligations

pxpipe is MIT licensed. If Context Diet copies substantial pxpipe code or bundled assets, the MIT
copyright and permission notice must be included with that copied material and in any distributed
package that contains it.

This integration does not copy upstream implementation code or assets. It keeps an attribution
notice in the repository and records the inspected upstream commit so future copying, vendoring or
dependency adoption can preserve the notice correctly.

## Reusable components

- Rendering concept: dense text pages with stable labels and adjacent exact sidecar metadata.
- Model-specific render-profile idea: only render for profiles that are explicitly enabled and
  known.
- Factsheet or exact sidecar idea: exact values must remain recoverable as native text metadata
  outside the rendered image.
- Conservative gating: byte-exact or risky material must stay native.
- Benchmark posture: image rendering is useful only when model read quality and cost math are proven
  for a specific model/profile.

## Components to wrap

- The render operation as a provider-neutral `ContextRenderer`.
- The input contract for policy-approved, secret-cleaned source text.
- Model-profile checks before rendering.
- Page and dimension limit enforcement.
- Glyph coverage reporting.
- Safe metadata logging.

## Components to replace

- pxpipe's proxy route handling is replaced by Context Diet's existing local proxy.
- pxpipe's Anthropic/OpenAI request transforms are replaced by Context Diet provider adapters.
- pxpipe's model allowlist is replaced by Context Diet model profiles.
- pxpipe's event logging is replaced by Context Diet safe metadata logs.
- pxpipe's cost and policy gates are replaced by Context Diet's firewall and policy engine.

## Renderer accuracy risks

- Dense image text is lossy for exact strings, especially IDs, hashes, code fragments and secrets.
  Context Diet must keep those spans native or recoverable through the exact sidecar.
- Glyph coverage can vary by font, platform and model vision capability. Missing or unsupported
  glyphs must fail closed.
- Page layout changes can alter model readability. Golden tests should pin labels, paging, sidecar
  hash placement and dimensions.
- Model support is profile-specific. A working profile for one model family must not imply support
  for another.

## Dependency and security risks

- Importing the full upstream package would pull in proxy, dashboard, tokenization and
  provider-transform logic that duplicates Context Diet boundaries.
- Upstream's package currently lists `gpt-tokenizer` as a runtime dependency and several build/dev
  dependencies. Context Diet does not need these for the renderer boundary yet.
- A direct dependency would increase supply-chain surface and could silently change rendering
  behavior on version upgrades.
- Logging and event behavior must remain under Context Diet control so raw content and
  authentication values never enter ordinary logs.

## Integration choice

Use an owned, copied-adapter-style implementation behind the existing renderer interface, but do not
copy the upstream project or substantial upstream source. The adapter implements the pxpipe
rendering contract concepts locally:

- stable `CTX` labels
- exact sidecar hash metadata
- model-profile gating
- page-limit gating
- glyph coverage checks
- deterministic golden outputs
- safe metadata logs only

This is preferred over a dependency or fork for the current milestone because Context Diet already
has provider-neutral policy, vault, retrieval and proxy boundaries. A full dependency or fork would
bypass those boundaries and bring unnecessary route and transform code.

## Update strategy

- Re-review upstream before any future adoption of real pxpipe code, assets or package dependency.
- Record the upstream commit, package version and licence in this document each time the integration
  is updated.
- Keep golden render tests stable so upstream-inspired layout changes are deliberate.
- If a future milestone chooses a dependency, pin it in the lockfile and add a `docs/DECISIONS.md`
  entry explaining the production dependency.
