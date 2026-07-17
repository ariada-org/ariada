# Ariada for Contentful

Contentful App Framework scaffold for editor-side accessibility checks. The app
expects a rendered preview URL and sends that URL to the Ariada scan API.

## What It Does

- Resolves a preview URL from a configurable entry field.
- Builds a hosted Ariada scan request.
- Normalizes API results into rows suitable for a Contentful sidebar or page
  location.

## Local Verification

```sh
pnpm --dir integrations/contentful-ariada test
```

## Host Blocker

App SDK harness testing needs a Contentful space, app definition, preview URL
configuration, and preview auth. Marketplace submission is a founder action.
