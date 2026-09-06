# Ariada for Webflow

Thin Webflow Designer/Data app adapter for Ariada hosted scan semantics. The
adapter prepares Webflow OAuth and page scan requests, normalizes Ariada findings
for a Designer panel, and includes a local fixture that represents the panel
while the real Webflow app account and marketplace review are unavailable.

## What It Does

- Builds Webflow OAuth authorization URLs for a future Ariada hosted app.
- Builds hosted Ariada scan requests for the current Webflow site/page URL.
- Normalizes Ariada finding shapes into Designer-panel rows.
- Provides a local Designer-panel fixture for browser evidence.
- Does not implement scanner rules or WCAG logic.

## Setup

```sh
pnpm --dir integrations/webflow-ariada run lint
pnpm --dir integrations/webflow-ariada test
pnpm --dir integrations/webflow-ariada run test:e2e
pnpm --dir integrations/webflow-ariada build
```

For manual fixture review:

```sh
PORT=4871 node integrations/webflow-ariada/scripts/serve-fixture.mjs
```

Then open `http://127.0.0.1:4871/` and click `Run scan`.

## Webflow App Requirements

A production version needs a registered Webflow App with Designer Extension and
Data Client capabilities, an HTTPS OAuth callback, a hosted Ariada token exchange
service, a hosted scan API endpoint, and a Designer Extension bundle uploaded
through Webflow app version management.

## Local Fixture Use

The fixture serves a Webflow-like Designer panel and a local `/api/scan` endpoint.
That endpoint returns Ariada-shaped findings so the panel, report generator and
evidence links can be tested without a Webflow developer workspace. This is only
contract evidence; it is not a live Webflow install.

## Marketplace Blocker

Webflow Marketplace submission is blocked on human-owned Webflow account access,
app registration, OAuth credentials, extension bundle upload, reviewer access,
demo video, documentation and public review approval.

## Evidence

- Test report: `test-report/result.html`
- Evidence report: `scan-evidence/result.html`
- Raw local scan JSON: `scan-evidence/ariada-output/webflow-panel-report.json`
- Browser screenshot: `scan-evidence/screenshots/webflow-panel.png`

## Sources

- Webflow Developers, Register an App, accessed 2026-07-01, primary/high:
  https://developers.webflow.com/data/docs/register-an-app
- Webflow Developers, Designer API introduction, accessed 2026-07-01,
  primary/high: https://developers.webflow.com/designer/reference/introduction
- Webflow Developers, Submitting Your App to the Webflow Marketplace, accessed
  2026-07-01, primary/high:
  https://developers.webflow.com/data/v2.0.0-beta/docs/marketplace/submitting-your-app
- Webflow Developers, OAuth, accessed 2026-07-01, primary/high:
  https://developers.webflow.com/data/reference/oauth-app

---

Update:
- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01

Author: Alexander Brichkin (Agonist Development AB)
