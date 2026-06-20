<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Security policy

We take security seriously. If you believe you have found a vulnerability
in `@ariada-org/wcag-rules-extended` — whether that is a way to crash the rule
engine, an injection vector through user-supplied fixtures, a denial-of-service
in the regex matchers, or anything else — please report it privately so we can
fix it before it is publicised.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories (private vulnerability
reporting).** Open a draft advisory at:

`https://github.com/ariada-org/ariada/security/advisories/new`

GitHub keeps the report fully private between you and the maintainers until a
fix has shipped, lets us collaborate on the patch inline, and produces a CVE
identifier on publication. This is the OSSF Scorecard-recommended channel and
is reachable to any GitHub account at no cost.

**Fallback channel — email.** If you cannot use GitHub Security Advisories
(for example, you are reporting anonymously or your organisation blocks
GitHub.com), email <security@ariada.org>. The address is a Cloudflare Email
Routing forwarder that lands in the maintainer's inbox; no public mail server
exposes outbound metadata. If you wish to encrypt the report, fetch the
maintainer's published GPG key from `https://github.com/ariada-org.gpg`
and attach the ciphertext to the same email.

Please include:

- A description of the vulnerability and its impact.
- A minimal reproduction (fixture HTML, code snippet, or PoC).
- The package version you observed it in (`pnpm list @ariada-org/wcag-rules-extended`).
- Your preferred name / handle for the eventual disclosure credit, or your
  preference not to be credited.

## Response timeline

We aim for the following response SLAs:

| Phase                                    | Target time            |
|------------------------------------------|------------------------|
| Acknowledgement of receipt               | 3 business days        |
| Triage decision (confirmed / declined)   | 10 business days       |
| Fix or mitigation shipped (for HIGH/CRIT)| 30 calendar days       |
| Public advisory + CVE filed (where merited) | 90 calendar days max  |

If a 90-day responsible-disclosure window expires without resolution, the
reporter is free to disclose publicly. We will not retaliate against good-faith
disclosures that follow this policy.

## Scope

In scope:

- The published `@ariada-org/wcag-rules-extended` npm package.
- The TypeScript source in `src/**` and the published `dist/**`.
- The GitHub Actions workflows under `.github/workflows/**` (supply-chain).
- The `scripts/oss-ip-guard.sh` boundary script (defence-in-depth concern only —
  not a security gate by itself).

Out of scope:

- General axe-core vulnerabilities — please report those to Deque Labs upstream.
- Issues that require an attacker with write access to the consumer's
  build pipeline (assume the consumer already controls their own machine).
- Cosmetic issues with rule output (those are bug reports, not security issues).

## Supported versions

| Version line | Supported          |
|--------------|--------------------|
| 0.1.x        | :white_check_mark: |
| < 0.1.0      | :x: (pre-release)  |

Security fixes are backported to the most recent minor release line; older
lines receive only critical-severity backports.

## Coordinated disclosure

For coordinated disclosure with affected downstream consumers (e.g. a
production deployment of the package at scale), open the private security
advisory as above and add a note in the discussion thread describing the
downstream surface; we will coordinate a disclosure schedule from there.
