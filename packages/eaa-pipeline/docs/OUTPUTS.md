# Outputs reference

Canonical reference for every output declared by `eaa-audit.yml`, plus the artefact bundle the workflow uploads.

## Job outputs

These are the `outputs:` declared in `eaa-audit.yml` and reachable from a caller's downstream job via `needs.<job-id>.outputs.<name>`.

### `violations-count`

- **Type:** number (string-encoded as GitHub Actions always passes outputs as strings)
- **Description:** Total violations across all scanned pages, summed across all impact levels.

Example consumption:

```yaml
jobs:
  audit:
    uses: ariada-org/ariada/.github/workflows/eaa-audit.yml@v1
    with:
      site-url: "https://example.com"
  notify:
    needs: audit
    runs-on: ubuntu-latest
    if: ${{ fromJSON(needs.audit.outputs.violations-count) > 10 }}
    steps:
      - run: |
          echo "More than 10 violations — paging the team."
```

### `report-artefact`

- **Type:** string
- **Description:** Name of the artefact bundle uploaded by this run. Currently `eaa-audit-${{ github.run_id }}`.

Use this to fetch the artefact in a downstream job:

```yaml
download-and-publish:
  needs: audit
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
      with:
        name: ${{ needs.audit.outputs.report-artefact }}
        path: ./eaa-audit/
    - run: ls -la ./eaa-audit/
```

### `sarif-uploaded`

- **Type:** boolean (string-encoded `'true'` / `'false'`)
- **Description:** `'true'` iff the `github/codeql-action/upload-sarif@v3` step succeeded. `'false'` covers all failure modes (rate-limit, malformed SARIF, missing `security-events: write` permission, GitHub Security disabled on the caller repo).

```yaml
notify:
  needs: audit
  runs-on: ubuntu-latest
  if: needs.audit.outputs.sarif-uploaded != 'true'
  steps:
    - run: echo "::warning::SARIF did not upload to GitHub Security; check security-events permission"
```

### `status`

- **Type:** string
- **Values:** `pass` | `fail` | `error`
- **Description:** High-level verdict, easier to read than the job's exit code. `pass` means no violations at any `fail-on`-listed impact level; `fail` means policy FAIL; `error` means the scan never produced `report.json` (network / runtime / install failure — see exit-code reference in `packages/eaa-pipeline/README.md`).

```yaml
gate:
  needs: audit
  runs-on: ubuntu-latest
  steps:
    - name: Branch by verdict
      run: |
        case "${{ needs.audit.outputs.status }}" in
          pass)  echo "::notice::EAA audit passed" ;;
          fail)  echo "::error::EAA audit failed — see PR comment + artefact"; exit 1 ;;
          error) echo "::error::EAA audit could not complete (network / runtime)"; exit 1 ;;
        esac
```

## Artefact bundle

The workflow uploads a single artefact (default name: `eaa-audit-${{ github.run_id }}`) containing the following files. The artefact retention is 30 days.

### `report.json`

JSON report of the full audit. Top-level shape:

```json
{
  "runAt": "2026-05-16T09:23:11.892Z",
  "siteUrl": "https://example.com",
  "scannerPack": "@ariada-org/wcag-rules-extended",
  "scannerPackVersion": "0.2.1",
  "pagesScanned": 4,
  "totalViolations": 7,
  "totalsByImpact": { "minor": 2, "moderate": 1, "serious": 3, "critical": 1 },
  "failOn": ["serious", "critical"],
  "verdict": "FAIL",
  "perPage": [
    {
      "url": "https://example.com/",
      "violationCount": 3,
      "counts": { "minor": 1, "moderate": 0, "serious": 2, "critical": 0 },
      "violations": [
        {
          "id": "color-contrast",
          "impact": "serious",
          "description": "Elements must meet minimum color contrast ratio thresholds",
          "helpUrl": "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
          "nodeCount": 4
        }
      ]
    }
  ]
}
```

This is the primary machine-readable artefact. Most downstream consumers should parse `report.json` rather than the human-readable HTML or VPAT.

### `accessibility-statement.html` (when `emit-statement: true`)

HTML file containing a starter accessibility statement, suitable as the basis for the page that EAA Annex I §I.1 and Directive (EU) 2016/2102 art. 7 require to be published on the audited site itself.

The generated HTML embeds:

- The audited URL.
- The conformance verdict (full / partial / non-conformant), derived from the totals-by-impact totals.
- The audit timestamp.
- The scanner package + version.
- A methodology paragraph linking to this workflow and to the rule-pack repo.

The file is informational. Publish only after a human reviews and adds site-specific commitment text (feedback channel, accessibility coordinator email, escalation procedure). The auto-generated file is a scaffold, not a finished statement.

### `vpat.json` (when `emit-evidence: true`)

JSON document with VPAT-style shape, listing the conformance verdict and per-page violations under a stable schema. Top-level shape:

```json
{
  "schema": "https://ariada.org/schemas/vpat-machine-readable-v1.json",
  "generatedAt": "2026-05-16T09:23:11.892Z",
  "scope": { "siteUrl": "https://example.com", "pagesScanned": 4 },
  "scanner": { "name": "@ariada-org/wcag-rules-extended", "version": "0.2.1" },
  "verdict": "FAIL",
  "totals": { "minor": 2, "moderate": 1, "serious": 3, "critical": 1 },
  "standards": ["WCAG-2.2-AA", "EN-301-549-v3.2.1", "EAA-Annex-I"],
  "disclaimer": "Automated audit only. Manual review required for full VPAT.",
  "perPage": [
    /* ... */
  ]
}
```

This is NOT a substitute for a manually authored VPAT. It documents the automated-audit slice in a machine-readable form that procurement teams can ingest.

### `accessibility.json` (when `emit-evidence: true`)

JSON document suitable as a drop-in for `/.well-known/accessibility.json` on the audited site. Follows the emerging pattern parallel to `security.txt`. Top-level shape:

```json
{
  "schema": "https://ariada.org/schemas/well-known-accessibility-v1.json",
  "site": "https://example.com",
  "statementUrl": "https://example.com/accessibility/",
  "standard": "WCAG-2.2-AA",
  "conformance": "partial",
  "lastAudited": "2026-05-16T09:23:11.892Z",
  "audit": {
    "type": "automated",
    "tool": "@ariada-org/wcag-rules-extended",
    "toolVersion": "0.2.1"
  }
}
```

The `.well-known/accessibility.json` convention is not (yet) an IETF RFC. The schema URL above is owned by Ariada and remains stable across the v1.x line.

## PR comment

When the workflow runs on a `pull_request` event, the audit job posts a single comment to the PR with the conformance verdict and a totals-by-impact table. The comment is appended on every run; it is not edited in place. If you prefer in-place updates, write a thin wrapper workflow that calls this one and then uses `peter-evans/create-or-update-comment` against the resulting artefact.
