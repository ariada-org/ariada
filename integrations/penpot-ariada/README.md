# Ariada Penpot Plugin

Thin Penpot plugin/export adapter for Ariada accessibility evidence. It reads the
current Penpot selection, exports a small HTML surface, shows design-time hints
for contrast and target size, and leaves the canonical scan to the shared
`@ariada-org/cli`.

## What It Does

- Provides a Penpot `manifest.json` and plugin entrypoint.
- Requests read-only Penpot content access plus download permission for local
  export.
- Maps Penpot-like shapes into an HTML fixture that the Ariada CLI can scan.
- Keeps local design hints intentionally narrow: contrast preview and
  interactive target-size preview.
- Generates `scan-evidence/result.html`, raw scanner JSON, command logs, and a
  standalone plugin-panel screenshot from the fixture when a real Penpot host is
  unavailable.

## Development

```bash
npm run build
npm run lint
npm test
npm run validate:manifest
```

To generate evidence after `packages/ariada-cli` is built:

```bash
npm run evidence
```

## Load In Penpot

1. Build this package.
2. Serve this directory over HTTP.
3. Open a Penpot file.
4. Open the Plugin Manager with `Ctrl+Alt+P` or the Penpot toolbar/menu.
5. Load the served `manifest.json` URL.

Publication is blocked until an Ariada-owned Penpot hosting/registry surface is
available. Local loading is still testable with a served manifest URL.

## Sources

- Penpot explains that plugins are independent iframe modules hosted outside
  Penpot: https://help.penpot.app/plugins/getting-started/
- Penpot documents `manifest.json`, relative paths with `"version": 2`,
  permissions, and `content:read`: https://help.penpot.app/plugins/getting-started/
- Penpot documents plugin/UI message passing and `penpot.ui.open()`:
  https://help.penpot.app/plugins/create-a-plugin/
- Penpot plugin TypeScript definitions are provided by `@penpot/plugin-types`:
  https://doc.plugins.penpot.app/

## Blockers

Blocked: real Penpot plugin registry/organization hosting and production manifest
publication require a founder-controlled Penpot account and hosting URL.
Owner: founder. Next action: provide the Ariada Penpot account/hosting surface,
then load this manifest in a real design file and replace the fixture screenshot
with host evidence.
