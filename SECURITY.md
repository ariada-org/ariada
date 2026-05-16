# Security Policy

## Reporting a vulnerability

**Do not report security issues via public GitHub issues.**

Email **security@ariada.org** with:

1. Affected package(s) and version(s)
2. Reproduction steps
3. Impact assessment (severity, exploitability)
4. Optional: suggested fix or patch

If you prefer encrypted communication, request our PGP key in the first email and we will send it from the same address.

## Response targets

| Event | Target |
|---|---|
| Acknowledge receipt | within 72 hours |
| Initial assessment | within 7 days |
| Patch for HIGH/CRITICAL | within 14 days of confirmation |
| Patch for MEDIUM/LOW | within 30 days of confirmation |
| Coordinated disclosure | by mutual agreement, default 90 days |

## Supported versions

Until v1.0.0 we provide security patches for the **latest minor release on `main`** only. After v1.0.0 we will support the two most recent minor releases.

| Version | Supported |
|---|---|
| `0.x` | Latest minor only |
| `1.x` (when released) | Latest two minors |

## Disclosure

We will:

- Credit the reporter (with their consent) in the release notes and GitHub Security Advisory
- Publish a CVE via the GitHub Security Advisory database for HIGH/CRITICAL findings
- Notify users via the npm package security alerts mechanism

## Out of scope

- Vulnerabilities in third-party dependencies — please report to the upstream project. We will track via Renovate / Dependabot and ship patches when upstream releases.
- Issues in deployments or hosted services that are not part of our published packages.

## Bug bounty

We do not currently offer a paid bug bounty. Acknowledgement and credit are provided for all valid reports.
