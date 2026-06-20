<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Vendor known-bad fixture corpus

A per-rule corpus of deliberately-broken accessibility markup from several
independent vendors, used to validate that the scanner flags **every** rule it
claims to support — one page or block per rule, cross-checked against more than
one source so a gap in any single vendor's coverage is caught.

## Why a fetch script instead of vendored HTML

The third-party HTML keeps its own upstream licence and is **not committed** to
this repository — it is downloaded on demand by `scripts/fetch-vendor-fixtures.sh`
into the gitignored `var/test-fixtures-vendor/`. Only this manifest and the
generated `axe-rules-index.json` (rule id → fixture path, no third-party
content) are committed. This keeps the published package's licensing and the
public-surface leak gates clean while still giving every build agent a
reproducible, full-coverage corpus.

```sh
bash scripts/fetch-vendor-fixtures.sh      # populates var/test-fixtures-vendor/
```

## Sources

| Source | Vendor | Licence | What it gives | Path |
|---|---|---|---|---|
| axe-core integration rules | Deque Systems | MPL-2.0 | one folder per axe rule with passing **and** failing markup, plus a `.json` of the expected per-element verdict — the canonical "a block per rule" corpus (84 rules indexed) | `var/test-fixtures-vendor/axe-core/test/integration/rules/<rule>/` |
| ACT Rules test cases | W3C ACT Rules Community Group | W3C Document Licence | per-rule passed / failed / inapplicable examples mapped to WCAG success criteria (94 rule definitions) | `var/test-fixtures-vendor/act-rules/_rules/` |
| Before-and-After Demonstration (BAD) | W3C WAI | W3C Document Licence | a full inaccessible demo site (home / news / template / tickets / survey) paired with an accessible fix — real-page, multi-violation pages | `var/test-fixtures-vendor/w3c-bad/*-before.html` |

## How a CI job uses this corpus

This corpus slots into a three-layer fixture strategy, smallest to most
realistic:

1. **Controlled per-rule** — `axe-rules-index.json` drives a loop: serve each
   rule's failing fixture, assert the scanner reports exactly that rule. This is
   the ALL-rules coverage check.
2. **Real multi-violation pages** — the W3C BAD `*-before.html` pages exercise
   many rules at once on a realistic layout.
3. **Live sites** — a configurable site list (supplied separately by each
   deployer) lists deployed sites the multi-domain scanner runs against as
   real-world fixtures. Public consumers point this layer at their own sites.

## Coverage note (honest)

`axe-rules-index.json` covers the 84 axe-core rules. Our own EAA-extended rules
(`@ariada-org/wcag-rules-extended`: e-books, audiovisual, transport,
accessibility-statement, checkout) and the proprietary multi-domain rules
(privacy / security / sustainability / structured-data) are **not** covered by
the axe corpus — they need their own known-bad fixtures, authored under
`../` (e.g. the existing `eu-real-world/` accessibility-statement pages). That
gap is real and tracked, not closed by this corpus.

## Update

- Author: Alexander Brichkin (Agonist Development AB) · Date: 2026-06-16
- Fetched: axe-core 84 rules + ACT 94 rule defs + W3C BAD 5 pages.
