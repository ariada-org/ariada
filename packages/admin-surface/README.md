# `@ariada-org/admin-surface`

Product-neutral contracts and helpers for KlarAds-based application admin
surfaces. The package keeps field meaning in data so the same locale selectors,
colour controls, contextual help, validation, and access metadata can be reused
by Audiofirst and future Agonist applications.

## What belongs here

- semantic surface and block definitions;
- grid, metric-column, row-action and dashboard-profile contracts;
- the declarative chart contract (`AdminChartSpec`) shared by every renderer;
- mandatory help for defaults, precedence, and observable effects;
- locale options derived from a product language-support manifest;
- capability-filtered locale selectors and the explicit `system` exception;
- strict `RRGGBB` colour wire conversion;
- framework-neutral validation and a starter template.

Product copy, brand-specific defaults, product capability names, and the actual
CMS/API authorization policy stay in the consuming application. UI components
may render this contract, but hiding a field is never an authorization boundary.
Locale-registry authoring and locale-keyed translation dictionaries are content
schema editors rather than locale settings; they validate locale keys in their
own domain and are intentionally outside the selector rule.

## Add a surface

1. Copy `templates/admin-surface.ts.template` into the product adapter.
2. Build one locale registry with `createLocaleRegistryFromLanguageSupport`.
3. Describe every section with `summary`, `defaultSemantics`, `precedence`, and
   `effect`; validation rejects blocks without this help.
4. Use `kind: 'locale'` for locale/language values and optionally specify a
   provider capability. Never substitute a free-text input.
5. Set `allowSystem: true` only for a field whose wire contract explicitly
   supports `system`. Other locale fields remain registry-only.
6. Use `kind: 'color', wireFormat: 'RRGGBB'` for colours and preserve uppercase
   six-digit values on the wire.
7. Render the definition through the shared KlarAds admin components and enforce
   the corresponding server capability independently.

Run `pnpm --filter @ariada-org/admin-surface test` and `typecheck` before adding the
surface to an application build.

## One contract, two renderers

`AdminGridSurface`, `OperatorDashboardProfile` and `AdminChartSpec` are pure
data — no React, no Svelte, no AG Grid, no chart library. Two render layers read
the same declarations:

| Renderer | Package | Consumer |
|---|---|---|
| React + Ant Design | `@ariada-org/admin-ui` | Projectology (React is load-bearing there) |
| Svelte 5 | `@ariada-org/admin-svelte` | KlarAds (`klarads-app`, SvelteKit) |

Declare a chart with `defineAdminChartSpec()` the same way a board declares
columns. `column` / `line` / `funnel` plot rows; `graph` draws a relationship map
from `nodes` + `edges`. Colours are literal CSS hex (series identity is data);
anything that looks like a skin — `css`, `class`, `style`, `theme` — fails
closed, exactly as it does on a dashboard profile.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
