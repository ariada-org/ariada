<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# IP Negative List — patent-territory tokens NOT to appear in public OSS surface

This file lists keywords that the CI guard `scripts/oss-ip-guard.sh` checks against on every commit. Any commit-diff containing one of these tokens fails CI and blocks merge.

Purpose: enforce IP-separation discipline between the OSS rule pack (this repository) and the proprietary Ariada scanner (separate private repository). Per `grants/NLNET_APPLICATION_DRAFT_v0.9.md` §«IP separation discipline» — proprietary core (AI-attribution audit, source-level remediation, multi-agent orchestration, AIAS canonical registry) is provably separate from OSS work to protect both NLnet grant validity and EUPL-1.2 enforceability.

## Patent-territory tokens (BLOCKED in public OSS commits)

- AIAS (AI-Artifact Signature canonical registry — Patent H subject matter)
- HAES (Hash-Anchored Evidence Service — Patent H subject matter)
- canonical-scoring (Patent F subject matter)
- regression-diff (Patent C subject matter)
- penalty-estimator algorithm (Patent F subject matter)
- multi-tenant orchestration runtime (Patent D subject matter)
- billing infrastructure plane (Patent A subject matter)
- customer-data plane (Patent A subject matter)
- (additional tokens added quarterly per NLNET_STAGE2_ROADMAP_v0.1.md §10)

## What IS allowed in public OSS surface

- WCAG / EAA / EN 301 549 rule expressions (this is the Commons surface)
- axe-core extension API surface
- Nordic-locale detection logic
- Statement-generation logic (Module B commodity outer)
- Accessibility scanner orchestration at the OSS layer
- Documentation cross-references to standards documents

## Audit cadence

Quarterly review of this list against active patent claims. Updates committed under `docs/adrs/NNNN-update-ip-negative-list.md`.

## Cross-references

- `legal/HUMAN_AUTHORSHIP_POLICY.md` — binding repo policy
- `grants/NLNET_APPLICATION_DRAFT_v0.9.md` §«IP separation discipline»
- `grants/NLNET_STAGE2_ROADMAP_v0.1.md` §10 — patent strategy alignment
- `scripts/oss-ip-guard.sh` — CI implementation
