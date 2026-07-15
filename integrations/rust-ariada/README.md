<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Rust crate

`integrations/rust-ariada` provides `cargo-ariada`, a Cargo subcommand wrapper for Rust teams that want Ariada scan evidence without reimplementing scanner rules in Rust.

The crate is deliberately thin. It shells out to the shared `@ariada-org/cli`, reads `multi-domain-report.json`, prints a Cargo-friendly summary, and returns a CI exit code:

- `0`: no findings at or above the threshold.
- `1`: findings at or above the threshold.
- `2`: invalid wrapper arguments.
- `3`: scanner/runtime failure.

## Install

```bash
cargo install cargo-ariada
npm install -g @ariada-org/cli
```

`cargo-ariada` expects the Ariada CLI to be available as `ariada`. Override it with `ARIADA_BIN` or `--ariada-bin`.

## Usage

Run against a live Rust web service:

```bash
cargo ariada scan \
  http://127.0.0.1:8080/ \
  --domains accessibility,privacy,security \
  --severity-threshold moderate \
  --output-dir ariada-output
```

Run against built static output:

```bash
cargo ariada scan \
  --static-dir target/doc \
  --domains accessibility \
  --output-dir ariada-output
```

The static-dir mode starts a loopback static server and still delegates all scanning to `@ariada-org/cli`; it does not implement accessibility, privacy, security, or other scanner rules.

## CI example

```yaml
name: ariada-rust-gate
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm install -g @ariada-org/cli
      - run: cargo install cargo-ariada
      - run: cargo run --bin web-app &
      - run: cargo ariada scan http://127.0.0.1:8080/ --domains accessibility
```

## Distribution blocker

Publishing to crates.io requires the founder or release coordinator to approve the crate name, run `cargo login`, and publish with the organization release process. The wrapper also depends on the separately distributed `@ariada-org/cli`.

## Scope

This package is a Cargo channel adapter only. It does not contain Ariada scanner rules, WCAG logic, browser capture code, or domain-specific compliance checks.
