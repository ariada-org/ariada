# @ariada-org/dracula-agent

Character-themed visualisation library — the proprietary character
layer for `draculascan`. Renders `ScanEvent` streams as a visual character
(vampire / skeleton / zombie / mummy) that reacts to severity transitions.

Plugs into `<ScanProgress characterSlot={...}>` from
[`@ariada-org/scan-flow-ui`](../scan-flow-ui).

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Package name    | `@ariada-org/dracula-agent`                                              |
| Version         | 0.1.0                                                                |
| Licence         | **MIT** (viz-library convention — 2026-05-19 founder decision)       |
| Runtime         | Browser, React `^19`                                                 |
| Peer deps       | `react`, `react-dom`, optional `@rive-app/webgl`, optional `gsap`    |
| REUSE-compliant | yes — `REUSE.toml` + per-file SPDX headers                           |

## Why MIT

Visualisation libraries are a category with very strong MIT-licence
convention (e.g. d3, three.js, framer-motion, recharts). TS-distribution is
practically open by nature (consumers always have the JavaScript anyway), and
the patent moat lives in the score-generation pipeline (Patent K covers the
scan-visualisation concept at a higher level — not the specific render
implementation here). Releasing under MIT removes friction for downstream
embedders without compromising the moat.

## Public API

```tsx
import { DraculaScene, HeroDracula, SpeechBubble } from '@ariada-org/dracula-agent';

<DraculaScene events={sseEvents} riveUrl="/dracula.riv" />;
<HeroDracula reducedMotion />;
<SpeechBubble locale="en" text="Click scan to begin." />;
```

Public exports:

| Export                | Kind        | Purpose                                                   |
| --------------------- | ----------- | --------------------------------------------------------- |
| `DraculaScene`        | Component   | Full scene — character + scene transitions                |
| `HeroDracula`         | Component   | Hero-page character pose                                  |
| `SpeechBubble`        | Component   | i18n speech bubble                                        |
| `PlaceholderDraculaSvg` | Component | SSR-safe SVG used when the `.riv` is the 0-byte placeholder |
| `deriveState`         | Pure fn     | severity + last event → 1 of 7 named character states     |
| `severityIntensity`   | Pure fn     | severity → 0..1 intensity                                 |
| `bboxCenter` / `bezierPath` / `sampleBezier` / `catmullRom` / `pathThroughBBoxes` | Pure fns | bbox → animation path |
| `prefersReducedMotion` / `watchReducedMotion` | DOM     | reduced-motion preference                                 |

## Character variants

`deriveState` returns one of 7 named states depending on severity input:

| State          | When                                                  |
| -------------- | ----------------------------------------------------- |
| `idle`         | no events yet                                         |
| `searching`    | scan in progress, no findings                         |
| `discovered`   | first finding emitted (minor / moderate)              |
| `alerted`      | serious finding                                       |
| `horrified`    | critical finding                                      |
| `victorious`   | scan complete, score ≥ 90                             |
| `defeated`     | scan complete, score < 50                             |

## Reduced motion

The package respects the user's `prefers-reduced-motion` preference. When
reduced motion is active, animation timelines collapse to instantaneous
state-pose snaps; no Bezier interpolation, no GSAP timeline.

## Character assets

`assets/dracula.riv` is currently a 0-byte placeholder. See `assets/TODO.md`
for the commission brief required before production launch. The asset is
**not** covered by the MIT licence — it is commission-restricted (see
`REUSE.toml` `assets/**` block). The `PlaceholderDraculaSvg` component
ships an SSR-safe in-code SVG fallback so the package is testable and
functional without the real asset.

## GSAP licence note

`gsap` MotionPathPlugin (used for advanced choreography in production
builds) requires a Club GreenSock commercial licence (≈ $99/yr). The
**default** rendering path uses an internal `bezierPath` +
`requestAnimationFrame` loop that is licence-free; consumers can opt into
GSAP via the `peerDependenciesMeta.optional` channel for heavier
choreography in production builds where the GreenSock licence is held.

## Testing

```bash
pnpm --filter @ariada-org/dracula-agent test
```

Five test files cover state machine, spatial nav, reduced-motion watcher,
placeholder SVG, and the top-level scene component (vitest + happy-dom +
testing-library).

## Trademark

The MIT licence covers **code**. It does **not** grant trademark rights to
"Ariada", "Ariadne", "Blamer", "Clamper", "Reverter", "Draculascan", or
"Dracula" as used in this product context. Re-name the character + package
in forks. See `TRADEMARK.md`.

## Layout

```
src/
  index.ts              — public exports
  DraculaScene.tsx      — top-level scene
  HeroDracula.tsx       — hero-page pose
  SpeechBubble.tsx      — i18n bubble
  placeholder-svg.tsx   — SSR-safe SVG fallback
  state-machine.ts      — deriveState (pure)
  spatial-nav.ts        — bezier / catmull-rom (pure)
  reduced-motion.ts     — prefers-reduced-motion watcher
  __tests__/            — vitest + happy-dom + RTL
assets/
  dracula.riv           — 0-byte placeholder (commission pending)
  TODO.md               — commission brief
```

## Licence

MIT — see `LICENSE`. Per-file SPDX headers + `REUSE.toml` keep
machine-readable metadata in sync. Character assets under `assets/**` are
**not** MIT — see `REUSE.toml`.

## Security

Vulnerability reports → `https://github.com/ariada-org/ariada/security/advisories/new`
or `security@ariada.org`. See `SECURITY.md`.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
