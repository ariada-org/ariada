# Ariada for UXPin

S121 is an export-then-scan recipe for UXPin. UXPin's useful difference is that
Merge and preview/export flows can render coded components into real HTML. This
integration keeps the channel thin:

1. A designer exports the prototype from `Share > Export > HTML`, or provides a
   hosted UXPin preview URL.
2. `uxpin-ariada` discovers the exported HTML folder and serves it on localhost.
3. The adapter invokes the shared `@ariada-org/cli` scanner against that URL.
4. The scan output stays in local evidence artifacts for review or CI upload.

No accessibility scanner is implemented here. The package only locates UXPin
HTML output, starts a temporary static server when needed, and builds the CLI
arguments for `@ariada-org/cli`.

## Usage

```sh
npm install -D @ariada-integrations/uxpin-ariada @ariada-org/cli
npx uxpin-ariada --export-dir ./dist/uxpin-html --output-dir ./scan-evidence/ariada-output
```

For a hosted UXPin preview:

```sh
npx uxpin-ariada --target-url https://preview.uxpin.com/example --domains accessibility,security
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

Blocked: a real UXPin workspace/API and any public recipe/example-repo
distribution path are not available in this environment. Owner: founder. Next
action: provide a UXPin account with an exportable prototype or approve
publication of this recipe under an Ariada-owned repository. Until then, the
checked surface is the closest representative fixture: UXPin-style HTML export
metadata plus a recipe-panel evidence mock.
