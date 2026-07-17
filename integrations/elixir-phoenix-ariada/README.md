# Ariada Phoenix

`ariada_phoenix` is a thin Hex package for Phoenix applications. It adds
`mix ariada.scan`, which shells out to the shared `@ariada-org/cli` scanner and
parses the JSON result for CI-friendly gate output.

It does not implement accessibility scanning in Elixir. The scanner remains the
shared Ariada CLI:

```sh
npm install -g @ariada-org/cli
mix ariada.scan --url http://localhost:4000 --max-violations 0
```

## Phoenix fit

Phoenix applications commonly expose rendered HTML at `http://localhost:4000`
in development. The mix task defaults to that URL unless `--url`, `--path`, or
the `:ariada_phoenix, :base_url` application config overrides it.

## Options

```sh
mix ariada.scan --url http://localhost:4000
mix ariada.scan --path priv/static/index.html
mix ariada.scan --cli /path/to/ariada --max-violations 3
```

- `--url` scans a running Phoenix/Phoenix LiveView surface.
- `--path` scans built or captured static HTML.
- `--cli` points to an Ariada CLI binary when `ariada` is not on `PATH`.
- `--max-violations` controls the CI gate. The default is `0`.

## Local validation status

This workstation does not have `elixir` or `mix` installed, and Docker is
installed but its daemon is not running. The Hex host gates are therefore
documented as blocked in `scan-evidence/result.html`. The fixture, evidence
report, screenshot dimensions, nonblank screenshot pixels, and Dash-plus report
audit are still validated locally.

## Publishing blocker

Publishing requires a Hex.pm account and authenticated `mix hex.publish` on a
machine with Elixir/Mix installed. That is a human registry step, not something
this wrapper can complete locally.
