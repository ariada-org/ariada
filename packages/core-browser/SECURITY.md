# Security policy

We take security seriously. If you believe you have found a vulnerability
in `@ariada/core-browser` — whether that is a way to leak data through the captureBrowserSnapshot path, a way to evade the chrome.debugger isolation, or anything else — please report it privately so we can fix it
before it is publicised.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories (private vulnerability
reporting).** Open a draft advisory at:

`https://github.com/ariada-org/ariada/security/advisories/new`

GitHub keeps the report fully private between you and the maintainers until a
fix has shipped, lets us collaborate on the patch inline, and produces a CVE
identifier on publication. This is the OSSF (OpenSSF, Open Source Security
Foundation) Scorecard-recommended channel and is reachable to any GitHub
account at no cost.

**Fallback channel — email.** If you cannot use GitHub Security Advisories
(for example, you are reporting anonymously or your organisation blocks
GitHub.com), email <security@ariada.org>. The address is a Cloudflare Email
Routing forwarder that lands in the maintainer's inbox; no public mail server
exposes outbound metadata. If you wish to encrypt the report, fetch the
maintainer's published GPG key from `https://github.com/ariada-org.gpg`
and attach the ciphertext to the same email.

Please include:

- A description of the vulnerability and its impact.
- A minimal reproduction (input, code snippet, or PoC).
- The package version you observed it in (`pnpm list @ariada/core-browser`).
- Your preferred name / handle for the eventual disclosure credit, or your
  preference not to be credited.

## Response timeline

We aim for the following response SLAs (Service-Level Agreements):

| Phase                                       | Target time           |
|---------------------------------------------|-----------------------|
| Acknowledgement of receipt                  | 3 business days       |
| Triage decision (confirmed / declined)      | 10 business days      |
| Fix or mitigation shipped (for HIGH/CRIT)   | 30 calendar days      |
| Public advisory + CVE filed (where merited) | 90 calendar days max  |

If a 90-day responsible-disclosure window expires without resolution, the
reporter is free to disclose publicly. We will not retaliate against good-faith
disclosures that follow this policy.

A CVE (Common Vulnerabilities and Exposures) identifier is requested through
GitHub's CNA (CVE Numbering Authority) automation when the issue meets the
ETSI (European Telecommunications Standards Institute) / EN 301 549 §11
materiality threshold for an accessibility-tooling supply-chain risk.

## Scope

In scope:

- The published `@ariada/core-browser` npm package.
- The published source under `src/**`.
- The GitHub Actions workflows under `.github/workflows/**` (supply-chain).

Out of scope:

- Trademark or brand-misuse complaints — see `TRADEMARK.md` instead.
- Issues that require an attacker with write access to the consumer's
  build pipeline (assume the consumer already controls their own machine).
- Feature requests or aesthetic disagreements.

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
