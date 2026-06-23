<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Go module

`integrations/go-ariada` provides `ariada-gate`, a `go install`-able wrapper for Go teams that want Ariada evidence in CI without reimplementing the scanner.

The module is deliberately thin. It shells out to the shared `@ariada-org/cli`, reads `multi-domain-report.json`, prints a Go-friendly gate summary, and returns a CI exit code:

- `0`: no findings at or above the threshold.
- `1`: findings at or above the threshold.
- `2`: invalid wrapper arguments.
- `3`: scanner/runtime failure.

## Install

```bash
go install github.com/ariada-org/ariada/integrations/go-ariada/cmd/ariada-gate@latest
npm install -g @ariada-org/cli
```

`ariada-gate` expects the Ariada CLI to be available as `ariada`. Override it with `ARIADA_BIN` or `-ariada-bin`.

## Usage

```bash
ariada-gate \
  -url http://127.0.0.1:8080/ \
  -domains accessibility,privacy,security \
  -severity-threshold moderate \
  -output-dir ariada-output
```

Positional URL is also accepted:

```bash
ariada-gate http://127.0.0.1:8080/
```

## CI example

```yaml
name: ariada-go-gate
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm install -g @ariada-org/cli
      - run: go install github.com/ariada-org/ariada/integrations/go-ariada/cmd/ariada-gate@latest
      - run: go run ./cmd/server &
      - run: ariada-gate -url http://127.0.0.1:8080/ -domains accessibility
```

## Distribution blocker

There is no marketplace account gate for the Go module itself: `go install` can fetch from the public Git repository once the module path is final and a public tag exists. The human gate is choosing the final module path and creating the release tag. The wrapper still depends on the separately distributed `@ariada-org/cli`.
