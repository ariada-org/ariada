# Changelog

All notable changes to `ariada-org/ariada` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The "version" referred to here is the workflow contract — the inputs accepted by `eaa-audit.yml`, the outputs it emits, and the shape of the artefact bundle. Internal implementation details (the specific version of `@axe-core/cli`, the Node version, the action SHAs) can change without a workflow-version bump as long as the contract holds.

## [Unreleased]

### Added

- Initial scaffold: reusable workflow `eaa-audit.yml`, self-test CI, OpenSSF Scorecard.
- Three example workflows: single-page, multi-page, monorepo.
- Architecture and inputs / outputs / troubleshooting reference docs.
- Patent Peace Pledge in `NOTICE`, cross-referenced from `README.md`.
- `SECURITY.md` covering private-disclosure channel via GitHub Security Advisories.

## [v0.1.0] — Unreleased

First tagged pre-release. Ships once the self-test workflow runs green against `https://ariada.org` in the public mirror repo.

### Tag policy

| Tag        | Mutable | Audience                                          |
|------------|---------|---------------------------------------------------|
| `@v1`      | yes     | Default for most callers; tracks latest `v1.x.y`. |
| `@v1.0.0`  | no      | Callers who want exact-pin reproducibility.       |
| `@<sha>`   | no      | Callers running OpenSSF Scorecard ≥ 8.            |

`@main` is NOT a supported reference. Treat `main` as a development branch.

### Versioning of the workflow contract

- **Major bump (v1 → v2)** — breaking changes to inputs (removed inputs, renamed inputs, changed defaults that affect verdict) or outputs (removed outputs, changed output names).
- **Minor bump (v1.0 → v1.1)** — additive inputs / outputs / artefact fields, new optional features.
- **Patch bump (v1.0.0 → v1.0.1)** — bug fixes, action SHA pin updates, dependency version bumps with no behavioural change.

The moving `@v1` tag is advanced on every minor and patch release.
