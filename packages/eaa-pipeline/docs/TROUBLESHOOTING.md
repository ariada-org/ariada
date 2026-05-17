# Troubleshooting

Common errors observed in the wild, plus the fix that resolved them. If you hit something not listed here, open a discussion at `https://github.com/ariada-org/ariada/discussions`.

## "site-url must start with https://"

You passed an `http://` URL or omitted the scheme entirely. The audit refuses plaintext targets because EAA conformance is meaningless against an unencrypted page (a third-party network observer can rewrite the response, invalidating any conformance claim).

Fix: pass `https://example.com`, not `http://example.com` or `example.com`.

If your site is HTTP-only because it is a local development server, the audit should not run against it in CI — run the rule pack directly in your test suite instead. The reusable workflow is for public URLs.

## "page entry '...' must start with /"

You passed a `pages:` entry without a leading slash. The validator is strict to avoid ambiguity when concatenating with `site-url`.

Fix:

```yaml
# Wrong
pages: 'about,contact'
# Right
pages: '/about,/contact'
```

## "fail-on value '...' is not one of: minor, moderate, serious, critical"

You typo'd a level (commonly `error` instead of `critical`, or `warning` instead of `serious`). axe-core uses the four levels above, no others.

Fix: see [INPUTS.md](INPUTS.md) §`fail-on`.

## Workflow finishes with PASS but you know the site has issues

Likely cause: the target site is unreachable from GitHub runner IPs. `@axe-core/cli` times out, no violations are recorded, the totals are all zero, and the verdict is PASS.

Diagnose: download the artefact, open `report.json`, and check `pagesScanned`. If it is zero or much lower than your `pages:` list length, the scan never completed.

Fix: run on a self-hosted runner with an egress IP on the target site's allowlist:

```yaml
jobs:
  audit:
    uses: ariada-org/ariada/.github/workflows/eaa-audit.yml@v1
    with:
      runner: 'self-hosted'
      site-url: 'https://internal.example.com'
```

## Workflow fails with "ERR_PNPM_NO_MATCHING_VERSION"

`pack-version` references a package version that does not exist on npm. Common cause: typo, or pinning to a pre-release tag that has since been deleted.

Fix: check available versions with `npm view @ariada/wcag-rules-extended versions --json` and pin to one of them, or use the `next` / `latest` dist-tags.

## PR comment is missing on a pull-request run

Two possible causes:

1. The caller workflow declares `permissions: read-all` at the top level, which overrides the reusable workflow's `pull-requests: write`. GitHub's permissions model takes the most restrictive intersection.

   Fix: in the caller workflow, add `permissions: { contents: read, pull-requests: write }` at the job level (not the workflow level) for the audit job.

2. The workflow ran on a `pull_request` from a fork. GitHub does not give `GITHUB_TOKEN` write permissions on forked-PR workflows. This is a hard limit, not a bug.

   Fix: switch to `pull_request_target` (with strict caller-side review of incoming PR content) OR run the audit on `push` to main and post the comment from a follow-up workflow that consumes the artefact.

## Workflow exits non-zero even though `fail-on: 'critical'` and totals show 0 critical

Check `report.json`. If `totalsByImpact.critical` is genuinely 0 but the job still failed, the failure was from an earlier step (likely a network error in the scan step that we did not catch). The pnpm log preceding the summarise step will identify the root cause.

If you cannot determine the cause, open a discussion with the workflow run URL attached.

## "axe is exiting because no element with selector ... was found"

The page loaded, but the selectors a rule depends on are not present. Most often this is benign — the rule simply has nothing to evaluate on this page — and produces zero violations, zero passes for that rule. It is logged at INFO level and does not fail the run.

If you want explicit confirmation a rule fired on a page, run the rule pack directly with `pnpm exec axe ... --verbose` outside the workflow.
