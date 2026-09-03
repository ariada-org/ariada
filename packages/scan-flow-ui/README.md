# @ariada-org/scan-flow-ui

Brand-themed React components shared by `ariada-web` and `draculascan`. The
**base** UI layer of the scan flow — not the character-themed Dracula layer
(that lives in [`@ariada-org/dracula-agent`](../dracula-agent)).

| Field           | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Package name    | `@ariada-org/scan-flow-ui`                                 |
| Version         | 0.1.0                                                  |
| Licence         | EUPL-1.2 (European Union Public Licence)               |
| Runtime         | React `^19` (peer dep)                                 |
| Theming         | CSS custom properties — no hex literals in JS          |
| REUSE-compliant | yes — `REUSE.toml` + per-file SPDX headers             |

## Components

| Component       | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `URLInput`      | Public scan form; accessible labels + alert region                       |
| `ScanProgress`  | SSE consumer, debounced live region, optional `characterSlot`            |
| `Scorecard`     | Score + triple-encoded severity badges + finding table; `depth` prop     |
| `ShareButtons`  | Twitter / LinkedIn / Bluesky / copy / embed                              |
| `CrossSellCTAs` | Branded link list with click callback for attribution                    |
| `EmbedBadge`    | Small badge preview — live Web Component lives in `@ariada-org/embed-badge`  |

## Theme contract

The components consume CSS custom properties from `<html>` only. They never
import brand hex literals so a single bundle can serve both brands.

```ts
import {
  applyTheme,
  ARIADA_THEME,
  DRACULA_THEME,
} from '@ariada-org/scan-flow-ui';

applyTheme(ARIADA_THEME);  // ariada-web
applyTheme(DRACULA_THEME); // draculascan
```

Custom-property surface (see `src/theme.ts` for the full list):

- `--brand-primary`, `--brand-accent`, `--brand-tone`
- `--font-display`, `--font-body`
- `--border-radius`
- `--severity-critical`, `--severity-serious`, `--severity-moderate`, `--severity-minor`
- `--icon-variant`

These tokens are sourced from [`@ariada-org/brand-tokens`](../ariada-brand-tokens)
in production sites; the package contains the default fallback values inline
so the components stay usable when consumed standalone.

## Usage

```tsx
import {
  URLInput,
  ScanProgress,
  Scorecard,
  ShareButtons,
  CrossSellCTAs,
  applyTheme,
  ARIADA_THEME,
} from '@ariada-org/scan-flow-ui';

// Once, at app startup:
applyTheme(ARIADA_THEME);

// In a page:
function ScanPage() {
  return (
    <>
      <URLInput onSubmit={(url) => beginScan(url)} />
      <ScanProgress events={sseEvents} />
      <Scorecard report={report} depth="summary" />
      <ShareButtons url={shareUrl} score={report.score} />
      <CrossSellCTAs onCtaClick={(id) => track(id)} />
    </>
  );
}
```

## Accessibility

Every component is built constraints-first:

- semantic markup (form `<label>`s, `<button>` not `<div role="button">`);
- focus-visible states, ≥ 3px focus ring;
- triple-encoded severity (icon + colour + text), never colour alone;
- live regions debounced (200 ms) to avoid screen-reader chatter.

## Testing

Tests run with vitest + happy-dom + `@testing-library/react`:

```bash
pnpm --filter @ariada-org/scan-flow-ui test
```

Smoke tests cover the four primary components (`URLInput`, `Scorecard`,
`ScanProgress`, `ShareButtons`). Coverage will grow as the public surface
stabilises.

## Layout

```
src/
  index.ts              — public exports
  theme.ts              — applyTheme + theme constants
  URLInput.tsx          — scan-input form
  ScanProgress.tsx      — SSE consumer + characterSlot
  Scorecard.tsx         — score + finding table
  ShareButtons.tsx      — share targets
  CrossSellCTAs.tsx     — branded CTAs
  EmbedBadge.tsx        — badge preview
  types.ts              — shared types
  fixtures/sample-events.ts — synthetic ScanEvents for tests
  __tests__/            — vitest + happy-dom + RTL
```

## Licence

EUPL-1.2 — see `LICENSE`. Per-file SPDX headers + `REUSE.toml` keep
machine-readable metadata in sync.

## Security

Vulnerability reports → `https://github.com/ariada-org/ariada/security/advisories/new`
or `security@ariada.org`. See `SECURITY.md`.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
