# Deployment and live gate

## 1. Register and configure Forge

The defaults in `manifest.yml` are lint-safe non-live placeholders. They do not identify a real app or host.

1. Log in with founder-owned Forge credentials: `forge login`.
2. Register the app and retain its UUID: `forge register`.
3. Export `FORGE_APP_ID=<uuid>` for every Forge CLI command.
4. Deploy the remote tarball to an HTTPS service and export its origin as `ARIADA_REMOTE_URL`.
5. Give the remote process the same non-secret `FORGE_APP_ID` and a compatible pre-provisioned Playwright 1.60.0 browser. Do not run `playwright install` from this project.

The supplied `Dockerfile.remote` starts from the exact Playwright 1.60.0 image, installs only the local bundled tarball with lifecycle scripts disabled, runs as `pwuser`, and exposes `/health` and `/v1/scan`. Building that image is an operator action because it pulls a browser-bearing base image; local gates do not build it.

## 2. Deploy and install

```sh
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --ignore-scripts
npm run verify
npm run package
FORGE_APP_ID="$FORGE_APP_ID" ARIADA_REMOTE_URL="$ARIADA_REMOTE_URL" forge deploy --environment development
FORGE_APP_ID="$FORGE_APP_ID" ARIADA_REMOTE_URL="$ARIADA_REMOTE_URL" forge install --product confluence --site "$CONFLUENCE_DEV_SITE" --environment development
```

No secret is a manifest variable. `FORGE_APP_ID` and the remote URL are identifiers. Forge credentials remain in the founder's authenticated CLI; FIT and user OAuth tokens exist only in request headers and are never logged or persisted.

## 3. Actual dev-site gate

This gate cannot be automated without the external site and a live Forge invocation because only Forge can mint the FIT/user token pair.

1. Open a real published page as a user who can view it.
2. Choose **More actions → Scan accessibility with Ariada**.
3. Select **Scan current page**.
4. Confirm the panel identifies that page, renders pass/fail and impact totals, shows top violations, and opens the in-panel full report.
5. Confirm the remote reports no token or page body in logs and no retained page/report after the response.
6. Record the app version, site, page ID, scan ID, timestamp, and a screenshot in founder-controlled release evidence.

Expected status before those steps: `BLOCKED_EXTERNAL: ATLASSIAN_DEV_SITE_FORGE_CREDENTIALS_AND_LIVE_PAGE_REQUIRED`.

## 4. Marketplace gate

Marketplace publication remains founder-owned. It requires a production Forge environment, listing copy/assets, support and privacy URLs, security/data-residency declarations for Forge Remote compute, commercial decisions, and Marketplace submission credentials. A passing local or dev-site scan is not a Marketplace approval.
