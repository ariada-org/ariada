# Ariada Balsamiq Integration

S126 is a documented Balsamiq export recipe plus a small Node wrapper. It does
not add Balsamiq-side code because there is no Balsamiq plugin marketplace for a
native Ariada plugin.

## What It Does

- Detects a Balsamiq HTML export folder, HTML file, or published Cloud URL.
- Builds the `@ariada-org/cli scan` invocation for that rendered target.
- Refuses PNG/PDF-only low-fidelity wireframes and points designers to the manual
  accessibility checklist below.

This integration is intentionally thin: all scanning remains in `@ariada-org/cli`.
It does not implement contrast math, DOM analysis, or WCAG rule logic.

## Usage

```sh
pnpm install
pnpm run build
node dist/cli.js --export-path fixtures/html-export --output-dir ariada-output --print
node dist/cli.js --target-url https://example.test/balsamiq/prototype --output-dir ariada-output
```

## Manual Checklist For Low-Fidelity Exports

PNG/PDF-only Balsamiq wireframes do not expose a DOM, ARIA tree, computed styles,
or reliable final colors. For those exports, automated checks are out of scope.
Use the wireframe review to record:

- Reading order intent for WCAG 1.3.2 and 2.4.3.
- Visible labels, helper text, and error-message intent for WCAG 2.4.6 and 3.3.2.
- Target-size intent for tappable controls before implementation, mapped to WCAG
  2.5.8.

Run the full Ariada scan once the wireframe is implemented as a page or when a
Balsamiq Cloud HTML/published URL is available.

## Local Gates

```sh
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run validate
```

## Live-Host Blocker

Blocked: Balsamiq does not provide a plugin marketplace for this distribution.
The founder/listing step is to publish this recipe in an organization-owned
examples repository and link it from Balsamiq workflow documentation.

## Status

Filler-tier channel. Useful only for HTML export or published URL scans; PNG/PDF
wireframes remain manual guidance until rendered into HTML.
