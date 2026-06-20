<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# @ariada-org/vpat-html-renderer

Pure-function renderer that transforms a VPAT (Voluntary Product Accessibility
Template) 2.5 INT (International) JSON report into a single, self-contained,
WCAG (Web Content Accessibility Guidelines) 2.2 AA-conformant, print-friendly
HTML document suitable for:

- Email attachment to procurement teams (EU TED — Tenders Electronic Daily,
  US GSA — General Services Administration, enterprise RFPs — Requests for
  Proposal)
- Vendor-website publication at `/accessibility/vpat`
- Regulatory submission (DIGG Sweden — Myndigheten för digital förvaltning,
  BFSG Germany — Barrierefreiheitsstärkungsgesetz, and 11 EAA-aligned
  jurisdictions — European Accessibility Act, Directive (EU) 2019/882)
- Print-to-PDF for archival via headless Chromium

| Field             | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Package name      | `@ariada-org/vpat-html-renderer`                                         |
| Version           | 0.1.0                                                                |
| Licence           | EUPL-1.2 (European Union Public Licence)                             |
| Runtime           | ECMAScript 2023, ES Modules                                          |
| Runtime deps      | none — pure string templating                                        |
| Node engines      | `>= 22`                                                              |
| REUSE-compliant   | yes — `REUSE.toml` + per-file SPDX headers                           |
| Self-audit (axe)  | 0 critical, 0 serious WCAG 2.2 AA violations (axe-core 4.11)         |
| Schema pinned to  | VPAT 2.5 INT (`schemaVersion: "2.5"`)                                |

## Why HTML and not PDF / DOCX

- Every browser renders HTML; print-to-PDF is one keyboard shortcut away.
- Single-file checksums travel cleanly through email + procurement portals.
- HTML can be made accessible at the source; PDF accessibility is famously
  brittle and DOCX accessibility depends on Word version.
- A `@media print` stylesheet handles print-to-PDF fidelity without a
  separate PDF generation pipeline.

## Input schema

The renderer consumes a `VpatReport` JSON shape conforming to the ITI
(Information Technology Industry Council) VPAT 2.5 INT template:

- ITI VPAT 2.5 INT template — <https://www.itic.org/policy/accessibility/vpat>
- JSON Schema URI — `https://schemas.ariada.org/vpat/2.5.json`

The renderer **strictly pins** `schemaVersion === "2.5"` and throws on any
other value. When the upstream emitter package bumps the schema, this
renderer must release a coordinated major version.

## Public API

```ts
import { renderVpatHtml } from '@ariada-org/vpat-html-renderer';
import type {
  VpatReport,
  RenderOptions,
  BrandOptions,
} from '@ariada-org/vpat-html-renderer';

const report: VpatReport = JSON.parse(/* vpat-2.5.json */);
const html: string = renderVpatHtml(report, { locale: 'en' });
// → write to disk, HTTP response body, or stdout
```

### Options

```ts
interface RenderOptions {
  /** BCP 47 locale code. MVP-supported: 'en', 'sv', 'de'. Default 'en'. */
  locale?: string;
  /** Vendor brand overrides (logo SVG, primary colour, contact). */
  brand?: BrandOptions;
  /** Include AAA-level rows even when 'Not Evaluated'. Default false. */
  includeAAA?: boolean;
  /** Warn if evaluationDate older than this many days. Default 365. */
  freshnessWarningDays?: number;
  /** Fixed generation timestamp (ISO 8601) → reproducible builds. */
  generationTimestamp?: string;
  /** Optional source-JSON URL embedded in JSON-LD + footer. */
  sourceJsonUrl?: string;
  /** Soft-warning hook (locale fallback, etc.). */
  onWarn?: (msg: string) => void;
}

interface BrandOptions {
  vendorName?: string;
  /** Inline SVG string. Sanitised against scripts/event-handlers. */
  logoSvg?: string;
  /** CSS colour literal. Must pass colour-grammar allowlist. */
  primaryColor?: string;
  contactEmail?: string;
  contactUrl?: string;
}
```

## Procurement use case — end to end

A Swedish SaaS responding to a Malmö municipality tender. The buyer's
procurement officer needs a human-readable VPAT to verify
DOS-lagen + EN 301 549 + WCAG 2.2 AA conformance before shortlisting.

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { renderVpatHtml } from '@ariada-org/vpat-html-renderer';

