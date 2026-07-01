# Ariada for Magento / Adobe Commerce

Thin Magento 2 module scaffold for Ariada scans of category, product, cart, and
checkout pages. It delegates scanning to the Ariada CLI or an explicitly
configured hosted scan endpoint.

## What is Magento / Adobe Commerce?

Magento Open Source and Adobe Commerce are PHP e-commerce platforms for
storefronts, catalogs, checkout, and merchant admin. Adobe documents modules via
`registration.php`, `etc/module.xml`, and `bin/magento setup:upgrade`.

## Why this is a separate Ariada channel

Magento has platform-specific routing, layout XML, admin ACL, and checkout
surfaces. This module gives merchants an admin compliance panel and preselects
pages that matter for EAA/WCAG evidence.

## Roles: who pays / what value they buy

- Merchant owner: pays for recurring accessibility evidence on revenue pages.
- Agency or systems integrator: bundles scans into launch and maintenance
  retainers.
- Compliance lead: buys a repeatable report before releases and audits.

## Implemented vs not implemented

Implemented:
- Magento registration, module XML, routes, ACL, menu, admin view, storefront
  result fixture, CLI command builder, hosted payload builder, and local evidence
  flow.

Not implemented:
- Real Magento database install, cache warmup, and `bin/magento setup:upgrade`.
- Marketplace packaging submission, which requires an Adobe developer account.

## Competitors

Magento merchants can also buy widgets, manual audits, or generic crawlers.
Ariada can run locally, in CI, or from a hosted scan boundary without replacing
the storefront stack.

## Domains

The channel covers accessibility first: labels, names, contrast, keyboard
reachability, headings, landmarks, target size, form errors, and checkout
blockers.

## Technical connectors

- Local CLI: `ariada scan <url> --domains accessibility --format json`.
- Hosted API: `POST /api/scan` with `url`, `domains`, and `severityThreshold`.
- Magento admin: `Stores -> Ariada Scan`.
- Storefront fixture route: `/ariada-accessibility/scan/result`.

## Evidence

- `test-report/result.html` shows module structure, CLI command, hosted payload,
  and admin fixture evidence.
- `scan-evidence/result.html` shows storefront findings and evidence links.
- `scan-evidence/screenshot.png` is captured from the local results fixture.

## Screenshot

Open `scan-evidence/screenshot.png` after running the fixture flow and screenshot
step.

## Blockers

Host blocker: a real Magento 2 or Adobe Commerce install with database, search
service, generated code, and admin credentials is required for
`bin/magento setup:upgrade`, route dispatch, and Marketplace QA. This host has no
PHP or Magento, so the committed artifact is the closest local module fixture.

## Distribution

Install during development as `app/code/Ariada/Commerce`, then run:

```sh
bin/magento module:enable Ariada_Commerce
bin/magento setup:upgrade
bin/magento cache:clean
```

Marketplace distribution requires Adobe developer review and quality checks.

## Monetization

The OSS module can remain free while paid value sits in hosted scans, evidence
retention, dashboards, and managed release gates.

## Sources

- Adobe Experience League, "Create a module", updated 2026: https://experienceleague.adobe.com/en/docs/commerce-learn/tutorials/extensibility/backend-development/create-module
- Adobe Developer, "Module overview", updated 2024: https://developer.adobe.com/commerce/php/architecture/modules/overview
- Adobe Experience League, "Adobe Commerce Marketplace", updated 2026: https://experienceleague.adobe.com/en/docs/commerce-admin/start/resources/commerce-marketplace
- Adobe Experience League, "System requirements", updated 2026: https://experienceleague.adobe.com/en/docs/commerce-operations/installation-guide/system-requirements

## Update

- Author: TURING (orchestrator)
- Date: 2026-07-01
