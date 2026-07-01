# Ariada Wix App Adapter

This directory is a local S10 Wix dashboard fixture for Ariada. It proves the
dashboard-to-hosted-scan flow without copying scanner logic into a Wix app.

## What Is Included

- `src/adapter.js` builds the dashboard request and normalises Ariada scan JSON.
- `fixture/index.html` is a Wix-dashboard-style panel.
- `scripts/mock-server.mjs` serves the panel and a mocked hosted Ariada scan
  endpoint at `POST /api/ariada/scan`.
- `scripts/run-e2e.mjs` runs the local route flow and writes raw evidence.
- `scripts/build-evidence-report.mjs` writes the Dash-style evidence report.

## Local Use

```sh
cd integrations/wix-ariada
npm run lint
npm test
npm run e2e
npm run fixture
```

Open the fixture URL printed by `npm run fixture`, press `Run scan`, then capture
the rendered panel screenshot for `scan-evidence/screenshots/wix-dashboard-panel.png`.
After the screenshot exists:

```sh
npm run evidence
npm run validate:links
```

## Wix Developer Account Requirements

A real Wix app still requires founder-owned setup:

- Wix developer account and app registration.
- Wix CLI or dashboard configuration for a dashboard page.
- Signed app instance handling for installed-site context.
- Production Ariada hosted scan API endpoint and authentication.
- Wix App Market review and listing approval.

The local fixture is intentionally the closest account-free substitute. Wix apps
cannot rely on arbitrary local scanner execution inside the dashboard; this
adapter models the hosted API route that the real app should use.

## Evidence

- E2E report: `test-report/result.html`
- Evidence report: `scan-evidence/result.html`
- Raw mocked scan JSON: `scan-evidence/mock-scan-response.json`
- Screenshot: `scan-evidence/screenshots/wix-dashboard-panel.png`

## Sources

- Wix self-managed apps, official Wix Developers docs, accessed 2026-07-01,
  primary source, high reliability:
  https://dev.wix.com/docs/build-apps/develop-your-app/develop-a-self-managed-app/about-self-managed-apps
- Wix APIs, official Wix Developers docs, accessed 2026-07-01, primary source,
  high reliability:
  https://dev.wix.com/docs/build-apps/develop-your-app/api-integrations/about-wix-apis
- Wix app instances, official Wix Developers docs, accessed 2026-07-01, primary
  source, high reliability:
  https://dev.wix.com/docs/build-apps/develop-your-app/access/app-instances/about-app-instances
- Wix changelog dashboard SDK note, official Wix Developers docs, accessed
  2026-07-01, primary source, high reliability:
  https://dev.wix.com/docs/changelog

## Update

- Author: GAUSS (orchestrator)
- Date: 2026-07-01
