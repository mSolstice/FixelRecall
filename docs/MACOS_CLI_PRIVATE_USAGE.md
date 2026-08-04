# macOS CLI Private Usage

Status: macOS CLI usage guide

Release evidence commit: `2df94b1`

This guide is for macOS CLI users. It does not publish a package, create a GitHub release or claim
broad hosted/enterprise production deployment.

## Who This Is For

- A local developer using macOS.
- Codex CLI users testing Context Diet through the local OpenAI Responses-compatible route.
- Claude Code CLI users testing Context Diet through the local Anthropic Messages-compatible route.
- Operators who are comfortable running Terminal commands and keeping provider credentials outside
  the repository.

## Supported

- macOS CLI use.
- Codex CLI.
- Claude Code CLI.
- Local loopback gateway.
- Safe mode default.
- Fake-provider development mode.
- MCP exact retrieval in local tested flows.
- Dry-run setup, confirmed setup, rollback and uninstall on macOS CLI.

## Not Included In This Release

- Codex IDE.
- Claude Code IDE.
- Windows native.
- WSL.
- Public hosted deployment.
- Published npm/package release.
- Broad hosted/enterprise production deployment.
- Real model-profile approval beyond limited canary evidence.
- Third-party security-reviewed release.

## Clone, Install And Build

Run in Terminal:

```bash
git clone git@github.com:mSolstice/ContextDiet.git
cd ContextDiet
corepack enable
pnpm install
pnpm build
```

Verify local checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:compatibility
pnpm check:skills
```

## Local Gateway Start

Start the local gateway in Safe mode from the repository folder:

```bash
node packages/cli/dist/index.js start
```

Check health from another Terminal tab:

```bash
curl -sS http://127.0.0.1:4317/health
curl -sS http://127.0.0.1:4317/status
```

Stop the gateway by pressing `Ctrl+C` in the Terminal tab where it is running.

## Fake-Provider Validation

Fake-provider validation does not use real provider traffic.

Run:

```bash
pnpm smoke:openai
pnpm smoke:anthropic
```

Expected result: all commands pass.

## Real-Provider Canary Warning

Do not run real-provider canaries unless you explicitly consent to spend a tiny provider budget.

Never paste provider credentials into chat or commit them to the repository.

Provider keys must be set only in your own Terminal shell, for example:

```bash
export OPENAI_API_KEY="your_real_openai_key_here"
export ANTHROPIC_API_KEY="your_real_anthropic_key_here"
```

Use only synthetic prompts for canaries. Do not use private source code or private prompts.

## Dry-Run Setup

Dry-run setup writes nothing:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp
```

Review the listed files before confirming.

## Confirmed Setup

Use only after reviewing the dry-run output:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js setup both --mcp --confirm --replace-existing-manifest
```

This writes Context Diet-managed Codex, Claude Code and MCP configuration entries and records a
manifest with backups. It does not write provider credentials.

For Codex, setup keeps `model_provider` at the TOML root so Codex actually routes through the local
gateway. For Claude Code, setup writes `ANTHROPIC_BASE_URL` as a settings environment value and
registers the retrieval MCP server in the user Claude configuration.

Subscription users do not need to add API keys just to route through Context Diet. Keep
`ANTHROPIC_API_KEY` unset if you want Claude Code to use your subscription. Codex uses
`requires_openai_auth = true` so it can reuse the Codex auth state you already signed in with.

## Rollback

Rollback restores backed-up files recorded in the manifest:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js rollback --confirm
```

## Uninstall

Uninstall removes Context Diet-managed entries according to the manifest:

```bash
CONTEXT_DIET_CONFIG_ROOT="$HOME" node packages/cli/dist/index.js uninstall --confirm
```

## Safety Defaults

- Safe mode is default.
- Current instructions, code, diffs, commands, exact values and secret-sensitive content stay
  protected.
- Secret-sensitive spans are never render-eligible.
- Unknown or unsafe transformation shapes pass through unchanged.
- Raw request bodies and authentication values must not be logged or persisted.
- Provider credentials are not stored by setup.
- Benchmarks may be positive, neutral or negative.

## Troubleshooting

If port `4317` is already in use:

```bash
lsof -nP -iTCP:4317 -sTCP:LISTEN
```

Stop the old process only if you know it is the Context Diet gateway.

If the gateway is not reachable:

```bash
curl -sS http://127.0.0.1:4317/health
```

If setup refuses to overwrite a manifest, run rollback or uninstall first, or review the dry-run
output carefully before using `--replace-existing-manifest`.

If provider requests fail, first confirm:

- gateway status is Safe mode
- upstream allowlist contains the expected provider origin
- provider API key is set in your Terminal
- no credentials were pasted into chat or files

## Release Evidence

Primary release evidence:

- `RELEASE_READINESS.md`
- `docs/MACOS_CLI_RELEASE_CHECKLIST.md`
- `docs/FAKE_BETA_REPORT.md`
- `docs/INSTALL_UNINSTALL_EVIDENCE.md`
- `docs/REAL_PROVIDER_CANARY_PLAN.md`

Current release scope is macOS CLI. Broad hosted/enterprise production deployment is not included in
this release.
