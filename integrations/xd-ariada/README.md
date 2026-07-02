# Ariada Adobe XD Plugin

This is a thin Adobe XD channel over the shared `@ariada-org/cli`.
It does not implement WCAG logic, contrast math, target-size rules, or a
separate scanner.

Adobe XD is in maintenance mode and the local XD desktop runtime is not
available in this workspace. The checked path is therefore the closest realistic
plugin/export fixture:

1. The XD panel reads the current selection and serializes an XD-like node tree.
2. `src/adapter.mjs` converts that tree into a local HTML export.
3. `scripts/scan-export.mjs` serves the export on localhost and invokes
   `@ariada-org/cli scan`.
4. `scan-evidence/result.html` records the blocker, command log, raw scanner
   artifact, screenshot, community sources, and tested surface.

## Local Gates

```sh
npm run lint
npm test
npm run validate:manifest
npm run typecheck
npm run evidence
```

`npm run evidence` requires the monorepo `@ariada-org/cli` package to be built
and its runtime dependencies installed. If the CLI or browser runtime is
unavailable, the script writes the exact failing command and exit code into
`scan-evidence/command.log` and the report classifies that as a blocker.

## Adobe XD Blocker

Live plugin loading and marketplace submission are blocked in this workspace:
Adobe XD desktop, Creative Cloud plugin development mode, and Adobe Marketplace
submission access are founder-owned gates. The report does not claim a live XD
Marketplace release.

## Manual XD Smoke

1. Open Adobe XD.
2. Choose Plugins > Development > Show Develop Folder.
3. Copy or symlink this directory into that folder.
4. Reload plugins and open the Ariada panel.
5. Select an artboard with low-contrast text, a small interactive control, and
   an image layer without an alternative-text marker.
6. Export the panel JSON and run `node scripts/scan-export.mjs --fixture <json>`.

The expected result is an HTML export scanned by the shared Ariada CLI, plus
local evidence artifacts under `scan-evidence/`.
