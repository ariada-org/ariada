# Ariada Firefox Add-ons Packaging

This integration packages the existing Ariada browser extension for Firefox AMO.
It is a manifest/package overlay only. The scanner and browser UI stay in
`packages/extension-chrome`.

## What It Does

- Reads `packages/extension-chrome/.output/chrome-mv3`.
- Adds Firefox `browser_specific_settings`.
- Preserves the existing popup, content script, DevTools page, and background
  worker routing.
- Produces `dist/ariada-firefox-addon.zip` for AMO signing/submission.

## Local Gates

```sh
node integrations/firefox-addon-ariada/scripts/validate-firefox-package.mjs
node integrations/firefox-addon-ariada/scripts/build-firefox-package.mjs
```

`web-ext lint` is the preferred AMO-style validation when `web-ext` is installed.
This machine does not have `web-ext`, so the local gate validates the MV3
contract and builds a reproducible unsigned package.

## Live-Host Blocker

Blocked: Firefox AMO signing and listing submission require an AMO developer
account.

Owner: founder. Next action: sign in to AMO, upload the generated zip for
signing/review, and complete listing metadata.
