# @ariada/brand-tokens

> Ariadne's Thread design tokens — CSS-only, MIT-licensed.

Single source of truth for typography, spacing, radius, container widths, motion, and per-product colour ramps across the Ariada family (ariada.org / blamer.org / clamper.org / reverter.org / draculascan.org).

## License

[MIT](./LICENSE) for the CSS tokens. **Logo files are NOT included** and remain trademark-restricted (see NOTICE).

## What's in here

```text
tokens/
├── shared.css         # cross-product invariants (typography, spacing, radius, container, motion)
├── thread.css         # the --c-thread Ariadne purple accent (used on every product)
├── ariada.css         # umbrella tokens: deep purple primary
├── blamer.css         # blamer.org: burnt-amber forensic primary
├── clamper.css        # clamper.org: signal-red gate primary
├── reverter.css       # reverter.org: forest-green restorative primary
└── draculascan.css    # draculascan.org: crypt-purple + blood-red, dark-mode-only
```

## Install

```bash
npm install @ariada/brand-tokens
```

## How to consume

In an Astro / Next / SvelteKit page or layout, import the three CSS files in order:

```css
@import "@ariada/brand-tokens/tokens/shared.css";
@import "@ariada/brand-tokens/tokens/blamer.css";   /* one of the 5 product files */
@import "@ariada/brand-tokens/tokens/thread.css";
```

`shared.css` defines `:root` invariants. The product file defines `[data-brand="<product>"]` overrides. `thread.css` adds the cross-family `--c-thread` accent.

## Why MIT (not EUPL-1.2 like the rest of the platform)

Design tokens are commodity infrastructure — typography scales, spacing ladders, and named colours are widely re-used across the web. MIT maximises downstream adoption (themes, component libraries, design-system tooling) without friction. The rest of the open-core Ariada platform ships under EUPL-1.2 because it contains compliance / regulatory logic where the patent peace pledge matters more.

## Trademark

This MIT licence covers ONLY the CSS source. The names "Ariada", "Ariadne", "Ariadne's Thread", "Blamer", "Clamper", "Reverter", "Draculascan", their respective logos, and visual identity ARE NOT GRANTED for downstream re-use. See [https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/TRADEMARK.md](https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/TRADEMARK.md) for terms.

If you fork the tokens to ship your own product, please re-name the product CSS files and the brand identifiers (`--c-brand-*` custom property names) to avoid trademark confusion.

## Part of the Ariada OSS platform

This package is one component of the open-core Ariada accessibility-compliance platform. See [ariada.org](https://ariada.org) for the full pipeline.
