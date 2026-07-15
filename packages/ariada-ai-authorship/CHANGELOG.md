<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Changelog

All notable changes to `@ariada-org/ai-authorship` will be documented here. The
format follows the spirit of Keep a Changelog and SemVer.

## 0.1.0 — initial release

- Public attribution surface: `attribute`, `attributeBatch`, `attributeOffline`, `extractSignals`.
- Four ensemble signals: lexical entropy, AST shape, naming cadence, edit-history rhythm.
- Orchestrator surface: ensemble combiner, calibration interface, softmax posterior projection.
- Reference clients: offline-mode (synchronous, confidence-capped) and hosted-mode (`fetch`-based, batched).
- Input adapters: `git diff --unified` parser, normalised pull-request payload, scan-event location reference.
- Composition with `@ariada-org/haes` — `anchorPosterior` canonicalises (RFC 8785 JCS), builds a HAES payload, signs the entry hash with the caller's Ed25519 keypair, and appends to a chain. `buildAnchorInclusionProof` produces a Merkle inclusion proof against the daily anchor.
- Posterior invariants enforced and unit-tested: sum-to-one, all-agents-present, sorted-descending, confidence-bounded, offline-cap, signal-contributions-length, zero-sum-per-signal, version-pins-present.
- Default calibration is a documented no-op; production calibration ships with the closed classifier.
