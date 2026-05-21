# Contributing to ariada / ADOPTA

Thanks for your interest in contributing! This document describes how to set up
the monorepo, our coding conventions, and the pull-request process.

By participating, you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Table of contents

- [Getting started](#getting-started)
- [Monorepo layout](#monorepo-layout)
- [Development workflow](#development-workflow)
- [Code style](#code-style)
- [Commit format](#commit-format)
- [Pull-request process](#pull-request-process)
- [Developer Certificate of Origin (DCO)](#developer-certificate-of-origin-dco)
- [Adding a new package](#adding-a-new-package)
- [Reporting bugs / requesting features](#reporting-bugs--requesting-features)

---

## Getting started

### Prerequisites

- **Node.js** `>=22` (use `nvm install` — repo has `.nvmrc`)
- **pnpm** `>=9.15` (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Git** `>=2.40`

### One-time setup

```sh
git clone https://github.com/ariada-org/ariada.git
cd ariada
pnpm install                               # installs deps + sets up Husky hooks
pnpm exec playwright install --with-deps chromium   # optional, for e2e tests
```

`pnpm install` automatically runs the `prepare` script which wires up Husky
git hooks (`pre-commit` runs `lint-staged`, `commit-msg` runs `commitlint`).

### Verifying your setup

```sh
pnpm turbo run typecheck lint test build
```

If everything is green, you're ready to contribute.

---

## Monorepo layout

```
packages/
├── wcag-rules-extended/       @ariada-org/wcag-rules-extended      31 EAA-aligned axe-core rules
├── eaa-pipeline/              @ariada-org/eaa-pipeline             reusable GitHub Actions workflow
├── ariada-statement-generator/@ariada-org/statement-generator      EN 301 549 art. 7 statement
├── ariada-penalty-estimator/  @ariada-org/penalty-estimator        11-jurisdiction penalty model
├── ariada-evidence-emitter/   @ariada-org/evidence-emitter         VPAT 2.5 INT + EN 301 549 JSON
├── ariada-brand-tokens/       @ariada-org/brand-tokens             CSS design tokens (MIT)
└── ariada-test-fixtures/      @ariada-org/test-fixtures            EAA HTML corpus (CC0-1.0)

.github/workflows/                           CI / Scorecard / SBOM
docs/                                        ADRs and architectural notes
```

Each public package has:

- `package.json` with `exports`, `files`, `engines`, valid `types`
- `README.md` with installation + quickstart + public API table
- `LICENSE` (EUPL-1.2 by default; MIT or CC0-1.0 where noted) + `NOTICE`
- `CHANGELOG.md` (managed via [Changesets](https://github.com/changesets/changesets))

---

## Development workflow

### Running everything

```sh
pnpm turbo run dev          # placeholder — not all packages have a dev script yet
pnpm turbo run build        # build all packages
pnpm turbo run typecheck    # typecheck all packages
pnpm turbo run lint         # lint all packages
pnpm turbo run test         # unit tests
pnpm turbo run test:e2e     # integration / e2e (requires playwright browsers)
```

### Running a single package

```sh
pnpm --filter @ariada-org/core build
pnpm --filter @ariada-org/core test
pnpm --filter @ariada-org/core test:watch
```

### Adding a dependency

```sh
# runtime dep on a single package:
pnpm --filter @ariada-org/core add some-pkg

# devDep on a single package:
pnpm --filter @ariada-org/core add -D some-dev-pkg

# repo-wide devDep (root only):
pnpm add -Dw some-dev-pkg
```

### Recording a changeset

When your PR changes a public package, add a changeset describing the change:

```sh
pnpm changeset
```

Pick the affected packages, the bump level (patch / minor / major), and write
a one-line summary. Commit the resulting `.changeset/*.md` file with your PR.

---

## Code style

- **TypeScript-first.** All new source code is TS, ESM-only, strict mode on.
  See `tsconfig.base.json` for the strictness profile.
- **No `any`.** `@typescript-eslint/no-explicit-any` is `error`. Use `unknown`
  - a narrow type guard or, for genuinely dynamic shapes, [`zod`](https://zod.dev).
- **Type-only imports** must use `import type` (auto-fixed by ESLint).
- **Formatting** is enforced by Prettier (`pnpm exec prettier --write .`) — but
  this is automated on staged files via `lint-staged`, so usually you don't
  need to think about it.
- **Markdown tables** in this repo are kept column-aligned for readability.

---

## Commit format

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

### Allowed types

| Type       | Use for                                                 |
| ---------- | ------------------------------------------------------- |
| `feat`     | New user-facing feature                                 |
| `fix`      | Bug fix                                                 |
| `docs`     | Docs-only change (README, CONTRIBUTING, ADR)            |
| `chore`    | Tooling, deps, build config — no source-behavior change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Tests only                                              |
| `build`    | Build-system / external-deps changes                    |
| `ci`       | CI configuration changes                                |
| `style`    | Formatting / whitespace / lint-only fixes               |
| `revert`   | Reverts a previous commit                               |

### Examples

```
feat(wcag-rules-extended): add cross-domain conflict detection
fix(wcag-rules-extended): ignore color-contrast on hidden elements
docs: clarify EAA 2025 scope in README
chore(deps): bump playwright to 1.49.1
chore(ci): add OpenSSF Scorecard workflow
```

The `commit-msg` Husky hook runs `commitlint` and rejects malformed messages.

---

## Pull-request process

1. **Fork** the repo and create a feature branch:
   `feat/short-description` or `fix/short-description`.
2. Make your changes in small, focused commits. Each commit must
   typecheck + lint cleanly (the pre-commit hook helps).
3. **Add tests.** New code without tests is unlikely to be merged.
4. **Run the full pipeline locally:**
   ```sh
   pnpm turbo run typecheck lint test build
   ```
5. **Add a changeset** if you touched a public package
   (`pnpm changeset`).
6. **Open the PR** against `main`. Fill in the PR template.
7. **CI must be green.** Including: typecheck, lint, unit tests,
   e2e tests, `attw`, `publint`, and OpenSSF Scorecard checks where applicable.
8. **Get one approving review** from a CODEOWNER. For large or
   architectural changes (a new package, public-API change,
   security-sensitive code) we may ask for a corresponding
   Architecture Decision Record entry.
9. **We squash-merge** by default. The squash subject must be a
   valid Conventional Commit.

---

## Developer Certificate of Origin (DCO)

We use the [Developer Certificate of Origin v1.1](https://developercertificate.org/)
to confirm that contributors have the right to submit their work under the
project's licence (EUPL-1.2 by default).

You assert the DCO by adding a `Signed-off-by` line to each commit:

```sh
git commit -s -m "feat(core): add foo"
```

This appends:

```
Signed-off-by: Your Name <your.email@example.com>
```

`git config user.email` must match the email you use on GitHub.

---

## Adding a new package

1. Pick a name under the `@ariada-org/*` scope.
2. Create `packages/<name>/` with at minimum:
   - `package.json` (use an existing package as a template — check
     `name`, `version: "0.1.0"`, `license: "EUPL-1.2"`, `type: "module"`,
     `main`, `types`, `exports`, `files`, `engines`)
   - `README.md` describing purpose + public API
   - `LICENSE` (copy of root EUPL-1.2)
   - `NOTICE` (copy of root NOTICE)
   - `CHANGELOG.md` (empty: `# @ariada-org/<name>\n`)
   - `tsconfig.json` extending `../config/tsconfig.base.json`
   - `src/index.ts` (entry)
   - `tests/` (Vitest)
3. Run `pnpm install` from the repo root to wire the workspace.
4. Run `pnpm --filter @ariada-org/<name> build typecheck lint test` to verify.
5. Add a row to the package table in the root `README.md`.
6. Add an entry to `CODEOWNERS` if ownership differs from the default.

---

## Reporting bugs / requesting features

- **Bugs:** open a GitHub issue using the
  [Bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Features:** open a GitHub issue using the
  [Feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).
- **Security vulnerabilities:** **do not open a public issue.** See
  [SECURITY.md](./SECURITY.md) for our private-disclosure policy.

---

Thanks for contributing to a more accessible web!
