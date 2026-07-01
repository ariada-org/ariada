# Ariada Framer Plugin

Thin Framer plugin scaffold for local design-time Ariada checks on the current
canvas context. It maps Framer frame/page nodes into the same simple design-node
shape used by the Sketch adapter, then checks contrast, interactive target size,
and missing text alternative or description markers.

## What is Framer?

Framer is a visual website builder and design canvas with a plugin system for
small apps that can interact with the editor. Official Framer docs describe
plugins as apps that can insert or modify canvas layers, images, code components,
CMS content, and site data.

## Sources

- Framer Developers, "Welcome to Plugins", accessed 2026-07-01, primary/high:
  https://www.framer.com/developers/plugins-introduction
- Framer Developers, "Quick Start", accessed 2026-07-01, primary/high:
  https://www.framer.com/developers/plugins-quick-start
- Framer Marketplace Plugins category counts, accessed 2026-07-01,
  primary/high: https://www.framer.com/community/marketplace/plugins/

## Why this is a separate Ariada channel

Framer is a design and no-code publishing surface, not only a production website
runtime. A separate channel lets Ariada catch accessibility defects before a
Framer page is shipped: low text contrast in a frame, small tappable controls,
and image-like layers that lack handoff text alternatives or descriptions.

## Competitors

Competitors and adjacent channels include Framer's native plugin marketplace,
Figma and Sketch design-time checks, Webflow and Wix no-code publishing checks,
and production scanners from Deque, Siteimprove, Evinced, AudioEye, and
accessiBe. The Framer channel is narrower: it targets the designer's current
canvas context and returns design-mappable remediation rather than crawling a
published site.

## Roles: who pays / what value they buy

Designers and agencies pay for earlier feedback while editing Framer pages.
Product and marketing teams buy lower rework before legal or QA review. EU site
owners buy EAA/WCAG risk reduction before publishing pages that can become public
customer journeys. Developers buy a bridge from design issues to Ariada's CLI and
evidence reports without waiting for a deployed build.

## Domains

Primary domains are Framer design canvases, no-code marketing sites, agency
landing pages, EU digital-service journeys, and pre-publication accessibility
review. This integration does not scan unrelated Ariada domains such as browser
extensions, CMS plugins, CI adapters, or mascot assets.

## Implemented vs not implemented

Implemented:

- `framer.json` canvas-mode plugin scaffold with a Framer plugin entry point.
- React panel source with a Run scan action and result list.
- Framer adapter that reads selection, current page, or canvas root when those
  APIs are available in the live plugin runtime.
- Local audit core for contrast, target-size, and text-alternative checks.
- Known-bad Framer-style frame fixture.
- Local fixture flow that writes `test-report/result.html`,
  `scan-evidence/result.html`, `scan-evidence/result.json`, and a nonblank
  screenshot PNG.

Not implemented:

- Live Framer dev-mode verification, because this terminal session does not have
  a signed-in Framer desktop/browser account with Developer Tools enabled.
- Marketplace submission, paid listing, and workspace-private distribution.
- Deep Framer-specific node coverage beyond the documented canvas-mode scaffold
  and defensive adapter.

## Technical connectors

- Framer Plugin API: `framer.json`, canvas mode, plugin UI, and Framer runtime
  object.
- Ariada design-node adapter: `src/framer-adapter.cjs`.
- Local Ariada checks: `src/audit.cjs`.
- Fixture evidence: `fixtures/known-bad-frame.json`.

## Evidence

Run:

```bash
npm run lint
npm test
npm run evidence
npm run check:headings
```

Evidence outputs:

- `test-report/result.html`
- `scan-evidence/result.html`
- `scan-evidence/result.json`
- `scan-evidence/result-screenshot.png`

The known-bad fixture intentionally produces one contrast issue, one target-size
issue, and one text-alternative issue.

## Screenshot

The local fixture flow writes a direct screenshot evidence image at
`scan-evidence/result-screenshot.png`. The evidence validator confirms it is a
PNG, at least 640 by 360 pixels, and nonblank.

## Blockers

Framer live dev-mode loading remains host-blocked until a human opens Framer,
enables Developer Tools from the plugin menu, runs `npm run dev`, and chooses
"Open Development Plugin" in a Framer project. The official Quick Start documents
that flow and notes that local development plugins are picked up by Framer while
the dev command is running.

## Distribution

Short term: local development plugin for internal design review. Next steps after
human Framer verification: private workspace distribution, then Framer
Marketplace submission if the plugin UI and node coverage are productized.

## Monetization

The likely paid lane is an agency/team add-on: scan current Framer pages before
publishing, export Ariada evidence, and map results into designer-owned fixes.
A free marketplace listing can cover the local scan, while paid Ariada plans can
unlock team evidence history, CLI parity, and compliance reporting.

## Development

```bash
npm run lint
npm test
npm run evidence
npm run check:headings
```

For live Framer development, install plugin dependencies and run:

```bash
npm run dev
```

Then open Framer, enable Developer Tools in the plugin menu, and open the
development plugin from a project canvas.

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01
