# Ariada Chrome DevTools Panel Integration

This integration records the Pack 4 Chrome DevTools contract for Ariada.
The actual browser extension source lives in `packages/extension-chrome`; this
directory deliberately does not copy scanner code.

## What It Adds

- A manifest fragment showing the required Chrome extension entry point:
  `devtools_page: "devtools.html"`.
- A validation script that checks the existing Chrome extension build has:
  - a DevTools page that creates the `ariada` panel;
  - a panel that targets `chrome.devtools.inspectedWindow.tabId`;
  - scan requests routed through the existing background/content scanner;
  - no duplicate call to `scanCurrentDocument()` in the panel.

## Why The Scanner Is Not Here

The DevTools panel is only a user interface inside Chrome DevTools. The page
scan stays in `packages/extension-chrome/entrypoints/content.ts`, which already
uses the browser scanner. This keeps the DevTools channel aligned with the
popup extension and avoids a second implementation of the accessibility engine.

## Local Checks

```sh
node integrations/devtools-ariada/scripts/validate-devtools-integration.mjs
```

If `packages/extension-chrome/.output/chrome-mv3/manifest.json` is missing,
build the host extension first:

```sh
pnpm -F @ariada-org/extension-chrome build
node integrations/devtools-ariada/scripts/validate-devtools-integration.mjs
```

## Manual Browser Smoke

Only claim this smoke after actually running it:

1. Build the Chrome extension.
2. Open `chrome://extensions`, enable Developer mode, and load
   `packages/extension-chrome/.output/chrome-mv3`.
3. Open a normal web page.
4. Open Chrome DevTools.
5. Confirm the `ariada` panel appears.
6. Click `Scan inspected tab`.
7. Confirm results appear and element highlighting works through the existing
   content-script route.

## Sources

- Chrome DevTools extension guide:
  https://developer.chrome.com/docs/extensions/how-to/devtools/extend-devtools
- Chrome `devtools.panels` API:
  https://developer.chrome.com/docs/extensions/reference/api/devtools/panels
- Chrome `devtools.inspectedWindow` API:
  https://developer.chrome.com/docs/extensions/reference/api/devtools/inspectedWindow
