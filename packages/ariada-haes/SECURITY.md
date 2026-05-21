# Security policy

We take the security of `@ariada-org/haes` seriously. The package implements
cryptographic primitives (SHA-256, Ed25519, Merkle commitments) that
underpin tamper-evident regulatory evidence — flaws here directly weaken
the audit trail downstream consumers rely on.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories (private vulnerability
reporting).** Open a draft advisory at:

`https://github.com/ariada-org/ariada/security/advisories/new`

GitHub keeps the report private between you and the maintainers until a
fix has shipped, lets us collaborate inline, and produces a CVE identifier
on publication. This is the OSSF (OpenSSF, Open Source Security Foundation)
Scorecard-recommended channel and is reachable to any GitHub account at no
cost.

**Fallback channel — email.** If you cannot use GitHub Security Advisories,
email <security@ariada.org>. The address is a Cloudflare Email Routing
forwarder that lands in the maintainer's inbox; no public mail server
exposes outbound metadata. If you wish to encrypt the report, fetch the
maintainer's GPG key from `https://github.com/ariada-org.gpg` and attach
the ciphertext.

Please include:

- A description of the vulnerability and its impact on chain integrity,
  signature verification, or anchor commitments.
- A minimal reproduction (test fixture or PoC code).
- The package version you observed it in (`pnpm list @ariada-org/haes`).
- Your preferred name / handle for the disclosure credit, or your
  preference not to be credited.

## Response timeline

We aim for the following response SLAs (Service-Level Agreements):

| Phase                                       | Target time          |
| ------------------------------------------- | -------------------- |
| Acknowledgement of receipt                  | 3 business days      |
| Triage decision (confirmed / declined)      | 10 business days     |
| Fix or mitigation shipped (for HIGH/CRIT)   | 30 calendar days     |
| Public advisory + CVE filed (where merited) | 90 calendar days max |

If a 90-day responsible-disclosure window expires without resolution, the
reporter is free to disclose publicly. We will not retaliate against
good-faith disclosures that follow this policy.

A CVE (Common Vulnerabilities and Exposures) identifier is requested
through GitHub's CNA (CVE Numbering Authority) automation when the issue
materially affects evidence integrity, signature soundness, or Merkle-tree
correctness.

## Scope

In scope:

- The published `@ariada-org/haes` npm package (`src/**`, `dist/**`).
- The RFC 8785 JCS implementation and its hash-determinism guarantees.
- SHA-256 / Ed25519 / Merkle commitment primitives.
- The `HaesClient` chain-append + verify pipeline.
- The GitHub Actions workflows under `.github/workflows/**` (supply chain).

Out of scope:

- AI Act regulatory ambiguities (those are upstream-spec issues, not
  security issues).
- Issues that require an attacker with pre-existing write access to the
  consumer's build pipeline.
- Cosmetic / formatting issues in canonical JSON output (those are bug
  reports, not security issues).
- Sigstore Rekor public-instance availability (that is the public
  log operator's responsibility).

## Supported versions

| Version line | Supported          |
| ------------ | ------------------ |
| 0.1.x        | :white_check_mark: |
| < 0.1.0      | :x: (pre-release)  |

Security fixes are backported to the most recent minor release line; older
lines receive only critical-severity backports.

## Threat model headlines

The intended threat model covers:

- Insider tampering of historical entries (mitigated: any post-hoc
  mutation breaks the `prev_hash` chain mechanically).
- Signing-key compromise (mitigated: revocation list semantics; entries
  signed AFTER revocation timestamp fail verification).
- Downgrade attacks on signature / hash algorithm (mitigated: algorithm
  identifier is part of the canonical hash pre-image).
- Replay attacks on `append` (mitigated: `entry_id` idempotency).
- Public-log forging at the anchor layer (mitigated by independent
  third-party log operators; out of this package's control).

The intended threat model does NOT cover:

- Attacks requiring physical access to the deployer's signing-key
  material (HSM-level threats).
- Quantum cryptanalysis (Ed25519 remains classically secure; a
  schema-reserved post-quantum migration path exists for future work).
