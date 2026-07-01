# jekyll-ariada

Thin Jekyll plugin for running Ariada evidence scans after a Jekyll site is
written. The plugin registers a `:site, :post_write` hook, then delegates to the
shared `@ariada-org/cli` scanner. It does not implement scanning rules in Ruby.

## Install

```ruby
group :jekyll_plugins do
  gem "jekyll-ariada"
end
```

```yaml
plugins:
  - jekyll-ariada

ariada:
  enabled: true
  gate: true
  cli_command: "npx @ariada-org/cli"
  output_dir: "scan-evidence/ariada-output"
  browser: "chromium"
  format: "json"
  severity_threshold: "moderate"
  timeout_ms: 30000
  domains:
    - accessibility
```

By default the plugin targets Jekyll's generated destination directory. Because the
current shared CLI accepts HTTP(S) URLs, the wrapper temporarily serves that
directory on localhost and passes the localhost URL to `@ariada-org/cli`.

Run Jekyll in a build job:

```sh
bundle exec jekyll build
```

## GitHub Pages Caveat

Default GitHub Pages Jekyll builds run in a restricted mode that does not execute
arbitrary custom plugins. Use GitHub Actions or another CI host to build the site,
run `jekyll-ariada`, upload the evidence artifacts, then deploy the generated
static output to Pages.

## Evidence Contract

The expected evidence bundle is:

- `scan-evidence/ariada-output/scan.json`
- `scan-evidence/command.log`
- `scan-evidence/command.exit`
- `scan-evidence/scan-result-preview.html`
- `scan-evidence/screenshots/scan-result.png`
- `scan-evidence/result.html`

The screenshot included in this channel is classified as scan-result preview
evidence. A hosted GitHub Pages/Netlify/Cloudflare Pages screenshot remains a
separate host-surface evidence item.

## Local Verification

```sh
ruby -c lib/jekyll-ariada.rb
ruby -c lib/jekyll/ariada.rb
ruby -c lib/jekyll/ariada/scanner.rb
ruby -c lib/jekyll/ariada/configuration.rb
ruby -Ilib:test test/scanner_test.rb test/plugin_test.rb
gem build jekyll-ariada.gemspec
ruby scripts/run_fixture_scan.rb
ruby scripts/build_evidence_reports.rb
python3 scripts/validate_screenshot.py scan-evidence/screenshots/scan-result.png
```

If `bundle exec jekyll` is unavailable locally, `scripts/run_fixture_scan.rb`
records that host blocker and scans the rendered fallback fixture instead.
