# Ariada Bitbucket Pipe

Bitbucket Pipe for running the Ariada differential accessibility gate in
Bitbucket Pipelines.

## Command Boundary

The pipe image installs `@ariada-org/cli` and the entrypoint runs:

```sh
ariada diff classify --head "$HEAD_SCAN" --base "$BASE_SCAN" --engine "$ENGINE" --out ariada-diff.json
ariada diff gate --diff ariada-diff.json --policy "$POLICY_FILE" --out ariada-decision.json
```

The adapter does not call model-provider APIs. If `ENGINE=canonical`, provide
`ARIADA_API_TOKEN` as a secured repository variable for the Ariada CLI.

## Usage

```yaml
pipelines:
  pull-requests:
    "**":
      - step:
          name: Ariada differential accessibility gate
          script:
            - pipe: docker://ariada/ariada-bitbucket-pipe:0.1.0
              variables:
                HEAD_SCAN: reports/head-scan.json
                BASE_SCAN: reports/base-scan.json
                POLICY_FILE: .ariada/policy.yaml
                ENGINE: stub
                FAIL_ON_WARN: "true"
```

## Variables

| Variable           | Default               | Purpose                         |
|--------------------|-----------------------|---------------------------------|
| `HEAD_SCAN`        | required              | Head ScanEvent JSON             |
| `BASE_SCAN`        | required              | Base ScanEvent JSON             |
| `POLICY_FILE`      | `.ariada/policy.yaml` | Gate policy                     |
| `ENGINE`           | `stub`                | Ariada diff engine              |
| `FAIL_ON_WARN`     | `false`               | Fail when the gate returns warn |
| `ARIADA_API_TOKEN` | empty                 | Required for managed engine     |

Update:
- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-06-22
