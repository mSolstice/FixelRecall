# Security Policy

Fixel Recall is a local macOS CLI tool. Please do not report security problems in public issues.

## Report A Vulnerability

Until a dedicated security mailbox is configured, report vulnerabilities privately to the repository
maintainer through GitHub's private vulnerability reporting feature:

1. Open the repository on GitHub.
2. Select **Security**.
3. Select **Report a vulnerability**.
4. Include a reproducible description, affected version or commit, impact, and a minimal proof of
   concept.

Never include real API keys, provider tokens, private source code, or personal data in a report. Use
fake credentials and synthetic input whenever possible. If a credential may have been exposed,
revoke it immediately through the provider console before reporting.

## Scope

The current supported scope is macOS with Codex CLI and Claude Code CLI. IDE, Windows native, WSL,
hosted deployments, and third-party integrations are outside the current release scope.

This policy does not claim that Fixel Recall is compliant with a provider's terms. Users are
responsible for reviewing the current provider terms before enabling custom routing, especially
subscription-based routing.
