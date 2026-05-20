# @ariada/scan-report-html

Render machine-readable accessibility scan artefacts into a single self-contained human-readable HTML report.

Open source under [EUPL-1.2](./LICENSE).

## What this package does

Consumes the canonical scan-artefact tuple (`scan-results.json` + optional `screenshot.png`) and produces one `scan-report.html` file that a developer, accessibility auditor, compliance officer, or stakeholder can open directly in a browser — no JSON tooling, no static-site generator, no internet connection required.

The package is the engineering answer to the «JSON dump is not a report» gap: every output is a single HTML5 file with inline CSS, embedded screenshots (when supplied), severity-coded violation cards, prioritised action items, and a compliance-score gauge.

The renderer is a pure function. Same input bytes, same output bytes (deterministic — see spec). No telemetry, no remote fetches, no third-party fonts, no CDN references.

## Install

```bash
npm install @ariada/scan-report-html
```

## Quick start

```ts
import { renderScanReport } from '@ariada/scan-report-html';
import type { ScanReportInput } from '@ariada/scan-report-html';

const input: ScanReportInput = {
 meta: {
 url: 'https://example.org/checkout',
 timestamp: '2026-05-19T16:05:52.101Z',
 scannerVersion: '0.1.0',
 axeVersion: '4.10.2',
 userAgent: 'Chromium/124',
 viewport: '1280x720',
 },
 findings: [
 {
 id: 'image-alt',
 impact: 'critical',
 description: 'Ensure <img> elements have alternate text',
 help: 'Images must have alt attributes',
 helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
 wcag: ['1.1.1'],
 nodes: [
 {
 selector: 'main > section.hero > img',
 html: '<img src="/hero.jpg" width="1200" height="400">',
 },
 ],
 },
 ],
};

// Pure call — returns the HTML string.
const html: string = renderScanReport(input);

// Or write to disk — returns { path, bytes }.
const { path } = await renderScanReport(input, {
 outputDir: 'tests/acceptance/results/example/',
});
```

## What the report contains

Each rendered file includes, in order:

1. **Header** — URL, scan timestamp, scanner version.
2. **Summary dashboard** — compliance score (heuristic) gauge + severity breakdown bars (critical / serious / moderate / minor).
3. **Empty-state notice** — shown when no findings.
4. **Findings** — one card per `ScanFinding`, sorted critical → serious → moderate → minor:
 - Severity badge (text + icon — colour is never sole information conveyor; WCAG 1.4.1).
 - Rule ID and primary WCAG 2.2 Success Criterion link (`target="_blank" rel="noopener noreferrer"`).
 - Plain-English description + one-line help.
 - Affected element selector and HTML snippet (escaped, truncated).
 - Help-URL link out to authoritative rule documentation.
 - Element screenshot crop hookpoint (Phase-3 wire-up — empty placeholder in v0.1).
5. **Action items** — top-10 prioritised by `severity_weight × node_count`, each anchor-linked to the matching card.
6. **Methodology footer** — scanner version + axe-core version + WCAG version + EN 301 549 version + browser + viewport.
7. **Identity footer** — bit-exact maintainer attribution + EUPL-1.2 reference.

## Design rules

The package follows strict output-discipline rules :

- No external CDN reference.
- No `<script src="…">` — no inline JS either (v0.1).
- No `<link rel="stylesheet">` — all CSS inlined in one `<style>` block.
- No third-party fonts — system font stack only.
- No telemetry, no analytics, no tracking pixel.

These invariants are enforced by automated tests (`test/unit/render.test.ts` + `test/unit/self-audit.test.ts`).

## Accessibility

The renderer eats its own dog food. The produced report is built against WCAG 2.2 Level AA:

- Semantic landmarks (`<header>`, `<main>`, `<footer>`).
- Single `<h1>`, ordered heading hierarchy.
- Skip-link as the first focusable element.
- All interactive controls keyboard-reachable with a visible focus ring (3px outline, ≥3:1 contrast).
- Severity palette pre-verified at ≥4.5:1 contrast against background.
- `<details>`/`<summary>` for collapsible sections (no ARIA-disclosure trap).
- No `<iframe>`, no autoplaying media.
- `<html lang="…">` declared per WCAG 3.1.1.

A full axe-playwright pass against the rendered output lands as the Phase-5 E2E gate (see the per spec). The shipped unit suite enforces the structural invariants that static-HTML analysis can confirm without spawning a browser.

## API

### `renderScanReport(input)` — pure

Returns the HTML string. No I/O.

### `renderScanReport(input, { outputDir })` — disk-write

Async. Writes `scan-report.html` (or `options.filename`) under `outputDir`, creating the directory if it does not exist. Resolves to `{ path, bytes }`.

### `RenderOptions`

| Field | Type | Default | Meaning |
|---|---|---|---|
| `includePenalty` | `boolean` | `false` | Show penalty-exposure block. Off by default — legal hygiene. |
| `locale` | `'en'` | `'en'` | Static-prose locale. Swedish + German planned for v0.2. |
| `releaseBuild` | `boolean` | `true` | Strip the cert-block hookpoint HTML comment from output. |

### Re-exports

- Score helpers — `computeComplianceScore`, `bandFromScore`, `topActionItems`, `severityBreakdown`, `ScoreBand`.
- WCAG SC slug table — `WCAG_22_SC_SLUG`, `wcagSCUrl(sc)`.
- Escape utilities — `escapeHtml`, `escapeAndTruncate`, `escapeUrl`.

## Engineering reference

This v0.1 scaffold lands the foundational sections, deterministic rendering, structural self-audit, and CLI-ready API surface. Subsequent commits will land:

- Sharp-based element-crop pipeline (Phase 3).
- WCAG 2.2 matrix section when VPAT input is provided (Phase 4).
- Localisation matrix (Swedish + German Phase 5).
- Rule-fix remediation lookup table (spec, Phase 2-3).
- Cross-browser E2E (Chromium / Firefox / WebKit) + axe-playwright self-scan (spec, Phase 6).
- CLI wrapper + wiring into `eaa-pipeline` GitHub Action (spec, Phase 7).

## Maintainer

Maintained by Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726).

License: [EUPL-1.2](./LICENSE).