// 1. Load the JSON VPAT emitted by the scanner / evidence-emitter.
const report = JSON.parse(readFileSync('./vpat-2.5.json', 'utf-8'));

// 2. Render with vendor branding for the cover page.
const html = renderVpatHtml(report, {
  locale: 'sv',
  brand: {
    vendorName: 'Acme SaaS AB',
    primaryColor: '#0b3d91',
    contactEmail: 'accessibility@acme.example',
  },
  // Fixed timestamp → reproducible builds → procurement reviewer can
  // re-render from JSON and verify the file checksum matches.
  generationTimestamp: '2026-05-19T00:00:00Z',
  // Cite the source JSON URL so DIGG auditors can spot-check.
  sourceJsonUrl: 'https://acme.example/accessibility/vpat-2026.json',
});

// 3. Publish at vendor-website.com/accessibility/vpat-2026.html
//    or attach to the RFP / TED tender-response email.
writeFileSync('./public/accessibility/vpat-2026.html', html, 'utf-8');
```

The rendered HTML:

- opens correctly without network access (offline-friendly for procurement
  laptops);
- self-passes axe-core 4.11 WCAG 2.2 AA scans (zero critical / serious
  violations across 45+ rules);
- exposes stable anchors (`#wcag-1-1-1`, …) for citation in audit memos;
- carries a `@media print` stylesheet so Ctrl+P (or Chromium
  `page.pdf({ format: 'A4' })`) produces an archival PDF with repeating
  table headers and page numbers;
- embeds schema.org `TechArticle` + custom `ariada:vpatReport` JSON-LD
  for vendor-website SEO and machine re-extraction;
- carries a `<meta name="ariada-locale-fallback">` tag when the requested
  locale falls back to the default, for telemetry.

## Schema-version rejection

The renderer is strict about VPAT version drift:

```ts
import { renderVpatHtml } from '@ariada-org/vpat-html-renderer';

renderVpatHtml({ schemaVersion: '2.4', /* … */ });
// → Error: Unsupported VPAT schema version: 2.4. Expected 2.5.
```

When ITI publishes VPAT 2.6, the renderer will release a coordinated
major version that pins to the new schema. Old JSON should continue to
render via the previous major.

## Layout

```
src/
  index.ts                       — public exports
  render-vpat-html.ts            — orchestrator (pure function)
  types.ts                       — VpatReport + RenderOptions schema
  escape.ts                      — HTML-escape helper
  sanitise-svg.ts                — brand-logo SVG sanitiser
  fpc-mapping.ts                 — FPC ← WCAG SC heuristic mapping
  locales.ts                     — locale loader with BCP 47 fallback
  locales/{en,sv,de}.json        — MVP locale dictionaries
  sections/                      — per-section renderers
  styles/base.ts                 — inline CSS (light + dark + print)
tests/
  *.test.ts                      — Vitest unit + snapshot + self-audit
  fixtures/                      — sample VpatReport JSON inputs
  __snapshots__/                 — golden HTML fixtures (en/sv/de)
```

## Verification (one-shot)

```sh
pnpm install
pnpm -F @ariada-org/vpat-html-renderer build
pnpm -F @ariada-org/vpat-html-renderer test
pnpm -F @ariada-org/vpat-html-renderer typecheck
```

All three commands must exit zero before any change ships.

## Licence

EUPL-1.2 — see `LICENSE`. Per-file SPDX (Software Package Data Exchange)
headers + `REUSE.toml` keep machine-readable metadata in sync. The EUPL-1.2
includes a royalty-free patent grant under §2 to the extent necessary to
use the rights granted under the Licence.

Trademark rights are **not** granted by the EUPL. See `TRADEMARK.md`.

## Security

Vulnerability reports →
<https://github.com/ariada-org/ariada/security/advisories/new> or
`security@ariada.org`. See `SECURITY.md`.

## References

- ITI VPAT 2.5 INT template — <https://www.itic.org/policy/accessibility/vpat>
- W3C WCAG 2.2 Recommendation — <https://www.w3.org/TR/WCAG22/>
- ETSI EN 301 549 v3.2.1 — <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
- US Section 508 ICT Final Rule (36 CFR 1194) — <https://www.section508.gov>
- European Accessibility Act, Directive (EU) 2019/882 — <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882>
