# Security policy

We take the security of `@ariada-org/diff-schema` seriously. The package
defines the canonical fingerprint and gate-decision contracts that
downstream CI consumers rely on for regulatory-defensible audit trails —
flaws here directly weaken the integrity of the gating signal.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories (private vulnerability
reporting).** Open a draft advisory at:

`https://github.com/ariada-org/ariada/security/advisories/new`

GitHub keeps the report private between you and the maintainers until a
fix has shipped, lets us collaborate inline, and produces a CVE identifier
on publication.

**Fallback channel — email.** If you cannot use GitHub Security Advisories,
email <security@ariada.org>. The address forwards to the maintainer; no
public mail server exposes outbound metadata. If you wish to encrypt the
report, fetch the maintainer's GPG key from
`https://github.com/ariada-org.gpg` and attach the encrypted message.

## What to include

1. Affected version(s) of `@ariada-org/diff-schema`.
2. Concrete reproduction steps (a minimal test case).
3. Impact assessment (severity, exploitability, scope).
4. Optional: suggested fix or patch.

## Response targets

| Event                   | Target                           |
| ----------------------- | -------------------------------- |
| Acknowledge receipt     | within 72 hours                  |
| Initial assessment      | within 7 days                    |
| Patch for HIGH/CRITICAL | within 14 days of confirmation   |
| Patch for MEDIUM/LOW    | within 30 days of confirmation   |
| Coordinated disclosure  | default 90 days, mutually agreed |

## Supported versions

| Version | Supported         |
| ------- | ----------------- |
| `0.x`   | Latest minor only |
| `1.x`   | Latest two minors |

## Out of scope

- Vulnerabilities in third-party dependencies — please report upstream.
- Issues in deployments or hosted services not part of the published
  package.

## Bug bounty

We do not currently offer a paid bug bounty. Acknowledgement and credit
are provided for all valid reports.
