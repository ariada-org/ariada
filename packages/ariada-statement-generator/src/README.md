# Accessibility-statement generator

Scaffolds a Directive 2016/2102 art. 7 / EAA-compliant accessibility
statement page from violation data + report metadata. Outputs either
standalone HTML (drop-in `/accessibility/`) or MDX (for Astro / Next.js
content pipelines).

## Usage

```ts
import { generateStatement } from '@ariada/statement-generator';

const out = generateStatement(violations, meta, {
  locale: 'sv',
  jurisdiction: 'SE',
  organisation: 'Example AB',
  authorityEmail: 'tillganglighet@example.se',
  feedbackUrl: 'https://example.se/kontakt',
  conformance: 'partial', // or auto-derived from violations
  format: 'html', // or 'mdx'
});

// out.body = full HTML / MDX document ready to write to disk
```

## Supported locales

| Code | Language          | Template source            |
|------|-------------------|----------------------------|
| en   | English (default) | W3C WAI accessibility statement template |
| sv   | Swedish           | DIGG mall för tillgänglighetsredogörelse |
| nb   | Norwegian Bokmål  | Digdir tilgjengelighetserklæring |
| da   | Danish            | Digst tilgængelighedserklæring |
| fi   | Finnish           | Avi saavutettavuusseloste mall |

## Supported jurisdictions

Each jurisdiction wires the correct national enforcement authority URL
and phrasing:

| Code | Authority                                       | URL                                                              |
|------|-------------------------------------------------|------------------------------------------------------------------|
| SE   | DIGG (Myndigheten för digital förvaltning)      | https://www.digg.se/tillgangligheten-till-digital-offentlig-service |
| NO   | uutilsynet (Digdir)                             | https://www.digdir.no/digitalisering-og-samordning/tilsynet-tilgjengelighet/704 |
| DK   | Digst (Digitaliseringsstyrelsen)                | https://www.digst.dk/it-loesninger/webtilgaengelighed/tilgaengelighedskrav/ |
| FI   | Avi (Etelä-Suomen aluehallintovirasto)          | https://www.saavutettavuusvaatimukset.fi/ |

Override via `enforcementUrl` option if you need a different authority
(e.g. EU public-sector route, German BfIT, French DINUM).

## Statement structure

The generated page follows the legally required template:

1. **Title + heading** — `{Statement title} — {Product name}`
2. **Conformance claim** — full / partial / non-conformant
3. **Dates** — publication date, last revision date (ISO 8601)
4. **Scope** — URL or scope description (linked)
5. **Methodology** — automated / manual review summary
6. **Non-accessible content** — per-violation list with WCAG SC + EN 301 549 ref + impact
7. **Applicable standards** — WCAG 2.2 AA + EN 301 549 v3.2.1
8. **Feedback mechanism** — email + contact form URL
9. **Enforcement procedure** — national authority link

## Conformance auto-derivation

If `conformance` is omitted, it is derived from the violations list:

- empty list → `full`
- any serious / critical → `non-conformant`
- only moderate / minor → `partial`

## Output formats

### HTML (`format: 'html'`)

Standalone `<!doctype html>` document with `lang` attribute, meta tags,
and full semantic markup. Drop into `/public/accessibility/index.html`
or serve dynamically.

### MDX (`format: 'mdx'`)

Frontmatter (`title`, `publishedAt`, `lastRevised`, `locale`, `jurisdiction`,
`conformance`) + body wrapped in `<div lang="…">` so the `lang` attribute
is preserved when rendered into a host page that may have a different
top-level `lang`. Suitable for Astro `src/pages/accessibility/index.mdx`
or Next.js `app/accessibility/page.mdx`.

## Compliance scope

This generator targets:

- **Directive (EU) 2016/2102** — Public Sector Web Accessibility Directive,
  art. 7 (statement requirements)
- **Directive (EU) 2019/882** — European Accessibility Act, Annex I §I.3
  (e-commerce) and §I.4 (banking) — private-sector statement extension
- National transpositions (Lag 2018:1937 / likestillings- og diskrimineringsloven /
  LBK 692/2020 / saavutettavuuslaki 306/2019)

**Not a substitute for legal review.** The generated statement is a
starting template — adapt the phrasing, add company-specific contact
details, and have it reviewed by counsel before publishing.

## Examples

```ts
// Swedish e-commerce site, partial conformance
const sv = generateStatement(violations, meta, {
  locale: 'sv',
  jurisdiction: 'SE',
  organisation: 'Acme AB',
  authorityEmail: 'tillganglighet@acme.se',
  feedbackUrl: 'https://acme.se/kontakt',
});
fs.writeFileSync('public/tillganglighet.html', sv.body);

// Norwegian banking app, MDX for Astro
const nb = generateStatement(violations, meta, {
  locale: 'nb',
  jurisdiction: 'NO',
  organisation: 'Acme Bank ASA',
  authorityEmail: 'a11y@acme-bank.no',
  feedbackUrl: 'https://acme-bank.no/kontakt',
  format: 'mdx',
});
fs.writeFileSync('src/pages/tilgjengelighet/index.mdx', nb.body);
```
