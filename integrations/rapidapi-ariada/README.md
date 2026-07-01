# Ariada RapidAPI Listing

S26 builds the RapidAPI channel scaffold for the Ariada hosted accessibility scan
API. It describes the API marketplace surface only: OpenAPI contract, listing
metadata, examples, tier notes, local mock validation, and evidence reports. It
does not add scanner logic.

## What is RapidAPI?

RapidAPI is an API Hub where providers publish APIs and consumers discover,
subscribe to, test, and call those APIs through listing pages and generated code
snippets. Source: RapidAPI docs, accessed 2026-07-01, high reliability,
primary source, https://docs.rapidapi.com/ and
https://docs.rapidapi.com/docs/consumer-quick-start-guide.

## Why this is a separate Ariada channel

RapidAPI targets API consumers rather than framework, browser, CMS, or CI users.
It is separate from Ariada package integrations because the buyer pays for hosted
scan access and quota management, not for a local scanner package. Source:
RapidAPI Hub Listing docs, accessed 2026-07-01, high reliability, primary
source, https://docs.rapidapi.com/do/docs/hub-listing-overview.

## Roles: who pays / what value they buy

- Developers pay for a low-friction JSON scan endpoint when self-hosting is too
  much work.
- Product teams pay for repeatable API access from tools, support workflows, or
  internal dashboards.
- Agencies and compliance teams pay for higher quota and retained scan evidence
  once the hosted API and billing terms are live.

## Implemented vs not implemented

Implemented:
- OpenAPI 3.1 contract in `openapi.json`.
- RapidAPI draft metadata in `rapidapi-listing.json`.
- Request and response examples in `examples/`.
- Local mock API in `mock/server.mjs`.
- Validation and evidence generation in `scripts/validate-and-report.mjs`.

Not implemented:
- RapidAPI publication.
- Live Ariada hosted scan endpoint.
- Billing plan activation.
- Production credentials or marketplace account automation.
- New scanner logic.

## Local validation

```sh
npm test --prefix integrations/rapidapi-ariada
```

The validation command checks the OpenAPI structure, RapidAPI metadata, examples,
local mock request flow, generated report headings, local links, and screenshot
nonblank status.

## Evidence

- Test report: `test-report/result.html`
- Scan evidence report: `scan-evidence/result.html`
- Screenshot: `scan-evidence/screenshots/rapidapi-report.png`

## Blocker

Publication is blocked until the founder provisions the hosted scan API, owns the
RapidAPI provider account, confirms pricing, and publishes the listing. Source:
RapidAPI provider docs, accessed 2026-07-01, high reliability, primary source,
https://docs.rapidapi.com/docs/add-api-getting-started.

Update:
- Author: TURING (Codex orchestrator)
- Date: 2026-07-01
