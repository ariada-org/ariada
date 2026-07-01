# Ariada Bubble Plugin

Bubble plugin scaffold for running Ariada hosted scans from a Bubble workflow.
The plugin is intentionally thin: it does not reimplement scanner logic. It sends
a published Bubble app URL to the Ariada hosted scan API and returns findings as
Bubble action values.

## What Is Included

- `plugin/bubble-plugin.json` describes the Bubble API connector, workflow action,
  returned values and result element.
- `plugin/server-side-action.js` is the copyable server-side action shape for the
  Bubble Plugin Editor.
- `src/action.mjs` is the local Node implementation used by tests and evidence.
- `scripts/run-e2e.mjs` starts a local mock hosted scan API and renders the action
  result as a Bubble-like page for screenshot evidence.

## Bubble Setup

1. Open the Bubble plugin editor from a founder-owned Bubble account.
2. Create a private plugin named `Ariada Accessibility Scan`.
3. Add a server-side action named `Run Ariada scan`.
4. Add private plugin keys for `ARIADA_SCAN_API_URL` and `ARIADA_API_TOKEN`.
5. Copy the action logic from `plugin/server-side-action.js`.
6. Add returned values matching `plugin/bubble-plugin.json`.
7. Install the private plugin in a Bubble test app and call the action from a
   workflow using the app's published URL.

## Local Fixture

```sh
cd integrations/bubble-ariada
npm run lint
npm run validate
npm test
npm run test:e2e
```

The E2E flow uses a local hosted-API-compatible endpoint. It proves the Bubble
action contract and evidence rendering, not Bubble editor import.

## Marketplace Blocker

Bubble marketplace submission is blocked until a founder-owned Bubble plugin
editor account imports the action, the production Ariada hosted scan API is
available, and a Bubble test app demonstrates the workflow inside Bubble.

## Update

- Author: TURING (orchestrator)
- Date: 2026-07-01
