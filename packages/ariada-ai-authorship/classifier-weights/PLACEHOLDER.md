<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC0-1.0 -->
# classifier-weights — placeholder

This directory intentionally contains no trained classifier weights.
The open-source reference implementation ships a small set of coarse,
hand-tuned per-agent log-odds nudges inside `src/signals/*.ts` so that
offline-mode inference produces a well-formed posterior.

Production-grade classifier weights, per-language calibration tables, and
the per-agent fingerprint dictionaries are distributed via the hosted
inference endpoint and are not part of this OSS package. See the package
README for the hosted-mode contract and the wire format.

If you wish to reproduce the published validation harness, see
`validation-corpus/ACCESSION.md` for the OSS-eligible corpus split and run
`pnpm run validate --offline` once the harness ships.
