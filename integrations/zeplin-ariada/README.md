# Ariada Zeplin Extension

Thin Zeplin extension/export adapter for Ariada evidence. It maps Zeplin
handoff data into a browser-rendered fixture and scans that fixture with the
shared `@ariada-org/cli`; it does not implement WCAG rules or contrast logic
inside this package.

## Local Development

```bash
npx --yes --package typescript --package @types/node tsc -p tsconfig.json
node --test dist/tests/*.test.js
node scripts/validate-manifest.mjs
node scripts/build-evidence.mjs
```

Build the shared scanner first from the repo root:

```bash
pnpm --filter @ariada-org/cli build
```

## Zeplin Host Blocker

Live Zeplin registry submission is blocked here. Publishing requires a Zeplin
account/workspace and either interactive `zem publish` review or a
`ZEM_ACCESS_TOKEN` configured by the founder. The closest available host surface
is the recorded export fixture in `tests/fixtures/zeplin-export.json`.

## Sources

- Zeplin extension overview:
  https://support.zeplin.io/en/articles/3785332-building-and-publishing-a-zeplin-extension
- Zeplin extension package metadata and exported functions:
  https://github.com/zeplin/zeplin-extension-documentation/blob/main/tutorial.md
- Zeplin Extension Manager:
  https://github.com/zeplin/zem
