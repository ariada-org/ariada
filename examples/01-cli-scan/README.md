<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Example 01 — `ariada` CLI scan of a local HTML file

A minimal end-to-end example showing how to invoke the `ariada` command-line
runner from `@ariada-org/cli` against a single local HTML file, and what the
output looks like.

## What this shows

The `ariada scan` subcommand fetches a URL, runs the EAA-2025 WCAG 2.2 AA
rule pack from `@ariada-org/wcag-rules-extended` on the rendered page, and
prints a human-readable findings table plus a JSON report. This example
uses a deliberately broken `sample.html` so the output is non-empty.

The CLI accepts `http(s)://` URLs only, so the example serves `sample.html`
over a local static HTTP server first.

## Setup

This example uses workspace-linked packages, so run `pnpm install` at the
monorepo root once before running anything here:

```sh
# from the monorepo root
pnpm install
pnpm --filter @ariada-org/cli build
```

## Run

In one terminal, start the static server (uses Python 3's built-in
`http.server` — no extra dependency):

```sh
cd examples/01-cli-scan
pnpm serve
```

In a second terminal, run the scan:

```sh
cd examples/01-cli-scan
pnpm scan
```

The expected output is captured in `expected-output.txt` — the six
deliberately-failing WCAG criteria (1.1.1, 1.3.1, 1.3.5, 1.4.3, 2.4.4,
3.3.2) plus a handful of structural findings the rule pack emits on any
sparse sample document (`html-has-lang`, `landmark-one-main`,
`page-has-heading-one`, and several `region` results). The process exits
with code `1` (violations present); a clean run returns `0`.

For a machine-readable report, use `pnpm scan:json` and pipe the output
into `@ariada-org/evidence-emitter` (see `examples/03-evidence-bundle/`).
