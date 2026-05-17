# Inputs reference

Canonical reference for every input declared by `eaa-audit.yml`. Source of truth for tooling that generates documentation from the workflow file.

## `site-url`

- **Required:** yes
- **Type:** string
- **Default:** (none)
- **Pattern:** `https://[host][:port][/path]`

Base URL the audit job scans. Must use `https://` (HTTP is rejected by the validate-inputs step). Must be publicly reachable from GitHub-hosted runner IP ranges, or from your self-hosted runner's egress IP.

Examples:

```yaml
site-url: 'https://example.com'
site-url: 'https://shop.example.com/'
site-url: 'https://docs.example.com/v2'    # path prefix is supported
```

If `site-url` ends with a trailing slash, the slash is stripped before concatenating each `pages` entry; you get the expected URL either way.

## `pages`

- **Required:** no
- **Type:** string (comma-separated paths)
- **Default:** `/`
- **Pattern:** each entry must start with `/`

Comma-separated list of paths to append to `site-url`. The audit job iterates the list and runs one axe scan per entry. Use `/` for the homepage.

Examples:

```yaml
pages: '/'                                  # homepage only
pages: '/,/about/,/checkout/'               # three pages
pages: '/login,/signup,/forgot-password'    # three auth pages
```

Whitespace around commas is tolerated. Empty entries are silently skipped. There is no hard cap on the number of pages, but each scan takes ~10-20 seconds, so a 50-page audit can hit the workflow's 15-minute timeout.

## `fail-on`

- **Required:** no
- **Type:** string (comma-separated impact levels)
- **Default:** `serious,critical`
- **Allowed values:** `minor`, `moderate`, `serious`, `critical`

Comma-separated axe-core impact levels. If the aggregated violation count at any listed level is greater than zero, the job exits non-zero. The level taxonomy is axe-core's: [docs](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#results-object).

Recommended progression for callers bringing a legacy site into conformance:

```yaml
fail-on: 'critical'                # phase 1: stop the bleeding
fail-on: 'serious,critical'        # phase 2: the workflow default
fail-on: 'moderate,serious,critical' # phase 3: nearly all axe-core findings
```

Setting `fail-on: 'minor,moderate,serious,critical'` makes the job fail on any axe finding, which is rarely useful for production sites because axe-core flags some `minor` items that are debatable.

## `emit-statement`

- **Required:** no
- **Type:** boolean
- **Default:** `true`

If `true`, the workflow generates an HTML accessibility-statement page and uploads it as part of the artefact bundle. The generated HTML follows the [Directive (EU) 2016/2102 art. 7](https://eur-lex.europa.eu/eli/dir/2016/2102/oj) template shape — usable as a starting point for the public statement that EAA Annex I §I.1 requires.

The generated statement is informational only; it embeds the audit timestamp, total violations, and the audit tool name. It does NOT promise any conformance level the audit cannot prove. Callers are expected to extend the auto-generated file with site-specific commitment text before publishing.

Set to `false` if you maintain a manually-authored statement elsewhere.

## `emit-evidence`

- **Required:** no
- **Type:** boolean
- **Default:** `true`

If `true`, the workflow generates two machine-readable evidence artefacts:

1. `vpat.json` — VPAT-shaped JSON with conformance verdict, totals by impact, and per-page violation summaries. Disclaims that this is the automated-audit slice only and that manual review remains required.
2. `accessibility.json` — drop-in for the emerging `/.well-known/accessibility.json` discovery path, following the pattern of `security.txt`. Contains site URL, statement URL, conformance level, and the last-audited timestamp.

Set to `false` if your downstream consumer only needs the human-readable statement.

## `pack-version`

- **Required:** no
- **Type:** string
- **Default:** `next`

npm dist-tag or semver of `@ariada/wcag-rules-extended` to install in the scratch project. Passed verbatim to `pnpm add`, so any pnpm-supported spec works:

```yaml
pack-version: 'next'        # the unstable dist-tag
pack-version: 'latest'      # the stable dist-tag
pack-version: '0.2.1'       # an exact version
pack-version: '~0.2.0'      # latest 0.2.x patch
```

Most callers should pin to a specific semver (`'0.2.1'`) once the package has a stable release; `next` is fine for early adopters who want to track the head of development.

## `runner`

- **Required:** no
- **Type:** string
- **Default:** `ubuntu-latest`

GitHub Actions runner label. The workflow is tested only on `ubuntu-latest`. Other GitHub-hosted runners (`ubuntu-22.04`, `ubuntu-24.04`) are expected to work but not regularly tested in CI.

Self-hosted runners are user-supported, not maintainer-tested:

```yaml
runner: 'self-hosted'                          # any self-hosted runner
runner: '["self-hosted", "linux", "x64"]'      # labels supported via JSON-string
```

If your audit target rate-limits GitHub's runner IP ranges (e.g. a WAF that blocks AWS IP space), running on a self-hosted runner with a permitted egress IP is the standard mitigation.
