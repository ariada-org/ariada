# @ariada/diff-action

Composite GitHub Action wrapping the differential accessibility CI gate.
Post a PR comment with new / pre-existing / resolved finding counts and
gate the merge based on a declarative policy file.

Open source under [EUPL-1.2](./LICENSE).

## Usage

```yaml
name: a11y-diff
on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  ariada-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ariada-org/ariada-diff-action@v0
        with:
          head-scan: path/to/head.json
          base-scan: path/to/base.json
          policy-file: .ariada/policy.yaml
          engine: canonical
          ariada-api-token: ${{ secrets.ARIADA_API_TOKEN }}
```

## Inputs

| Name                 | Default                    | Description                                          |
|----------------------|----------------------------|------------------------------------------------------|
| `head-scan`          | —                          | Path to head ScanEvent JSON                          |
| `base-scan`          | —                          | Path to base ScanEvent JSON                          |
| `policy-file`        | `.ariada/policy.yaml`      | Path to BaselinePolicy YAML                          |
| `engine`             | `canonical`                | `stub` (OSS) or `canonical` (SaaS)                   |
| `ariada-api-token`   | —                          | Required for `engine: canonical`                     |
| `pr-comment`         | `true`                     | Post PR comment with diff summary                    |
| `report-format`      | `markdown`                 | `markdown` / `sarif` / `json`                        |
| `fail-on-warn`       | `false`                    | Treat `warn` decisions as `fail`                     |

## Outputs

| Name                  | Description                                |
|-----------------------|--------------------------------------------|
| `gate-result`         | `pass` / `fail` / `warn`                   |
| `new-count`           | Number of new findings                     |
| `pre-existing-count`  | Number of pre-existing findings            |
| `resolved-count`      | Number of resolved findings                |
| `report-url`          | URL to the full report                     |
| `decision-id`         | GateDecision ULID for audit                |

## Required permissions

The consumer workflow must grant these permissions explicitly:

```yaml
permissions:
  contents: read         # checkout
  pull-requests: write   # PR comment
  checks: write          # check run with detailed result
```

If `pull-requests: write` is absent, PR-comment posting is skipped with a
console warning and the gate decision still propagates via exit code.

## Exit codes

| Code | Meaning                                                                   |
|------|---------------------------------------------------------------------------|
| `0`  | Gate pass                                                                 |
| `1`  | Gate fail                                                                 |
| `2`  | Configuration error (policy file invalid, schema mismatch)                |
| `3`  | Network error talking to the canonical engine                             |
| `4`  | Authentication error (invalid `ariada-api-token`)                         |
| `5`  | Rate-limited (free tier quota exceeded)                                   |
| `10` | Internal error                                                            |

## License

EUPL-1.2 for code; CC-BY-SA-4.0 for prose; CC0-1.0 for build config.
See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
