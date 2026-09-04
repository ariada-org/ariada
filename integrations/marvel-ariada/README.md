# Ariada for Marvel

S122 is an export/API-then-scan recipe for Marvel prototypes. Marvel has API and
share-link surfaces, but no in-app plugin runtime for running Ariada inside the
editor. This adapter keeps the channel thin:

1. Load a recorded Marvel prototype export, a Marvel API project response, or a
   public Marvel share URL.
2. Materialize the available prototype metadata into a local HTML scan target
   when the source is API/export data.
3. Invoke the shared `@ariada-org/cli` scanner against the local target or the
   supplied live URL.
4. Keep the Ariada JSON, command log, report, and screenshots as evidence.

No accessibility scanner is implemented here. The package only parses Marvel
project/screen metadata, creates a browser-readable target from what Marvel
exposes, starts a temporary static server when needed, and builds the CLI
arguments for `@ariada-org/cli`.

## Usage

```sh
npm install -D @ariada-integrations/marvel-ariada @ariada-org/cli
npx marvel-ariada --fixture ./fixtures/marvel-prototype-export.json --output-dir ./scan-evidence/ariada-output
```

For a public Marvel share URL:

```sh
npx marvel-ariada --share-url https://marvelapp.com/prototype/example --domains accessibility,security
```

For API-backed extraction:

```sh
MARVEL_API_TOKEN=... npx marvel-ariada \
  --api-endpoint https://marvelapp.com/graphql \
  --project-id project_123 \
  --output-dir ./scan-evidence/ariada-output
```

## Local Validation

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run validate
```

## Live-Host Blocker

Blocked: this environment has no Marvel API token, account-backed prototype, or
recipe/listing distribution account. Owner: founder. Next action: provide a
Marvel account token plus a representative project or approve publication of the
recipe/example repository. Until then, the checked surface is the closest
representative fixture: a recorded Marvel-like project export, generated
prototype handoff HTML, raw Ariada-shaped JSON, and browser screenshots.

Image-only Marvel screens cannot provide DOM structure or semantic assertions.
When a prototype is only available as screen images, this adapter can surface
the generated handoff wrapper to Ariada and preserve evidence, but the scanner
cannot infer headings, labels, focus order, or alt text inside the pixels.
