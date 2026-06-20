# @ariada-org/brand

> Ariadne's Thread — shared design tokens for ariada.org + blamer.org + clamper.org + reverter.org + draculascan.org.

Single source of truth for brand colours, typography, spacing, motion across the Ariada family. Per [`strategy/product/ARIADNE_THREAD_DESIGN_SYSTEM.md`](../../strategy/product/ARIADNE_THREAD_DESIGN_SYSTEM.md).

## What's in here (v0.1)

```
packages/brand/
├── package.json                # @ariada-org/brand, ESM-only, private monorepo dep
└── tokens/
    ├── shared.css              # cross-product invariants (typography, spacing, radius, container, motion, reduced-motion)
    ├── thread.css              # the --c-thread Ariadne purple accent (used on every product)
    ├── ariada.css              # umbrella tokens: deep purple primary
    ├── blamer.css              # blamer.org: burnt-amber forensic primary (extracted from apps/marketing-blamer)
    ├── clamper.css             # clamper.org: signal-red gate primary (NEW)
    ├── reverter.css            # reverter.org: forest-green restorative primary (NEW)
    └── draculascan.css         # draculascan.org: crypt-purple + blood-red, dark-mode-only (extracted from apps/draculascan/src/root.css)
```

## How to consume

In an Astro / Next / SvelteKit page or layout, import the three CSS files in this order:

```css
@import "@ariada-org/brand/tokens/shared.css";
@import "@ariada-org/brand/tokens/blamer.css";   /* one of the 5 product files */
@import "@ariada-org/brand/tokens/thread.css";
```

Or via Astro `<style>`:

```astro
---
import "@ariada-org/brand/tokens/shared.css";
import "@ariada-org/brand/tokens/clamper.css";
import "@ariada-org/brand/tokens/thread.css";
---
```

Then use the CSS variables in your styles — see each token file for the full list. Common ones:

```css
button.cta {
  background: var(--c-brand-primary);
  color: var(--c-brand-primary-ink);
  font-family: var(--font-display);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  transition: transform var(--motion-fast);
}
button.cta:hover {
  background: var(--c-brand-primary-bright);
}
button.cta:focus-visible {
  outline: 2px solid var(--c-thread);  /* the family-thread accent */
  outline-offset: 2px;
}
```

## Brand spectrum

| Product           | Primary (light) | Primary (dark) | Vibe                                 |
|-------------------|-----------------|----------------|--------------------------------------|
| `ariada.org`       | `#5e3aa1` deep purple | `#a78bfa` light purple | Authority / "the guide"     |
| `blamer.org`       | `#b53d12` burnt-amber | `#ff8a4c` light orange | Forensic / "this was you"   |
| `clamper.org`      | `#a31f24` signal-red  | `#ff6b71` light red    | Stop-the-line / "won't pass"|
| `reverter.org`     | `#166830` forest      | `#4ade80` light green  | Recovery / "restore"        |
| `draculascan.org` | `#7f1d1d` crypt-red   | (single dark theme)    | Gothic / playful demo        |

Every product also carries `--c-thread: #7a4fcf` (Ariadne purple) as accent — focus rings, cross-sell links, decorative thread between layered cards. This is the visual signal that all 5 properties are siblings.

Each standalone primary has Euclidean RGB delta ≥ 60 from `#7a4fcf` (the umbrella purple) so they read as distinct on Marketplace listings — verified in each token file's header comment.

## WCAG 2.2 AA contrast

Every product file pre-verifies AA contrast for primary-on-bg, fg-on-bg, fg-muted-on-bg, link-on-bg pairs. Build pipeline (cobbler's-shoes script per M5 OSS hardening) re-verifies on every PR.

## Versioning

`v0.1.0` — tokens only. No JS/TS, no React components. Future:

- `v0.2` — `@ariada-org/brand-react`: `<LayerStack/>` (the 8-layer scanner architecture visual), `<ThreadAccent/>` (scroll-redraw SVG line), `<BrandFooter/>` (cross-sell footer).
- `v0.3` — Tailwind preset / Vanilla-extract bridge for projects that don't load CSS directly.
- Public NPM publish — held off until the umbrella repository goes public OSS (per ADR-004).

## Contributing changes

1. Edit only token files in this package — never duplicate tokens in app `src/styles/*.css`.
2. After editing colour values, re-run contrast checks: `pnpm -F @ariada-org/marketing-blamer exec cobblers-shoes` (or equivalent per app).
3. Update each per-product file's contrast comment block with new ratios.
4. Bump version in `package.json` only on minor/major changes; patch is automatic.

## Source documents

- Internal design-system specification (architecture doc).
- Brand-hierarchy reference (locked 2026-04-17).
- Brand-architecture document — single source of truth for naming.
- ADR-004 — repo placement and legal-entity binding.
