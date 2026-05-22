# Security policy

We take supply-chain security seriously. If you believe you have found a
vulnerability in the `ariada-org/ariada` reusable workflow — whether that
is a way to exfiltrate secrets from a caller's repository, an injection vector
through a workflow input, a command-injection through the `pages:` parser, or
anything else — please report it privately so we can fix it before it is
publicised.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories (private vulnerability
reporting).** Open a draft advisory at:

`https://github.com/ariada-org/ariada/security/advisories/new`

GitHub keeps the report fully private between you and the maintainers until a
fix has shipped, lets us collaborate on the patch inline, and produces a CVE
identifier on publication. This is the OSSF Scorecard-recommended channel and
is reachable to any GitHub account at no cost.

**Fallback channel — email.** If you cannot use GitHub Security Advisories,
email <security@ariada.org>. The address is a Cloudflare Email Routing
forwarder that lands in the maintainer's inbox; no public mail server exposes
outbound metadata.

Please include:

- A description of the vulnerability and its impact (especially: does it leak
  caller-side secrets, or only break the audit job's own evidence output?).
- A minimal reproduction (caller workflow YAML, plus the inputs that triggered
  the issue).
- The version tag you observed it in (`v1`, `v1.0.0`, or commit SHA).
- Your preferred name / handle for the eventual disclosure credit, or your
  preference not to be credited.

## Response timeline

We aim for the following response SLAs:

| Step                                        | Target time          |
| ------------------------------------------- | -------------------- |
| Acknowledgement of receipt                  | 3 business days      |
| Triage decision (confirmed / declined)      | 10 business days     |
| Fix or mitigation shipped (for HIGH / CRIT) | 30 calendar days     |
| Public advisory + CVE filed (where merited) | 90 calendar days max |

If a 90-day responsible-disclosure window expires without resolution, the
reporter is free to disclose publicly. We will not retaliate against good-faith
disclosures that follow this policy.

## Scope

In scope:

- `.github/workflows/eaa-audit.yml` — the reusable workflow itself.
- Any helper scripts shipped under `scripts/` and invoked by the workflow.
- The example workflows under `examples/` (as illustrative copies; if the
  example itself is unsafe to copy-paste, that is in scope).

Out of scope:

- General `axe-core` vulnerabilities — report those to Deque Labs upstream.
- General `@ariada-org/wcag-rules-extended` vulnerabilities — report those at
  `https://github.com/ariada-org/ariada/security/advisories/new`.
- Issues that require an attacker who already controls the caller repository's
  secrets or default branch.
- The accuracy of accessibility rules. Those are bug reports against the
  rule-pack package, not workflow security issues.

## Supported versions

| Version line | Supported          |
| ------------ | ------------------ |
| v1.x         | :white_check_mark: |
| < v1.0       | :x: (pre-release)  |

Security fixes are backported to the most recent minor release line; older
lines receive only critical-severity backports.

## Coordinated disclosure

For coordinated disclosure with affected downstream consumers (e.g. a major
EAA-compliance audit pipeline at scale), open the private security advisory as
above and add a note in the discussion thread describing the downstream
surface; we will coordinate a disclosure schedule from there.
