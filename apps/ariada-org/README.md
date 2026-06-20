# ariada.org

OSS Commons landing for the `@ariada-org/*` rule-pack family. Built with
Astro 5, deployed to Cloudflare Pages, zero JavaScript at runtime.

## Pages

- `/` &mdash; OSS family overview
- `/demo` &mdash; multi-domain compliance report demo (static pre-computed fixture)
- `/wcag-rules-extended` &mdash; package landing for `@ariada-org/wcag-rules-extended`
- `/about` &mdash; entity / stewardship statement
- `/accessibility` &mdash; self-cert accessibility statement
- `/404` &mdash; not found

## Refreshing the demo fixture

The `/demo` page renders a static pre-computed `MultiDomainReport` stored at
`apps/ariada-org/public/demo/multi-domain-report.json`. To re-scan the
configured sites and update the fixture:

```bash
bash scripts/generate-demo-fixtures.sh
```

The script is configured with a demo site list at the top of the file. Edit
`DEMO_SITES` and `DEMO_DOMAINS` to change which sites are included in the
report. After running, commit the updated
`apps/ariada-org/public/demo/multi-domain-report.json`.

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
