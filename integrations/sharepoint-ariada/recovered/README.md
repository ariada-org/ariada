# Ariada SharePoint scanner runtime

This package is the server-side boundary for the SharePoint web part. It runs on
Node.js 22 behind Microsoft Entra ID / App Service Authentication and invokes
the public `@ariada-org/cli` API. It does not contain a SharePoint secret.

Production environment variables:

- `ARIADA_ALLOWED_TENANT_ID`: exact Entra tenant GUID.
- `ARIADA_ALLOWED_ORIGIN`: exact `https://<tenant>.sharepoint.com` origin.
- `ARIADA_REQUIRE_EASY_AUTH`: defaults to `true`; only set `false` for isolated local development.
- `PORT`: HTTP port, default `8080`.
- `PLAYWRIGHT_BROWSERS_PATH`: compatible Playwright browser location.

Routes are `GET /health` and authenticated `POST /api/scans`.

