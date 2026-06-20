<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# @ariada-org/test-fixtures

Curated HTML fixtures + golden snapshots for accessibility rule testing.

<!-- REUSE-IgnoreStart -->
HTML fixtures are dedicated to the public domain under [CC0-1.0](./LICENSE) (Creative Commons Zero v1.0 Universal — maximum-permissive, no attribution required). The fixture-server source code under `src/serve.ts` remains [EUPL-1.2](./LICENSES/EUPL-1.2.txt) and carries an inline EUPL-1.2 SPDX header. The compound SPDX expression in `package.json` is `CC0-1.0 AND EUPL-1.2`.
<!-- REUSE-IgnoreEnd -->

## What this package does

Provides a stable, version-controlled set of HTML test inputs for accessibility-rule libraries, scanners, and CI harnesses. Two layers:

- **Generic axe-core cases** — minimal stand-alone files for basic regression: contrast violations, missing alt, iframe / shadow-DOM containment, mixed-severity baselines.
- **EU real-world patterns** — fixtures that imitate the visual / interaction patterns of widely-deployed European services (Klarna-style SE checkout, BankID-style SE authentication, MobilePay-style DK merchant flow, Finnish DOS-lagen statement, German Mittelstand, French RGAA). No third-party brand assets are embedded; brand names appear only in filenames and provenance comments for findability.

## Install

```bash
npm install --save-dev @ariada-org/test-fixtures
```

## Usage — programmatic HTTP server (generic fixtures)

```ts
import { startFixtureServer } from '@ariada-org/test-fixtures';

const fx = await startFixtureServer();
// fx.url → http://127.0.0.1:<random>
// navigate to `${fx.url}/color-contrast.html` etc
await fx.stop();
```

## Usage — file-path access (any fixture)

```ts
import { createRequire } from 'node:module';
import * as path from 'node:path';

const require = createRequire(import.meta.url);
const fixturesRoot = path.dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/basic-pass.html'),
);

// or for the EU real-world set:
const euRoot = path.dirname(
  require.resolve('@ariada-org/test-fixtures/fixtures/eu-real-world/README.md'),
);
```

## Generic fixtures (`fixtures/`)

| File                   | Purpose                                        |
|------------------------|------------------------------------------------|
| `basic-pass.html`      | Clean baseline, no violations                  |
| `color-contrast.html`  | 2 critical-contrast violations                 |
| `alt-text.html`        | 3 serious missing-alt violations               |
| `shadow-dom.html`      | Open shadow root with inner violations         |
| `iframe-nested.html`   | Top frame + same-origin child with violations  |
| `iframe-child.html`    | Child of `iframe-nested.html`                  |
| `mixed-severity.html`  | Mixed critical/serious/moderate/minor          |

## EU real-world fixtures (`fixtures/eu-real-world/`)

Each file carries an in-file `License: CC0-1.0` header and a `Status: PASS|FAIL|MIXED` marker. Categories:

- **Swedish e-commerce** — `klarna-style-{cart,checkout,bad-checkout,order-confirmation}-sv.html`
- **Swedish banking** — `bankid-style-{sso-redirect,2fa-challenge,success}-sv.html`
- **Danish mobile pay** — `mobilepay-style-{merchant-checkout,authentication,bad-merchant}-da.html`
- **Finnish statement** — `accessibility-statement-fi{,-incomplete}.html`
- **German Mittelstand** — `mittelstand-{checkout,bad-checkout}-de.html`
- **French RGAA** — `rgaa-statement-fr{,-incomplete}.html`

## License

[CC0-1.0](./LICENSE) for all `fixtures/**` HTML content (Creative Commons Zero — public-domain dedication, maximum-permissive). [EUPL-1.2](./LICENSES/EUPL-1.2.txt) for `src/serve.ts` (the in-process fixture-server code). REUSE-machine-readable metadata in [`REUSE.toml`](./REUSE.toml). See [NOTICE](./NOTICE) for the patent-peace pledge and trademark notice.

The CC0-1.0 dedication on fixtures is deliberate: accessibility test corpora benefit from frictionless reuse across competing toolchains, regulators, and academic work. We chose CC0-1.0 over Apache-2.0 / MIT to avoid an attribution-collision problem when downstream consumers concatenate fixtures from multiple sources into a single golden-file suite. This also aligns with Horizon Europe Article 17 «open data» principles for publicly-funded research outputs.

## Part of the Ariada OSS platform

This package is one component of the open-core Ariada accessibility-compliance platform. See [ariada.org](https://ariada.org) for the full pipeline.
