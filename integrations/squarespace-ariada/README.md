# Ariada for Squarespace

Thin Squarespace extension scaffold for sending a published Squarespace site URL
to the Ariada hosted scan API and rendering evidence back in an extension-style
settings/results page.

This package does not reimplement scanner rules. The Squarespace surface is a
connector: it stores site settings, prepares the hosted scan request, and renders
the returned Ariada findings. Local development uses checked-in fixtures because
a real Squarespace Extension needs OAuth credentials, marketplace onboarding,
and an installed test account.

## What It Contains

- `extension.manifest.json` records the intended Squarespace app metadata,
  OAuth redirect, settings URL, webhook URL, and hosted Ariada endpoint.
- `fixtures/extension-surface.html` is the local settings/results surface used
  for evidence capture.
- `fixtures/hosted-scan-request.json` is the request the extension would send
  to Ariada hosted scan.
- `fixtures/hosted-scan-response.json` is a representative Ariada response with
  accessibility findings.
- `scripts/run-local-fixture.mjs` validates the fixture, copies raw JSON/logs,
  and writes `test-report/result.html` plus `scan-evidence/result.html`.

## Account And API Requirements

- Squarespace Extension OAuth client credentials. Squarespace states that
  Extensions use OAuth; generated API keys are for custom merchant-site
  applications and are not the marketplace extension path.
- A Squarespace test site where the extension can be installed.
- A hosted Ariada scan endpoint reachable from the extension backend.
- Ariada API credentials scoped to scan the installed site's public URL.
- A HTTPS callback host for OAuth redirect and uninstall webhook handling.
- Marketplace review and listing approval before distribution.

Sources:

- Squarespace authentication and permissions:
  https://developers.squarespace.com/commerce-apis/authentication-and-permissions
- Squarespace webhook subscription API:
  https://developers.squarespace.com/commerce-apis/webhooksubscriptions
- Squarespace webhooks overview:
  https://developers.squarespace.com/webhooks/overview

## Local Fixture Flow

Run the local evidence build:

```sh
node integrations/squarespace-ariada/scripts/run-local-fixture.mjs
```

Then open:

```text
integrations/squarespace-ariada/fixtures/extension-surface.html
integrations/squarespace-ariada/test-report/result.html
integrations/squarespace-ariada/scan-evidence/result.html
```

The fixture represents the expected extension settings page:

- installed Squarespace site URL;
- OAuth connection state;
- Ariada hosted scan endpoint;
- selected domains and threshold;
- scan findings rendered from hosted API JSON.

## Real Extension Integration Plan

1. Register the Squarespace Extension and OAuth client.
2. Host an Ariada connector backend with OAuth callback, token storage, and
   uninstall webhook handling.
3. After install, fetch or receive the merchant/site public URL.
4. Submit `{ siteUrl, domains, threshold, source: "squarespace" }` to the
   Ariada hosted scan API.
5. Render the returned findings in the extension settings/results page.
6. Store evidence links for review: raw JSON, command/API logs, screenshot,
   and the HTML report.

## Blockers

- No Squarespace OAuth client or marketplace account is available in this
  workspace.
- No real Squarespace test account installation was possible locally.
- Hosted Ariada scan API credentials are not present in this worktree.
- Marketplace submission copy, screenshots, support URL, privacy policy, and
  review packet remain founder/operator work.

## Verification

Local gates:

```sh
node --check integrations/squarespace-ariada/scripts/run-local-fixture.mjs
node integrations/squarespace-ariada/scripts/run-local-fixture.mjs
```

The E2E evidence surface is a local HTML fixture with live JavaScript rendering
from checked-in Ariada hosted-scan JSON. The screenshot in
`scan-evidence/screenshots/extension-surface.png` is captured from that rendered
surface.

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01
