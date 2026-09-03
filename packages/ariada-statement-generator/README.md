<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# @ariada-org/statement-generator

EAA / WCAG accessibility-statement generator — Directive 2016/2102 art. 7-style statement pages in HTML or MDX, Nordic 4 + English locales.

[![License: EUPL-1.2](https://img.shields.io/badge/license-EUPL--1.2-blue)](LICENSE)
[![CI](https://github.com/ariada-org/ariada/actions/workflows/ci.yml/badge.svg)](https://github.com/ariada-org/ariada/actions/workflows/ci.yml)

## Quick-start

```bash
npm install @ariada-org/statement-generator
```

```ts
import { generateStatement } from '@ariada-org/statement-generator';
import type { Violation, ReportMeta } from '@ariada-org/evidence-emitter';

const violations: Violation[] = [/* axe-core results normalized */];
const meta: ReportMeta = {
  productName: 'Example Web App',
  productVersion: '2.5.0',
  evaluator: 'Audit Team',
  evaluationDate: '2026-05-16',
  scope: 'https://example.com/checkout',
};

const statement = generateStatement(violations, meta, {
  locale: 'sv',
  jurisdiction: 'SE',
  organisation: 'Example AB',
  authorityEmail: 'tillganglighet@example.se',
  feedbackUrl: 'https://example.se/kontakt',
  format: 'html',
  conformance: 'partial',
});

// statement.body — HTML or MDX document ready to drop into /accessibility/
```

Node ≥ 22. Single workspace dependency: [`@ariada-org/evidence-emitter`](../ariada-evidence-emitter) (re-uses the `Violation` + `ReportMeta` types).

## What this package does

Renders an accessibility-statement page that satisfies the disclosure structure mandated by Directive (EU) 2016/2102 art. 7 and mirrored by the EAA Annex I §I.1 obligation for in-scope private-sector services. The output covers the six required disclosures: publication date, scope, conformance status, non-conformances, feedback mechanism, and enforcement procedure (per-jurisdiction authority contact).

The generator is locale-aware (English + Swedish + Norwegian Bokmål + Danish + Finnish) and jurisdiction-aware (SE / NO / DK / FI Nordic enforcement track). Strings live in a single i18n catalogue (`STATEMENT_MESSAGES`) so additional locales can be added without touching the rendering logic. Output is either standalone HTML (drop directly at `/accessibility/`) or MDX (compatible with Astro / Next.js content collections).

The function is deterministic: same input → same output. No network calls, no template fetching, no third-party CDN.

## What this package does NOT do

It does not scan for violations, host the rendered page, sign the statement, or notify enforcement authorities. It does not produce VPAT-JSON or EN 301 549 §11 conformance reports — see [`@ariada-org/evidence-emitter`](../ariada-evidence-emitter) for those formats. Locale and jurisdiction coverage is currently limited to the Nordic 4 + English; other EU locales are not yet shipped.

## API summary

| Export | Signature | Returns |
|---|---|---|
| `generateStatement(violations, meta, opts)` | `(Violation[], ReportMeta, GenerateStatementOptions) => GeneratedStatement` | `{ body, format, locale, jurisdiction }` |
| `STATEMENT_MESSAGES` | `Record<Locale, StatementMessages>` | i18n catalogue (5 locales × all surface strings) |

Types: `GeneratedStatement`, `GenerateStatementOptions`, `StatementJurisdiction` (`'SE' | 'NO' | 'DK' | 'FI'`), `StatementConformance` (`'full' | 'partial' | 'non-conformant'`), `StatementFormat` (`'html' | 'mdx'`), `StatementMessages`, `Locale`.

## Regulatory mapping

- **Directive (EU) 2016/2102 art. 7** — accessibility-statement obligation for public-sector bodies ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102)); structure mirrored by EAA Annex I §I.1 for in-scope private-sector services
- **EN 301 549 v3.2.1 §7** — accessibility-statement reporting clauses; aligned with the [Implementing Decision (EU) 2018/1523 model template](https://eur-lex.europa.eu/eli/dec_impl/2018/1523/oj)
- **National authorities (Nordic 4)**
  - SE — [DIGG digital tillgänglighet](https://www.digg.se/kunskap-och-stod/digital-tillganglighet) (Lag (2018:1937) DOS-lagen)
  - NO — [Tilsynet for universell utforming av IKT](https://www.uutilsynet.no/) (forskrift om universell utforming)
  - DK — [Digst tilsyn webtilgængelighed](https://digst.dk/tilsyn/webtilgaengelighed/)
  - FI — [Saavutettavuusvaatimukset](https://www.saavutettavuusvaatimukset.fi/) (saavutettavuuslaki)

## Tests + verification

80 tests across 2 files (vitest), including 3 property-based suites via fast-check that verify locale + jurisdiction round-trips and HTML / MDX structural invariants. Run with `pnpm test`; coverage via `pnpm test:coverage`.

## Sibling packages

- [`@ariada-org/evidence-emitter`](../ariada-evidence-emitter) — VPAT / EN 301 549 §11 / DOS-lagen JSON emitters (shared `Violation` + `ReportMeta` types)
- [`@ariada-org/wcag-rules-extended`](../wcag-rules-extended) — produces the violations the statement summarises
- [`@ariada-org/vpat-html-renderer`](../ariada-vpat-html-renderer) — VPAT-JSON → HTML view

## License

EUPL-1.2 — see [LICENSE](LICENSE).

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
