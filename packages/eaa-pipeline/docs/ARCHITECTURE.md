# Architecture

This document explains the data flow, the design choices behind the reusable workflow, and the alternatives that were considered and rejected.

## Data flow

```
caller-repo                       ariada-org/ariada           public registry
─────────────                     ────────────────────────          ────────────────
  workflow file                     .github/workflows/                npm
  with `uses:` line   ───────►      eaa-audit.yml
                                          │
                                          ├─► setup-node@v4 (SHA-pinned)
                                          ├─► pnpm/action-setup@v4 (SHA-pinned)
                                          │
                                          ├─► pnpm add @ariada-org/wcag-rules-extended ◄────────┐
                                          │   pnpm add @axe-core/cli                        │
                                          │   pnpm add axe-core                             │
                                          │                                                 │
                                          ├─► axe <url> --save reports/*.json               │
                                          │     (one invocation per `pages` entry)          │
                                          │                                                 │
                                          ├─► aggregate reports → report.json               │
                                          │   (Node inline script)                          │
                                          │                                                 │
                                          ├─► generate accessibility-statement.html         │
                                          │   (optional, on emit-statement: true)           │
                                          │                                                 │
                                          ├─► generate vpat.json + accessibility.json       │
                                          │   (optional, on emit-evidence: true)            │
                                          │                                                 │
                                          ├─► upload-artifact@v4 (SHA-pinned)               │
                                          │                                                 │
                                          ├─► github-script@v7: post PR comment             │
                                          │   (only when github.event_name == pull_request) │
                                          │                                                 │
                                          └─► exit 1 if violations at fail-on > 0           │
                                                                                            │
                                                                                       (registry.npmjs.org)
```

All third-party action invocations are pinned by commit SHA per OpenSSF Scorecard. All npm dependencies are installed at fixed versions inside the workflow's scratch directory (`audit-workspace/`).

## Why a reusable workflow, not a composite action

[GitHub distinguishes](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions) two patterns for shareable Actions code:

1. **Composite action** — multiple steps bundled as a single `uses:` step. Lives at `action.yml`. Callers invoke it inside a job with `steps: - uses: owner/repo@v1`.
2. **Reusable workflow** — an entire workflow callable as a job. Lives at `.github/workflows/*.yml`. Callers invoke it as `jobs.X.uses: owner/repo/.github/workflows/file.yml@v1`.

We chose the reusable workflow because:

- It owns the entire job, including `runs-on`, `permissions`, and `timeout-minutes`. A composite action inherits these from the caller, which is fragile (caller might have `permissions: read-all` set but the audit needs `pull-requests: write` to post a comment).
- It can emit job-level `outputs:` that downstream jobs in the caller's workflow can consume.
- It can run on `pull_request` triggers and post comments without requiring the caller to declare a separate `pull_request` workflow.
- The PR-comment step needs `pull-requests: write`, which a composite action can request but cannot grant — only a reusable workflow can declare its own permissions block.

A composite-action variant may ship later (`action.yml`) for callers who want to embed the audit inside an existing job. It is explicitly out of scope for v1.0.0.

## Why `@axe-core/cli`, not direct `axe.run()`

The package `@ariada-org/wcag-rules-extended` is an axe-core extension, not a standalone scanner. To run it against a live URL we need a browser. Three options:

1. **`@axe-core/cli`** — official Deque CLI. Spins up Puppeteer + headless Chromium internally. Accepts a URL on the command line. License MPL-2.0.
2. **Playwright + axe-core/playwright** — full browser automation; supports scripted scenarios (clicks, form fills).
3. **Custom Puppeteer harness** — reinvent the wheel.

We chose `@axe-core/cli` for v1 because the workflow's stated scope is "scan public URLs", not "drive scripted user flows". `@axe-core/cli` is purpose-built for this, ships from Deque, and inherits axe-core's `configure()` API for registering the EAA rule pack.

The downside is that `@axe-core/cli` cannot follow links, fill forms, or scan post-login pages. Callers who need that should bypass this workflow and call the rule pack directly inside their own Playwright suite.

## Why Node 22 + pnpm 9.15.0

- **Node 22** — the package's `package.json` declares `"engines": { "node": ">=22" }` (verified against `packages/wcag-rules-extended/package.json`). Older Node versions cannot install it.
- **pnpm 9.15.0** — matches the version pinned in the sibling `wcag-rules-extended` repo's CI (`packages/wcag-rules-extended/.github/workflows/ci.yml:45`). Keeping the two repos on the same pnpm version eliminates a class of "works for me" reports.

These versions are bumped in lockstep with the sibling repo whenever the upstream package raises its minimums. Bumps are major-version events for this workflow.

## Why SHA-pinning every action

OpenSSF Scorecard's [Pinned-Dependencies check](https://github.com/ossf/scorecard/blob/main/docs/checks.md#pinned-dependencies) requires every `uses:` line in any workflow file to reference a commit SHA, not a tag. Tags can be force-pushed by a malicious or compromised action maintainer; commit SHAs cannot.

Every `uses:` line in this repo follows the pattern:

```yaml
uses: owner/repo@<40-char-sha> # vX.Y.Z
```

The trailing comment makes the human-readable version visible while the line itself is unforgeable. SHAs are bumped manually after maintainer review of upstream release notes.

## Why a scratch `audit-workspace/` directory

The workflow installs packages into a directory that does NOT exist in the caller's repository. Two reasons:

1. **Avoid colliding with the caller's `node_modules`.** The caller may have a totally different Node version or package manager.
2. **Avoid corrupting the caller's lockfile.** `pnpm add` writes a lockfile; we do not want to dirty the caller's working tree.

The directory is ephemeral (lives only for the duration of the runner) and is not uploaded as an artefact. Only the `output/` subdirectory (containing the report and statement) is uploaded.

## Failure modes and recovery

- **Site unreachable from GitHub IPs.** `pnpm exec axe` times out after 60s per page. The job will eventually emit zero violations for that page (because nothing was scanned) — which can look like a false PASS. Mitigation: pre-flight the URL with `curl` and fail fast if non-2xx. Tracked for v1.1.
- **`@ariada-org/wcag-rules-extended@${pack-version}` does not exist.** `pnpm add` fails at the install step, the job fails fast. The error message points at the unresolvable spec.
- **Site rate-limits GitHub runner IPs.** Callers see "429 Too Many Requests" in scan logs. Mitigation: use `runner: self-hosted` with an IP on the site's allowlist.
- **Caller's repo has no `pull_request` trigger.** The PR-comment step is gated on `github.event_name == 'pull_request'` and silently skips when run from a push or schedule. No failure mode.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for the operator-facing version of this list.
