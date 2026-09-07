# @ariada-org/brand/logo

> Canonical Ariada umbrella logo assets — used as cross-site umbrella signal on every property in the family.

## Files

| File                   | Purpose                                       | ViewBox  | Notes                                    |
|------------------------|-----------------------------------------------|----------|------------------------------------------|
| `ariada-mark.svg`      | Triangle + Ariadne thread, no text            | 36×36    | currentColor; thread waveform stays white |
| `ariada-wordmark.svg`  | "ariada" lowercase wordmark                   | 200×40   | currentColor; Inter 700                  |
| `ariada-lockup.svg`    | Mark + wordmark + tagline (horizontal)        | 220×40   | currentColor; for footer cross-sell      |

## Color adaptation (BLOCKING)

All three SVGs use `fill="currentColor"` on every adaptable surface. Each site sets the umbrella signal colour via the parent's `color:` CSS property — no hardcoded per-site variants.

## Per-site recommended colour

| Site              | Umbrella signal colour       | CSS rule                                    |
|-------------------|------------------------------|---------------------------------------------|
| `ariada.org`       | `var(--c-brand-primary)` (blue)   | umbrella IS the brand                  |
| `blamer.org`       | `var(--c-fg-muted)` (slate-grey)  | umbrella reads as "by ariada", subtle   |
| `clamper.org`      | `var(--c-fg-muted)`               | same                                    |
| `reverter.org`     | `var(--c-fg-muted)`               | same                                    |
| `draculascan.org` | `var(--c-fg-muted)` (#d4a8ad)     | mauve-on-near-black, gothic-readable    |
| `docs.ariada.org`  | `var(--brand-primary)` (blue)     | docs IS umbrella surface                |

The umbrella signal is intentionally **muted** on standalone product sites so the product's own brand stays primary; the muted ariada mark says "this is part of a family" without competing with the local hero.

## WCAG 2.2 AA contrast verification (per site, on bg)

| Site              | Logo colour       | Background        | Ratio     | Status |
|-------------------|-------------------|-------------------|-----------|--------|
| ariada.org         | `#2563eb`         | `#ffffff`         | 5.17 : 1  | AA pass (UI 3:1, text-large 3:1; treat as graphic) |
| blamer.org         | `#4a5061`         | `#fbfaf6`         | 7.30 : 1  | AAA pass |
| clamper.org        | `#4a5061`         | `#fbfaf6`         | 7.30 : 1  | AAA pass |
| reverter.org       | `#4a5061`         | `#fbfaf6`         | 7.30 : 1  | AAA pass |
| draculascan.org   | `#d4a8ad`         | `#1c0708`         | 9.94 : 1  | AAA pass |
| docs (light)      | `#0066ff`         | `#ffffff`         | 4.81 : 1  | AA pass for graphics |
| docs (dark)       | `#4a8cff`         | `#17181c`         | 6.84 : 1  | AAA pass |

Ratios computed via WebAIM contrast checker. Graphics need 3:1 (WCAG 1.4.11), body text 4.5:1 (1.4.3) — every pair clears both thresholds.

## Author

Alexander Brichkin (Agonist Development AB), 2026-05-04.
