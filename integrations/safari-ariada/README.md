# ariada Safari Web Extension

This integration wraps the existing browser extension build in a Safari Web
Extension Xcode project. It does not copy or fork scan logic: the Web Extension
source remains `packages/extension-chrome`, and the local Xcode project is
generated from that package's WXT output.

## Scope

- Source extension: `packages/extension-chrome`
- Generated Safari project: `integrations/safari-ariada/build/AriadaSafari`
- Checked-in wrapper files: config, validation, and conversion commands only

## Prerequisites

- macOS with Xcode command line tools
- `xcrun safari-web-extension-converter`
- Node.js and pnpm versions accepted by the monorepo

## Commands

```sh
make validate
make convert
make xcode-list
make xcode-build
```

`make convert` first runs:

```sh
pnpm -F @ariada-org/extension-chrome build
```

Then it packages `packages/extension-chrome/.output/chrome-mv3` with Apple's
Safari Web Extension converter. The generated Xcode files stay under `build/`
and are intentionally ignored so the wrapper remains a thin integration over
the existing extension.

## Native Smoke

After `make xcode-build` succeeds:

1. Open the generated project:
   `open build/AriadaSafari/ariada.xcodeproj`
2. Run the macOS app target in Xcode.
3. Open Safari settings and enable the ariada extension.
4. Visit a normal web page, open the toolbar extension, and run a scan.

If the converter or Xcode build is unavailable, capture the failing command and
error output. Do not replace this wrapper with a second scanner implementation.

