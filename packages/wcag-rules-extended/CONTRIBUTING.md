<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# Contributing to @ariada-org/wcag-rules-extended

Thank you for your interest in contributing.

## Quickstart

```bash
git clone git@github.com:ariada-org/ariada.git
cd wcag-rules-extended
pnpm install
pnpm test
```

## What we welcome

- **New rules** for EAA-relevant scenarios not yet covered (audiovisual media,
  e-books, transport ticketing, telephony). See `docs/extraction-roadmap.md`
  for the roadmap.
- **Nordic-language test fixtures** — Swedish / Norwegian Bokmål / Norwegian
  Nynorsk / Danish / Finnish / Icelandic. The more native-language fixtures
  we have, the more confident we can be in locale-specific rules.
- **Rule documentation translations** — per-rule docs in `docs/rules/*.md`
  are currently English-only; translations welcome.
- **Test coverage** — additional FAIL fixtures for edge cases.
- **Bug reports** — false positives, false negatives, with reproducible HTML
  fixture.

## Scope

This package implements WCAG 2.2 AA rule expressions as Commons work.
Some capabilities of the wider Ariada platform are maintained separately
and are out of scope for this package.

If a contribution feels adjacent to platform functionality rather than a
WCAG rule expression, please **open an issue first** to discuss scope —
many adjacent ideas are perfectly contributable.

## Rule contribution checklist

When proposing a new rule:

1. **One source file** at `src/rules/<pack>/<short-name>.ts` exporting:
   - `rule` (RuleDefinition)
   - `check` (CheckEvaluate function)
   - `checkDefinition` (CheckDefinition for axe-core registration)
   - `metadata` (RuleMetadata)
2. **One test file** at `src/rules/<pack>/<short-name>.test.ts` with
   FAIL fixtures + PASS fixtures + at least one Nordic-locale fixture.
3. **One docs file** at `docs/rules/<pack>-<short-name>.md` covering:
   - WCAG SC mapping (with link to W3C Understanding doc)
   - EN 301 549 v3.2.1 cross-reference
   - EAA Annex I section reference
   - Example HTML fixtures (FAIL + PASS)
   - Rationale (why this matters for actual users)
4. **One locale file** at `src/rules/<pack>/<short-name>.locale.ts` with
   en/sv/nb/da/fi messages.

## TDD workflow

We follow strict test-first discipline. Write the failing test, watch it
fail (with the expected failure message), then implement the rule. The
test must be in a *.test.ts file and pass via `pnpm test`.

## Code style

- TypeScript strict mode (already configured).
- ESM imports only (`.js` suffix on relative imports per Node ESM rules).
- No dependencies beyond `axe-core` (peer) and the standard browser DOM.
- Deterministic checks (no `Math.random`, no `Date.now`, no network).
- No mutation of input DOM nodes.

## DCO sign-off

This project uses the [Developer Certificate of Origin](https://developercertificate.org/).
By signing off your commits (`git commit -s`) you certify that you have
the right to submit your contribution under EUPL-1.2.

## Licensing

By contributing you agree that your contributions will be licensed under
EUPL-1.2 (see `LICENSE`).
