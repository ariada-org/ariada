# Ariada Figma Plugin

Local Figma plugin for design-time Ariada accessibility checks. It scans the
current Figma selection and reports design-mappable issues for contrast, target
size, text alternatives, and semantic layer metadata before a design becomes
code.

## Development Loading

1. Run `pnpm --filter @ariada-org/figma-plugin build`.
2. Open Figma desktop.
3. Use `Plugins > Development > Import plugin from manifest...`.
4. Select `packages/ariada-figma-plugin/manifest.json`.
5. Select a frame or component and run `Ariada Accessibility Scan`.

The manifest points to `dist/code.js`, so build before loading. The UI file is
loaded from `src/ui.html` for local development.

## Usage

The plugin scans selected nodes only. It recursively walks children and reports:

- Low text contrast against the nearest solid background.
- Interactive targets below 24 px minimum or below the 44 px preferred touch
  target.
- Image-like nodes without `alt`, `aria-label`, or `description` plugin data,
  unless `decorative=true`.
- Generic landmark or heading metadata that would make handoff semantics weaker.

The supported plugin data keys are `role`, `alt`, `aria-label`, `description`,
`decorative`, and `headingLevel`.

## Limitations

- No network calls are made; the manifest declares `networkAccess.allowedDomains:
  ["none"]`.
- Figma layer data is not a browser DOM. This plugin does not replace runtime
  Ariada scans of implemented pages.
- Background detection uses the nearest solid fill. Blends, images, gradients,
  effects, and token inheritance need later expansion.
- Figma Community publishing is blocked until the founder uses the Ariada-owned
  Figma account to create the listing and complete marketplace review.

## Evidence

Run the local harness:

```sh
pnpm --filter @ariada-org/figma-plugin test:e2e
pnpm --filter @ariada-org/figma-plugin validate:evidence
```

The harness scans `tests/fixtures/known-bad-frame.json` and writes:

- `test-report/result.html`
- `scan-evidence/result.html`
- `scan-evidence/result.json`
- `scan-evidence/run-output.txt`

Update:
- Author: EULER (orchestrator)
- Date: 2026-07-01
