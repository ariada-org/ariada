<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# IP Negative List — patent-territory tokens forbidden in this repository

This file enumerates patent-territory concepts that must NOT be implemented in this OSS repository. It is part of the project's internal IP-governance framework (not redistributed).

The IP separation is enforced by an automated CI guard that runs on every push and pull request. Commits matching any negative-list token are blocked.

## Scope of the negative list

This negative list is exhaustive as of **2026-05-14**. It is updated whenever:

- A new patent is filed by Agonist Development AB.
- A claim amendment narrows or broadens the patent-territory scope.
- The quarterly IP audit identifies a previously-uncovered overlap.

## Patent-territory tokens (case-insensitive)

The following concepts map to currently-filed patent applications by Agonist Development AB. They MUST NOT appear in source code, test fixtures, or documentation in this repository, except in:

- This file itself (`IP_NEGATIVE_LIST.md`).
- The `NOTICE` file (patent peace pledge section).

### Group 1 — AI attribution

- `ai-attribution`, `ai attribution`
- `human-vs-ai`, `human vs ai`
- `ai-generated-code-detection`, `ai generated code detection`
- `llm-author-attribution`, `llm author attribution`
- `ai-commit-forensics`, `ai commit forensics`

### Group 2 — Multi-agent compliance architect

- `multi-agent-compliance-architect`
- `architect-tier-orchestrator`

### Group 3 — CI/CD gate semantic baseline

- `ci-gate-baseline-diff`
- `preexisting-violation-baseline`
- `wcag-baseline-diff`

### Group 4 — Canonical rule registry

- `canonical-rule-registry`
- `rule-provenance-graph`

### Group 5 — Canonical scoring

- `canonical-scoring`
- `cross-rule-confidence`
- `ariada-canonical-scoring`

### Group 6 — Autonomous PR generation

- `autonomous-pr-generation`
- `autonomous-remediation-pull-request`
- `source-level-autonomous-fix`

### Group 7 — Hash-anchored evidence registry

- `aias-canonical-registry`
- `ai-artifact-inspection-standard`

### Group 8 — Multi-domain scanner orchestration

- `multi-domain-scanner-orchestrator`
- `multi-domain-compliance-fabric`

### Group 9 — Character-themed visualisation

- `dracula-visualization`
- `themed-character-renderer`

## Internal imports (forbidden in OSS)

Imports from the maintainer's internal source tree are forbidden in this public package. Specifically:

- `@ariada/scan-backend`, `@ariada/dracula-agent` (closed proprietary surfaces)
- Any absolute filesystem path referring to the maintainer's internal source-tree layout.

This repository depends only on:

- `axe-core` (peer dependency, MPL-2.0)
- Standard Node.js / browser DOM APIs

## What to do if a contribution hits the negative list

1. Re-check whether the concept is actually distinct from the patent-territory token. Many tokens are conceptual, not literal: a contribution about «accessibility scoring» is fine; a contribution about «canonical scoring with cross-rule confidence» is not.
2. Rephrase / rescope the contribution to a non-patented adjacency.
3. If you believe the negative-list entry is over-broad, open a public issue. The project will route the question to its IP review process and respond within 2 weeks.

## Cross-references

- `LICENSE` — EUPL-1.2 (public package license)
- `NOTICE` — patent peace pledge
- `TRADEMARK.md` — trademark policy

---

_Document version: 0.1 (2026-05-14). Next review: 2026-Q3 quarterly IP audit._
