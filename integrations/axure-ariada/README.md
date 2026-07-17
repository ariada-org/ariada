# Ariada for Axure RP

S120 is an export-then-scan recipe for Axure RP. Axure RP does not provide a
modern in-app plugin runtime for running Ariada checks inside the editor, but it
does publish prototypes to HTML. This integration keeps the channel thin:

1. A designer publishes the prototype with `Publish > Generate HTML files`.
2. `axure-ariada` discovers the exported HTML folder and serves it on localhost.
3. The adapter invokes the shared `@ariada-org/cli` scanner against that URL.
4. The scan output stays in local evidence artifacts for review or CI upload.

No accessibility scanner is implemented here. The package only locates Axure
HTML output, starts a temporary static server when needed, and builds the CLI
arguments for `@ariada-org/cli`.

## Usage

```sh
npm install -D @ariada-integrations/axure-ariada @ariada-org/cli
npx axure-ariada --publish-dir ./dist/axure-html --output-dir ./scan-evidence/ariada-output
```

For a hosted Axure Cloud prototype:

```sh
npx axure-ariada --target-url https://example.axure.cloud/prototype --domains accessibility,security
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

Blocked: a real Axure RP editor/plugin host and any recipe/example-repo
distribution account are not available in this environment. Owner: founder.
Next action: provide an Axure RP license/project or approve publication of the
recipe/example repository. Until then, the checked surface is the closest
representative fixture: Axure-style generated HTML plus an extension-panel
evidence mock.
