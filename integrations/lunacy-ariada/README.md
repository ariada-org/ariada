# Ariada Lunacy Plugin

Lunacy utility plugin for design-time accessibility checks on selected layers.
It is a thin adapter: selected Lunacy layers are rendered into a temporary local
HTML target, and `@ariada-org/cli` performs the actual accessibility scan.

## What It Checks

- Text and UI contrast that survives the HTML export path.
- Target size for named interactive layers such as buttons, controls, links,
  hotspots, and tap targets.

Lunacy design files do not expose a browser DOM, ARIA tree, CSS cascade, or final
focus order. Full accessibility coverage still requires scanning the built page.

## Load In Lunacy

1. Enable Lunacy's MCP / HTTP Automation API.
2. Build this package with `pnpm run build`.
3. Copy or symlink this directory into the Lunacy plugins folder:
   - Linux: `~/.local/share/Icons8/Lunacy/Plugins/ariada-lunacy`
   - Windows: `%LOCALAPPDATA%\\Icons8\\Lunacy\\Plugins\\ariada-lunacy`
   - macOS: `~/Library/Application Support/Icons8/Lunacy/Plugins/ariada-lunacy`
4. Select a frame or layer group and run `Scan Selection with Ariada`.

The command reads `/getselected` from Lunacy's local Automation API, serves a
temporary scan target on `127.0.0.1`, then runs:

```bash
npx --yes @ariada-org/cli scan <local-url> --format json
```

## Development

```bash
../../node_modules/.bin/tsc -p tsconfig.json --noEmit
node --check tests/index.test.mjs
node scripts/validate-manifest.mjs
../../node_modules/.bin/tsc -p tsconfig.json && node --test tests/*.test.mjs
```

The package also has normal `npm` scripts for use when copied outside this
monorepo. Inside this checkout it is deliberately not listed in
`pnpm-workspace.yaml`, so direct commands avoid root workspace dispatch.

For fixture-only testing without Lunacy:

```bash
pnpm run build
node dist/cli.js scan-file tests/fixture-selection.json
```

## Sources

- Lunacy plugins are external programs using the HTTP Automation API:
  https://github.com/icons8/lunacy-plugins
- Lunacy plugin configuration uses `plugin.jsonc` and utility commands:
  https://github.com/icons8/lunacy-plugins/blob/main/docs/PLUGIN_DEVELOPMENT_GUIDE.md
- The local Automation API exposes `/getselected` and `/export`:
  https://github.com/icons8/lunacy-plugins/blob/main/docs/PLUGIN_DEVELOPMENT_GUIDE.md
- Ariada CLI scan contract:
  ../../packages/ariada-cli/README.md

## Manual Gate

Host validation requires Lunacy desktop with MCP enabled and an Icons8/Lunacy
plugin distribution path. That host/listing step is founder-owned; this package
documents it in `scan-evidence/result.html` and does not claim marketplace or
in-host completion without those credentials.
