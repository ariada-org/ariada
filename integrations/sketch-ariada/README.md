# Ariada Sketch Plugin

Sketch plugin for local design-time accessibility review. It scans the current
selection and reports issues in a Sketch alert plus a short document message.
It does not call external services.

## Checks

- Text contrast against the nearest solid parent background.
- Interactive target size for named controls and prototyping hotspots.
- Text alternatives for image-like layers.

## Load In Sketch

1. Open Sketch desktop.
2. Choose Plugins > Manage Plugins > gear menu > Show Plugins Folder.
3. Copy or symlink `ariada-accessibility-check.sketchplugin` into that folder.
4. Restart Sketch if the plugin is not visible.
5. Select an artboard or layer group, then run Plugins > Ariada > Audit Selection.

The plugin can also be loaded by double-clicking the
`ariada-accessibility-check.sketchplugin` bundle in Finder.

## Text Alternative Markers

Sketch has no general web `alt` attribute. For design handoff, this plugin accepts
either of these markers:

- Layer name begins with `Alt:` for meaningful images.
- Layer name begins with `Decorative:` for decorative images.
- Layer setting `ariada.altText` contains non-empty text.

## Development

```bash
npm run lint
npm test
npm run validate:manifest
```

The tests run against the same pure JavaScript audit module that the Sketch
command loads from the plugin bundle.

## Sources

- Sketch plugin bundles use `.sketchplugin/Contents/Sketch` for `manifest.json`
  and command scripts: https://developer.sketch.com/plugins/plugin-bundle
- Sketch manifests define commands with `identifier`, `script`, and optional
  `handler`: https://developer.sketch.com/plugins/plugin-manifest
- Sketch plugins access the selected document and selected layers through the
  JavaScript API: https://developer.sketch.com/reference/api/
- Sketch UI exposes document messages and alerts for simple result surfaces:
  https://developer.sketch.com/reference/api/

## Manual Gate

Sketch desktop loading is the remaining manual gate. Use the load steps above,
create a known-bad artboard with low-contrast text, an 18 by 18 px layer named
`Icon button`, and an image layer named `Hero photo`; the audit should report
contrast, target-size, and text-alternative issues.

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-06-22
