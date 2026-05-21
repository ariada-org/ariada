<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Example 03 — programmatic evidence-bundle emission

A minimal end-to-end example showing how to produce three machine-readable
compliance reports (VPAT 2.5, EN 301 549 v3.2.1 §11, and Swedish DOS-lagen)
from a list of axe-core-shaped violations using `@ariada-org/evidence-emitter`.

## What this shows

`@ariada-org/evidence-emitter` exports three pure functions that turn a
normalised violation list plus a small `meta` object into machine-readable
evidence:

- `emitVpat(violations, meta)` — VPAT 2.5 JSON (US Section 508 / ITI).
- `emitEn301549(violations, meta)` — EN 301 549 v3.2.1 §11 Conformance
  Statement.
- `emitDosLagen(violations, meta, options)` — Swedish DOS-lagen statement
  with the Nordic jurisdiction and DIGG enforcement-authority URL.

The example uses a fixed, synthetic violation list so it runs offline. In
real use, the violation list comes from a scan — e.g.
`ariada scan ... --format json` (see `examples/01-cli-scan/`) — and the
three emitters consume it directly.

## Setup

This example uses a workspace-linked package, so run `pnpm install` at the
monorepo root once before running anything here:

```sh
# from the monorepo root
pnpm install
pnpm --filter @ariada-org/evidence-emitter build
```

## Run

```sh
cd examples/03-evidence-bundle
pnpm start
```

The script writes three files to `./out/`:

| File             | Format                             |
| ---------------- | ---------------------------------- |
| `vpat.json`      | VPAT 2.5 (US Section 508 / ITI)    |
| `en301549.json`  | EN 301 549 v3.2.1 §11 Conformance  |
| `dos-lagen.json` | Swedish DOS-lagen statement (DIGG) |

The console summary reports the number of WCAG criteria, EN 301 549 §11
rows, and the DOS-lagen overall conformance status for the input set.

A trimmed sample of `vpat.json` is included in [`expected-bundle.json`](./expected-bundle.json)
for orientation; the actual emitter output includes the full WCAG 2.2 SC
catalogue (87 criteria, all A / AA / AAA levels), not just the failing ones.
