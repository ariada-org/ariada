# Ariada CircleCI Orb

CircleCI orb source for running the Ariada differential accessibility gate.

## Command Boundary

The orb installs `@ariada-org/cli` and runs:

```sh
ariada diff classify --head "<head-scan>" --base "<base-scan>" --engine "<engine>" --out ariada-diff.json
ariada diff gate --diff ariada-diff.json --policy "<policy-file>" --out ariada-decision.json
```

The adapter does not call model-provider APIs. If the managed engine is selected,
set `ARIADA_API_TOKEN` in the CircleCI project or context.

## Usage

```yaml
version: 2.1
orbs:
  ariada: ariada/accessibility-gate@0.1.0
workflows:
  accessibility:
    jobs:
      - ariada/diff-gate:
          head-scan: reports/head-scan.json
          base-scan: reports/base-scan.json
          policy-file: .ariada/policy.yaml
          engine: stub
          fail-on-warn: true
```

## Parameters

| Parameter      | Default               | Purpose                         |
|----------------|-----------------------|---------------------------------|
| `head-scan`    | required              | Head ScanEvent JSON             |
| `base-scan`    | required              | Base ScanEvent JSON             |
| `policy-file`  | `.ariada/policy.yaml` | Gate policy                     |
| `engine`       | `stub`                | Ariada diff engine              |
| `fail-on-warn` | `false`               | Fail when the gate returns warn |

Update:
- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-06-22
