# ariada.org

OSS Commons landing for the `@ariada-org/*` rule-pack family. Built with
Astro 5, deployed to Cloudflare Pages, zero JavaScript at runtime.

## Pages

- `/` &mdash; OSS family overview
- `/wcag-rules-extended` &mdash; package landing for `@ariada-org/wcag-rules-extended`
- `/about` &mdash; entity / stewardship statement
- `/accessibility` &mdash; self-cert accessibility statement
- `/404` &mdash; not found

## Design constraints

- System fonts only (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- Single readable column (max 760px)
- Light + dark via `prefers-color-scheme` (no client toggle)
- NO marketing CTAs (no "book a demo", no lead-magnet forms)
- NO third-party trackers, NO analytics, NO inline event handlers
- Inline stylesheets only (`inlineStylesheets: 'always'`) so the page
  ships as a single HTML document with embedded CSS

Reference aesthetic: prettier.io, hyperscript.org, docs.astro.build,
kit.svelte.dev &mdash; READMEs as websites.

## Build + deploy

```bash
pnpm --filter ariada-org build
pnpm --filter ariada-org deploy   # wrangler pages deploy dist
```

## Geo-fence middleware

`functions/_middleware.ts` provisioned proactively (defense-in-depth).
Today no patent / USPTO / provisional text appears in body content;
the middleware sits in front of static delivery so any future
regression is caught.

## License

Source: EUPL-1.2 (per repository root `LICENSE`).
