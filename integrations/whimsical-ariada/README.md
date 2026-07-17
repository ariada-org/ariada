# Whimsical Ariada integration

Thin export-then-scan recipe for Whimsical boards. Whimsical does not provide a
first-party plugin SDK, so this package contains Node glue for exported board
artifacts instead of in-product code.

## Scope

- Supported inputs: Whimsical HTML exports, SVG exports, or published board URLs.
- Image-only exports such as PNG or PDF are not accepted by this wrapper because
  they do not expose inspectable markup for Ariada.
- SVG exports use the design-determinable rule subset for color contrast and text
  size. HTML exports and URLs are passed to `ariada scan`.
- Low-fidelity wireframes cannot prove focus order, ARIA behavior, keyboard
  interaction, or final CSS cascade. Run a full Ariada scan again on the built
  page before release.

## Usage

Create a recipe:

```json
{
  "exportPath": "./fixtures/wireframe-export.svg",
  "format": "svg",
  "outputDir": "./scan-evidence/ariada-output"
}
```

Build and run:

```sh
pnpm install --ignore-workspace
pnpm build
node dist/cli.js fixtures/whimsical-recipe.json
```

The CLI temporarily serves local exports on `127.0.0.1`, then delegates to the
shared `ariada` binary from `@ariada-org/cli` with `--domains accessibility`.
It does not implement contrast math, DOM scanning, or accessibility rules.

## Distribution blocker

There is no Whimsical marketplace or plugin listing path for this integration.
Distribution is a documented recipe/example repository that a project owner must
publish under the relevant organization.

## Verification

```sh
pnpm --dir integrations/whimsical-ariada lint
pnpm --dir integrations/whimsical-ariada typecheck
pnpm --dir integrations/whimsical-ariada test
pnpm --dir integrations/whimsical-ariada build
```
