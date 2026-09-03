# @ariada-org/embed-badge

`<ariada-badge>` Web Component — a commodity badge that displays an
accessibility score on any third-party site. One bundle, both brands.
Shadow-DOM isolated so it cannot bleed host-page styles into the badge or
vice versa.

| Field           | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Package name    | `@ariada-org/embed-badge`                                  |
| Version         | 0.1.0                                                  |
| Licence         | **MIT** (commodity badge SDK)                          |
| Runtime         | Browser only; pure DOM, no runtime deps                |
| Dependencies    | none                                                   |
| REUSE-compliant | yes — `REUSE.toml` + per-file SPDX headers             |

The MIT licence is deliberately chosen so downstream sites can embed the
badge frictionlessly. Proprietary scan-visualisation technology covers the
underlying score-generation pipeline; the badge itself is the commodity
presentation surface released under the most permissive widely-adopted OSS
licence.

## Usage — copy-paste HTML

```html
<script src="https://draculascan.org/embed.js"></script>
<ariada-badge
  data-site="example.com"
  data-theme="dracula"
></ariada-badge>
```

Attributes:

| Attribute       | Required | Default                  | Description                            |
| --------------- | -------- | ------------------------ | -------------------------------------- |
| `data-site`     | yes      | —                        | Bare hostname (no scheme, no path)     |
| `data-theme`    | no       | `"ariada"`               | `"ariada"` or `"dracula"`              |
| `data-api-base` | no       | brand-default            | Override the API origin                |

## Usage — bundler

```ts
import '@ariada-org/embed-badge';

// Insert the element anywhere:
document.body.insertAdjacentHTML(
  'beforeend',
  '<ariada-badge data-site="example.com"></ariada-badge>'
);
```

## Shadow-DOM isolation

The component creates a closed shadow root. Host-page CSS cannot override the
badge styling and vice versa. Branding is driven by `data-theme` which selects
between two pre-bundled CSS blocks.

## Accessibility

The badge renders a labelled link to the public scorecard. The score value
is announced via an `aria-label`; the colour state is duplicated as text
content so it does not rely on hue alone.

## Bundle size

The bundle is intentionally tiny (< 5 KB minified) and has zero dependencies.
Sites that already include their own CDN can drop the script tag without a
build-system integration.

## Trademark

`ariada-badge` as a DOM element name is reserved for use with the ariada
score API. The MIT licence does **not** grant trademark rights to "Ariada",
"Ariadne", "Blamer", "Clamper", "Reverter", or "Draculascan". If you fork
this package, please re-name the custom element to avoid downstream
confusion. See `TRADEMARK.md`.

## Layout

```
src/
  index.ts            — public exports + custom-element registration
  fetch-score.ts      — score-fetch + cache logic
  __tests__/
    badge.test.ts     — vitest + happy-dom smoke tests
```

## Licence

MIT — see `LICENSE`. Per-file SPDX headers + `REUSE.toml` keep machine-readable
metadata in sync.

## Security

Vulnerability reports → `https://github.com/ariada-org/ariada/security/advisories/new`
or `security@ariada.org`. See `SECURITY.md`.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
