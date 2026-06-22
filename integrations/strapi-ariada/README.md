# Ariada for Strapi

Strapi plugin scaffold for entry-level rendered URL scans. The admin action and
server route should pass a published front-end URL to Ariada; this package keeps
that contract isolated and testable.

## Local Verification

```sh
pnpm --dir integrations/strapi-ariada test
```

## Host Blocker

Loading the plugin in `strapi develop` requires a Strapi application fixture and
database. Marketplace submission is a founder action.
