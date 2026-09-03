<!--
SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# `@ariada-org/anti-overlay`

Detection-only library for third-party accessibility-overlay widgets on a web page. Pattern-matches against a curated registry of per-vendor signatures (script URLs, DOM ids, class prefixes, attributes, global JS variables, iframe-src patterns) and returns a structured report with verbatim citations of the W3C-WAI Accessibility Overlay community position and the OverlayFactsheet community statement.

The package does **not** recommend removal, does **not** auto-fail a scan, does **not** auto-disable any widget, and does **not** issue a WCAG or EAA non-conformance verdict. Detection only — the compliance decision is left to the operator and qualified counsel.

## Install

```bash
pnpm add @ariada-org/anti-overlay
```

## Quick start

```ts
import { detectOverlays } from '@ariada-org/anti-overlay';

const html = await (await fetch('https://example.test/')).text();
const report = await detectOverlays({ html });

for (const hit of report.vendorsDetected) {
  console.log(hit.vendor, hit.confidence, hit.signaturesMatched.length);
}
console.log(report.citations.w3cWaiOverlayPosition);
console.log(report.citations.overlayFactsheet);
console.log(report.citations.disclaimer);
```

URL input is supported via a caller-supplied fetcher (the package itself never opens a network socket):

```ts
const report = await detectOverlays(
  { url: 'https://example.test/' },
  { fetcher: async (u) => (await fetch(u)).text() },
);
```

## Coverage

Initial v0.1 registry covers ten signatures: accessiBe, UserWay, EqualWeb / Accessibly, AudioEye (overlay-mode), Recite Me, MaxAccess, accessiBe-iframe variant, FACIL'iti, Purple Lens / PurpleHat / Purple Cube, and a generic accessibility-toolbar catch-all heuristic. Adding a vendor signature is a semver-minor bump; changing the report schema is a semver-major bump.

## Confidence rubric

Each detected vendor is assigned `high`, `medium`, or `low`:

- **high** — at least one network-anchored signature (script-src or iframe-src) matched, or three-plus non-network signatures.
- **medium** — exactly two non-network signatures matched.
- **low** — exactly one non-network signature matched.

Some vendors carry an explicit cap (the accessiBe-iframe variant tops out at `medium`; the generic-toolbar catch-all is locked at `low`).

## Citations

Every report carries the same citations block:

> Detection is mechanical pattern-matching. The fact a vendor is present does not by itself prove WCAG / EAA non-conformance. NOT LEGAL ADVICE.

Citation URLs:

- W3C-WAI Accessibility Overlay glossary entry
- OverlayFactsheet community statement

The citation block is present even when zero vendors are detected so consumers can surface the references as informational context.

## Performance

Target: P50 ≤ 20 ms, P95 ≤ 100 ms per page of up to 1 MB HTML. All regexes are linear-time-verifiable and host-anchored to prevent false positives on stray substring occurrences.

## License

EUPL-1.2. See `LICENSE` and `NOTICE`.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
