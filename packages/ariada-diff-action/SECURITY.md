# Security policy

`@ariada-org/diff-action` is a composite GitHub Action. Security issues
affecting privilege scope, secret handling, or supply-chain integrity
warrant private disclosure.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories.** Open a draft advisory
at:

`https://github.com/ariada-org/ariada/security/advisories/new`

**Fallback channel — email.** <security@ariada.org>.

## What to include

1. Affected version(s) / commit SHA.
2. Reproduction steps.
3. Impact assessment (privilege escalation, token leak, supply-chain).

## Response targets

| Event                          | Target                              |
|--------------------------------|-------------------------------------|
| Acknowledge receipt            | within 72 hours                     |
| Initial assessment             | within 7 days                       |
| Patch for HIGH/CRITICAL        | within 14 days of confirmation      |
| Patch for MEDIUM/LOW           | within 30 days of confirmation      |

## Supported versions

`v0.x` is pre-release; pin the full SHA in your workflow. We will issue
patch releases for HIGH/CRITICAL findings while the v0 line is active.

## Out of scope

- Vulnerabilities in `actions/checkout`, `actions/github-script`,
  `actions/upload-artifact` — report upstream.
- Misconfiguration in the consumer workflow (e.g., over-broad
  `permissions`).
