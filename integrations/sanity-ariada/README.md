# Ariada for Sanity

Sanity Studio plugin scaffold for scanning rendered Presentation/preview URLs.
The Studio plugin owns editor wiring only; Ariada owns the scan.

## What It Does

- Resolves a document preview URL from `previewUrl` or a slug and base URL.
- Builds an Ariada API request.
- Maps scan responses to a Studio panel model.

## Local Verification

```sh
pnpm --dir integrations/sanity-ariada test
```

## Host Blocker

Studio load verification needs a Sanity project, dataset, and preview URL auth.
Plugin directory submission is a founder action.
