# Compliance evidence emitters

Three machine-readable JSON formats produced from a normalized violation list:

| Format                      | Function         | Schema URI                                       | Spec                                                                                                                                                                                                                      |
| --------------------------- | ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| VPAT 2.5 (US Section 508)   | `emitVpat()`     | `https://schemas.ariada.org/vpat/2.5.json`       | [ITI VPAT 2.5](https://www.itic.org/policy/accessibility/vpat)                                                                                                                                                            |
| EN 301 549 v3.2.1 §11       | `emitEn301549()` | `https://schemas.ariada.org/en301549/3.2.1.json` | [ETSI EN 301 549 v3.2.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf)                                                                                                     |
| Swedish DOS-lagen statement | `emitDosLagen()` | `https://schemas.ariada.org/dos-lagen/2025.json` | [DIGG guidelines](https://www.digg.se/digital-tillganglighet) + [Lag 2018:1937](https://www.riksdagen.se/sv/dokument-lagar/dokument/svensk-forfattningssamling/lag-20181937-om-tillganglighet-till-digital_sfs-2018-1937) |

All three emitters are pure functions — deterministic, no network, no DOM
mutation. They consume a list of `Violation` records (a subset of axe-core's
result shape) plus report metadata, and return a JSON-serialisable report.

## Violation input shape

```ts
import type { Violation, ReportMeta } from "@ariada-org/evidence-emitter";

const violations: Violation[] = [
  {
    id: "color-contrast",
    description: "Insufficient colour contrast",
    help: "Increase contrast ratio to at least 4.5:1 for normal text",
    impact: "serious",
    wcag: ["1.4.3"],
    en301549: ["11.1.4.3"],
    nodeCount: 5,
  },
];

const meta: ReportMeta = {
  productName: "My Web Store",
  productVersion: "2.4.1",
  evaluator: "Agonist Development AB",
  evaluatorContact: "a11y@example.com",
  evaluationDate: "2026-05-15",
  scope: "https://example.com/checkout",
  methodology: "Automated axe-core scan + manual keyboard review",
};
```

## VPAT 2.5

```ts
import { emitVpat } from "@ariada-org/evidence-emitter";

const vpat = emitVpat(violations, meta);
// → { $schema, schemaVersion: '2.5', meta, applicableStandards, criteria, summary }
```

Per-criterion `conformance` is one of:

- `Supports` — no violations mapped to this SC
- `Partially Supports` — moderate / minor violations only
- `Does Not Support` — at least one serious / critical violation
- `Not Applicable` — manually marked
- `Not Evaluated` — AAA criteria default to this (out of standard audit scope)

The `criteria` array covers all 87 WCAG 2.2 success criteria
(A + AA + AAA), seeded from `src/evidence/wcag-22-catalog.ts`.

## EN 301 549 v3.2.1 §11

```ts
import { emitEn301549 } from "@ariada-org/evidence-emitter";

const en = emitEn301549(violations, meta);
// → { $schema, schemaVersion: '3.2.1', meta, clauses, summary }
```

§11 clauses mirror WCAG 2.x success criteria 1:1 — clause `11.x.y.z`
corresponds to SC `x.y.z`. Violations without an explicit `en301549`
mapping are auto-mapped from their WCAG SC list. Direct §11 clauses
(e.g. `11.7` user preferences, `11.8.x` authoring tool) are preserved
when present in the input.

Per-clause `status` is one of: `conformant`, `partially-conformant`,
`non-conformant`, `not-applicable`, `not-evaluated`.

## Swedish DOS-lagen accessibility statement

```ts
import { emitDosLagen } from "@ariada-org/evidence-emitter";

const dos = emitDosLagen(violations, meta, {
  kontakt: {
    epost: "tillganglighet@example.se",
    organisation: "Example AB",
    url: "https://example.se/tillganglighet",
  },
  utvarderingsmetod:
    "Automatisk genomgång med Ariada-skannern samt manuell granskning.",
});
// → { $schema, schemaVersion: '2025', meta,
//     efterlevnadsstatus, efterlevnadsstatusMotivering,
//     ickeForenligaInnehall, kontakt, tillsynUrl,
//     publiceringsdatum, senasteRevision, utvarderingsmetod }
```

Field names mirror Swedish official statement-page terminology per DIGG
guidance. Output JSON renders directly to the legally required statement
page under Lag 2018:1937 art. 7.

Aggregate `efterlevnadsstatus`:

- `helt-forenlig` — fully compliant (zero violations)
- `delvis-forenlig` — partially compliant (moderate / minor only)
- `ej-forenlig` — non-compliant (at least one serious / critical)

## Schema versioning

Each output carries `$schema` and `schemaVersion`. Breaking changes to
output shape will bump `schemaVersion` (semver minor at minimum). The
`$schema` URI is reserved for future hosted JSON schema validation; the
URI does not need to be reachable for the emitters to function.

## Determinism

All three emitters are side-effect free. Given the same inputs they
produce the same output (object identity differs, but the JSON
serialisation is stable). This is verified by JSON-roundtrip tests in
each `*.test.ts` file.

## Future formats (roadmap)

- ADA 2026 (US Department of Justice WCAG 2.1 AA rule, 36 CFR Part 35/36)
- Norway tilgjengelighetserklæring (Difi)
- Finland saavutettavuusseloste (Aluehallintovirasto)
- German BITV 2.0 conformance declaration (BIK / BfIT)
- French RGAA déclaration d'accessibilité (DINUM)

Contributions welcome — open an issue with the official statement
template and the country's enforcement authority URL.
