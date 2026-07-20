# Ariada for Ghost

Webhook receiver for Ghost Custom Integrations. It scans the rendered published
post URL through Ariada after `post.published`.

## What It Does

- Accepts a Ghost `post.published` webhook payload.
- Selects the published post URL from `post.current.url` or `post.url`.
- Calls a supplied Ariada scan client.
- Returns a small report object that can be stored by the host app or rendered
  in a report page.

## Local Verification

```sh
pnpm --dir integrations/ghost-ariada test
```

## Host Blocker

A full Ghost smoke needs a Ghost Admin custom integration, webhook secret, and a
running Ghost test site. Marketplace listing is a founder action.
