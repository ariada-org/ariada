# Ariada Edge Add-ons Packaging

This integration packages the existing Ariada browser extension for Microsoft
Edge Add-ons. It does not contain scan logic. The source extension remains
`packages/extension-chrome`.

## What It Does

- Reads the built MV3 extension from `packages/extension-chrome/.output/chrome-mv3`.
- Validates that the manifest is Edge-store compatible.
- Copies the build into `dist/edge-mv3`.
- Produces `dist/ariada-edge-addon.zip` for Partner Center upload.

## Local Gates

```sh
node integrations/edge-addon-ariada/scripts/validate-edge-package.mjs
node integrations/edge-addon-ariada/scripts/build-edge-package.mjs
```

If the source build is missing, run:

```sh
pnpm -F @ariada-org/extension-chrome build
```

## Live-Host Blocker

Blocked: Microsoft Edge Add-ons submission requires Partner Center access and
store review.

Owner: founder. Next action: sign in to Partner Center, create the Edge Add-ons
listing, upload `dist/ariada-edge-addon.zip`, and complete store review.

