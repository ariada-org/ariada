# Ariada GitLab CI/CD Component

Reusable GitLab component for running the Ariada differential accessibility
gate outside GitHub Actions.

## Command Boundary

The component is intentionally thin. It installs `@ariada-org/cli` and runs:

```sh
ariada diff classify --head "$ARIADA_HEAD_SCAN" --base "$ARIADA_BASE_SCAN" --engine "$ARIADA_ENGINE" --out ariada-diff.json
ariada diff gate --diff ariada-diff.json --policy "$ARIADA_POLICY_FILE" --out ariada-decision.json
```

The adapter does not call model-provider APIs. If a managed engine is selected,
the Ariada CLI owns that boundary and expects `ARIADA_API_TOKEN` from GitLab CI
variables.

## Usage

```yaml
include:
  - component: gitlab.example.com/components/ariada/diff-gate@0.1.0
    inputs:
      head-scan: reports/head-scan.json
      base-scan: reports/base-scan.json
      policy-file: .ariada/policy.yaml
      engine: stub
      fail-on-warn: "true"
```

## Inputs

| Input          | Default                 | Purpose                         |
|----------------|-------------------------|---------------------------------|
| `job-name`     | `ariada_diff`           | Generated job name              |
| `stage`        | `test`                  | Pipeline stage                  |
| `image`        | `node:22-bookworm-slim` | Node image for the Ariada CLI   |
| `head-scan`    | required                | Head ScanEvent JSON             |
| `base-scan`    | required                | Base ScanEvent JSON             |
| `policy-file`  | `.ariada/policy.yaml`   | Gate policy                     |
| `engine`       | `stub`                  | Ariada diff engine              |
| `fail-on-warn` | `false`                 | Fail when the gate returns warn |

Update:
- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-06-22
