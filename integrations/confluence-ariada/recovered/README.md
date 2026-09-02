# Ariada for Confluence (S222)

A production Forge Custom UI content action for Confluence Cloud. A page author opens **More actions → Scan accessibility with Ariada** to see pass/fail, impact totals, prioritised WCAG violations, and the full finding list.

The Forge iframe cannot inspect its parent Confluence DOM. This package therefore uses Atlassian's documented Forge Remote boundary instead of pretending otherwise: Forge signs the invocation and supplies a user OAuth token; the remote validates the Forge Invocation Token (FIT), fetches the current page as `body-format=view`, serves that rendered body transiently on loopback, and invokes the real `@ariada-org/cli` + `@ariada-org/core-playwright` scanner. Page HTML and scan results are not stored by this implementation.

## Architecture

- `manifest.yml`: `confluence:contentAction`, Custom UI resource, remote resolver, `read:page:confluence`, and `read:app-user-token`.
- `src/frontend`: accessible React panel. Its only page identity comes from signed Forge context.
- `src/remote`: FIT verification, user-scoped Confluence API call, transient HTML rendering, and Ariada scan.
- `tools`: deterministic build plus packed/offline/actual gates.
- `vendor/runtime`: browser-free real Ariada runtime files used only to construct the distributable tarball.

The remote is declared `operations: [compute]`: it processes Confluence page data but does not retain it. It is intentionally not eligible for "Runs on Atlassian" because Playwright requires remote compute.

## Local prerequisites and gates

Node 22+ is required. Install never downloads a browser:

```sh
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --ignore-scripts
npm run verify
npm run test:actual
npm run package
```

Exact gates:

```sh
npm run lint          # ESLint, zero warnings
npm run typecheck     # strict TypeScript
npm test              # parser, panel render, and authenticated remote tests
npm run build         # remote JS/declarations + bundled Custom UI
npm run forge:lint    # Forge CLI manifest/resource lint
npm run package:check # packed, empty-cache, offline consumer proof
npm run test:actual   # packed real CLI/Playwright scan; never installs a browser
```

`package:check` builds a tarball, asserts there are no `file:`/`workspace:` dependencies, lifecycle installers, source/tests/tools/vendor paths, fake scanners, or browser binaries, then installs it outside the repository using `npm install --offline` with an asserted-empty cache. It imports the installed API and the bundled real `@ariada-org/cli`, `@ariada-org/core`, `@ariada-org/core-playwright`, Playwright 1.60.0, and `@ariada-org/rules-axe`, and runs `npm ls --all --offline`.

`test:actual` repeats that packed consumer path and scans a real HTML fixture through the real CLI. If the matching Playwright browser is not already present, it exits with `ACTUAL BLOCKED_EXTERNAL_BROWSER`; it does not download one. Set `CONFLUENCE_ARIADA_ACTUAL_HTML=/absolute/export.html` to scan a supplied export instead.

## Dev-site deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The short form is:

```sh
export FORGE_APP_ID='<registered-app-uuid>'
export ARIADA_REMOTE_URL='https://scanner-host.example'
npm run package
# Deploy artifacts/ariada-integrations-confluence-ariada-0.1.0.tgz to the remote host.
forge deploy --environment development
forge install --product confluence --site '<site>.atlassian.net' --environment development
```

The remote process receives the same `FORGE_APP_ID` as a non-secret environment value. Forge/Atlassian credentials, OAuth tokens, API tokens, site names, and page HTML are never embedded in this package.

## Honest external blocker

Local build, tests, Forge lint, tarball proof, and packed actual execution are implemented. End-to-end Confluence evidence is **BLOCKED_EXTERNAL** until the founder supplies all of:

- An Atlassian developer account and Forge/Marketplace credentials.
- A registered Forge app ID.
- A reachable HTTPS deployment of the packaged remote with a compatible Playwright browser already provisioned.
- A Confluence Cloud development site where the app can be installed.
- A real published page the invoking user may view/export.
- Marketplace listing metadata, privacy/support URLs, approval, and submission access.

No `forge deploy`, `forge install`, live page scan, or Marketplace submission is claimed without those inputs.

## Scope and patent binding

S222 only. This integration surfaces existing scanner output and adds no accessibility scanning algorithm. `@patentBinding: none`.

Official implementation references: [content action](https://developer.atlassian.com/platform/forge/manifest-reference/modules/confluence-content-action/), [Forge Remote endpoint](https://developer.atlassian.com/platform/forge/manifest-reference/endpoint/), [FIT verification](https://developer.atlassian.com/platform/forge/remote/essentials/), [remote product API calls](https://developer.atlassian.com/platform/forge/remote/calling-product-apis/), and [Confluence Get page by ID](https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/#api-pages-id-get).
