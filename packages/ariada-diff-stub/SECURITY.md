# Security policy

`@ariada-org/diff-stub` is an equality-only reference classifier. It does not
ship the canonical near-duplicate matching algorithm. Security issues
affecting fingerprint determinism or classification correctness in the
stub still warrant private disclosure.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories (private vulnerability
reporting).** Open a draft advisory at:

`https://github.com/ariada-org/ariada/security/advisories/new`

**Fallback channel — email.** Email <security@ariada.org>.

## What to include

1. Affected version(s).
2. Reproduction steps.
3. Impact assessment (severity, exploitability, scope).

## Response targets

| Event                   | Target                         |
| ----------------------- | ------------------------------ |
| Acknowledge receipt     | within 72 hours                |
| Initial assessment      | within 7 days                  |
| Patch for HIGH/CRITICAL | within 14 days of confirmation |
| Patch for MEDIUM/LOW    | within 30 days of confirmation |

## Supported versions

| Version | Supported         |
| ------- | ----------------- |
| `0.x`   | Latest minor only |

## Out of scope

- Issues in the closed canonical engine (separate vendor channel).
- Third-party dependency vulnerabilities — report upstream.
