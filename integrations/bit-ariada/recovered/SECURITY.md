# Security

Report suspected vulnerabilities through the security contact documented by the
ariada.org project. Do not put secrets or private target URLs in public issues.

## Browser policy

No browser download is permitted. Installation and packaging set
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and use `--ignore-scripts`. Runtime scans
require an explicitly provisioned cache through `PLAYWRIGHT_BROWSERS_PATH`.

## Trust boundaries

- Render roots, pages, and reports are constrained to the current Bit capsule.
- Reports cannot overlap the rendered root and are written with owner-only mode.
- The static server binds only to an ephemeral `127.0.0.1` port, rejects path and
  symlink escapes, disables caching, and closes in `finally`.
- Rendered components are project-authored executable browser content. Scan only
  trusted component repositories.
- Scanner output is parsed fail-closed. Schema identity, URL, counts, analyzer,
  AX tree, and process/report exits must agree.
- Runtime code does not spawn a shell, upload evidence, accept credentials, or
  expose a public listener.

## Supply chain

All direct versions are exact. The package bundles its complete executable
runtime while leaving Bit Builder as an optional exact host peer. Empty-cache
offline installation proves the published artifact needs neither registry access
nor lifecycle scripts. `npm audit --omit=dev --audit-level=high`, content policy,
deterministic double-pack, checksums, and inventory are mandatory release gates.
