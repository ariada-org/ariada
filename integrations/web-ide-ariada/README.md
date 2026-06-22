# Ariada Web IDE Integration

CodeSandbox and StackBlitz recipe for running Ariada in an in-browser
development workspace.

## What It Does

- Provides template configs for CodeSandbox and StackBlitz.
- Builds the Ariada CLI invocation for a preview URL or static output.
- Parses CLI JSON into a terminal-friendly summary.

## Local Gates

```sh
npm test
npm run typecheck
node scripts/validate-templates.mjs
```

The actual in-platform run is a demo gate, not a local gate, because publishing
templates requires organization accounts on CodeSandbox and StackBlitz.

## Live-Host Blocker

Blocked: public template publishing requires CodeSandbox and StackBlitz
organization access.

Owner: founder. Next action: create/import the example project into both
platforms and publish the template links.
