<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Security policy — @ariada-org/ai-authorship

## Reporting vulnerabilities

Email `security@ariada.org` with a clear description of the issue, the
package version affected, a minimal reproducer, and your contact details.
Coordinated disclosure is appreciated.

PGP-encrypted reports are accepted; the maintainer key is published at
`https://ariada.org/.well-known/security.txt`.

## Scope

This package ships:

- pure signal-extraction primitives,
- an ensemble combiner,
- a calibration interface,
- a reference `fetch`-based hosted-mode client,
- an offline-mode synchronous classifier,
- a composition layer over `@ariada-org/haes` for canonicalisation, signing,
  and Merkle-anchor inclusion proofs.

In-scope security concerns include:

- input-validation gaps that allow malformed inputs to crash the pipeline,
- credential leakage paths in the hosted-mode client,
- integrity gaps in the anchored-evidence composition layer (e.g. payload
  fields that are not covered by the canonical pre-image),
- offline-mode classifier behaviour that bypasses the 0.6 confidence cap
  or the documented invariants.

## Privacy posture

- The OSS hosted client transmits source code in cleartext over TLS. It
  does NOT transmit raw author emails — the client requires the caller to
  pass a SHA-256 hash, and rejects raw values via `validateInput`.
- The offline mode performs no network calls and emits no telemetry.
- The anchored-evidence composition layer omits `payload.tags` from the
  canonical pre-image so tag mutations do not break the chain or leak
  through the SHA-256 commitment.

## Supported versions

The current 0.x major. Security fixes land on the most recent minor; older
minors receive fixes for critical issues only.
