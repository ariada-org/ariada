<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: EUPL-1.2 -->

# @ariada-org/ariada-extension

A Chrome (Manifest V3) side-panel extension that scans the active browser tab
against multiple compliance domains in a single shared DOM pass, then renders the
results as an accessible grid. All processing is local — no server round-trips.

## What it does

- Opens a side panel from the toolbar action.
- Captures the active tab's DOM into a portable snapshot.
- Runs every registered domain (accessibility, privacy, security, AI readiness,
  structured data, sustainability) over that one snapshot using the shared
  scanner engine, so adding a domain adds zero extra DOM traversals.
- Renders a site × domain grid with per-cell finding counts, cross-site systemic
  findings, and cross-domain interaction notes.
- Exports the unified report as JSON.

## User-pluggable domain modules

The settings page accepts additional domain modules through three paths:

- **Companion CLI (full trust)** — a published `ariada-domain-*` package name.
  The command-line tool rebuilds the extension with the module bundled in, so it
  runs at full trust inside the shared scan pass.
- **Local file (sandboxed, lower trust)** — a local `.js`/`.mjs` file. In this
  v0.1 release the input validation and warning labelling are wired; the sandbox
  execution bridge is a documented stub and lands in a later release.
- **Remote URL (rejected)** — loading a module from an http/https URL is rejected
  because the Chrome Web Store Developer Program Policies prohibit fetching and
  executing remotely hosted code.

## Build

```sh
pnpm --filter @ariada-org/ariada-extension build
```

This produces a loadable Manifest V3 directory at `dist/`. Load it via
`chrome://extensions` → "Load unpacked", or point Playwright's
`--load-extension` at it.

## Test

```sh
pnpm --filter @ariada-org/ariada-extension test       # unit tests (vitest)
pnpm --filter @ariada-org/ariada-extension test:e2e   # end-to-end (Playwright, loads the built extension)
```

## License

EUPL-1.2. Copyright Agonist Development AB. See `LICENSE`.
