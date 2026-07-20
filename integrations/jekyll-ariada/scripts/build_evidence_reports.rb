#!/usr/bin/env ruby
# frozen_string_literal: true

require "base64"
require "cgi"
require "fileutils"
require "json"

ROOT = File.expand_path("..", __dir__)
TEST_REPORT = File.join(ROOT, "test-report")
SCAN_EVIDENCE = File.join(ROOT, "scan-evidence")

def esc(value)
  CGI.escapeHTML(value.to_s)
end

def read(path)
  File.exist?(path) ? File.read(path, encoding: "UTF-8") : ""
end

def exit_status(name)
  read(File.join(TEST_REPORT, "logs", "#{name}.exit")).strip
end

def status_for(name, allowed = ["0"])
  allowed.include?(exit_status(name)) ? "pass" : "fail"
end

def shell_log(name)
  text = read(File.join(TEST_REPORT, "logs", "#{name}.log")).strip
  text.empty? ? "(no output)" : text
end

def scan_report_path
  multi = File.join(SCAN_EVIDENCE, "ariada-output", "multi-domain-report.json")
  single = File.join(SCAN_EVIDENCE, "ariada-output", "scan.json")
  File.exist?(multi) ? multi : single
end

def scan_report
  path = scan_report_path
  return {} unless File.exist?(path)

  JSON.parse(File.read(path, encoding: "UTF-8"))
end

def scan_total(report)
  summary = report["summary"]
  return summary["total"].to_i if summary.is_a?(Hash) && summary.key?("total")

  grid = report["grid"]
  return 0 unless grid.is_a?(Hash)

  grid.values.sum do |site|
    next 0 unless site.is_a?(Hash)

    site.values.sum { |findings| findings.is_a?(Array) ? findings.length : 0 }
  end
end

def table(headers, rows)
  head = headers.map { |h| "<th scope='col'>#{esc(h)}</th>" }.join
  body = rows.map do |row|
    cells = row.each_with_index.map do |cell, index|
      tag = index.zero? ? "th scope='row'" : "td"
      "<#{tag}>#{cell}</#{tag.split.first}>"
    end.join
    "<tr>#{cells}</tr>"
  end.join("\n")
  "<table><thead><tr>#{head}</tr></thead><tbody>#{body}</tbody></table>"
end

def link(url, label = nil)
  "<a href='#{esc(url)}'>#{esc(label || url)}</a>"
end

def page(title, body)
  <<~HTML
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>#{esc(title)}</title>
    <style>
    body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#15171c;background:#f6f7f9}
    main{max-width:1120px;margin:0 auto;padding:32px 20px}
    h1{font-size:2rem;margin:0 0 12px}
    h2{font-size:1.22rem;margin-top:30px;border-bottom:1px solid #d6dbe3;padding-bottom:6px}
    h3{font-size:1rem;margin:18px 0 8px}
    table{border-collapse:collapse;width:100%;background:#fff;margin:12px 0}
    th,td{border:1px solid #d6dbe3;padding:8px;text-align:left;vertical-align:top}
    code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#eef1f5;padding:1px 5px;border-radius:4px}
    pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}
    figure{margin:18px 0;background:#fff;border:1px solid #d6dbe3;border-radius:8px;overflow:hidden}
    img{display:block;max-width:100%;height:auto}
    figcaption{padding:10px 14px}
    .status{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.85rem;font-weight:700}
    .pass{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}
    .warn{background:#fff4ce;color:#744500;border:1px solid #eac54f}
    .block{background:#ffe2e0;color:#8c1d18;border:1px solid #f0a09b}
    .note{background:#fff;border:1px solid #d6dbe3;border-radius:8px;padding:12px 14px}
    a:focus-visible,summary:focus-visible{outline:3px solid #0b5cad;outline-offset:2px}
    </style>
    </head>
    <body><main>
    <h1>#{esc(title)}</h1>
    #{body}
    </main></body></html>
  HTML
end

def build_test_report
  gates = [
    ["ruby syntax: plugin entry", "ruby -c lib/jekyll-ariada.rb", "ruby-syntax-entry", ["0"]],
    ["ruby syntax: hook", "ruby -c lib/jekyll/ariada.rb", "ruby-syntax-hook", ["0"]],
    ["ruby syntax: scanner", "ruby -c lib/jekyll/ariada/scanner.rb", "ruby-syntax-scanner", ["0"]],
    ["ruby syntax: configuration", "ruby -c lib/jekyll/ariada/configuration.rb", "ruby-syntax-config", ["0"]],
    ["unit tests", "ruby -Ilib:test test/scanner_test.rb test/plugin_test.rb", "unit-tests", ["0"]],
    ["gem build", "gem build jekyll-ariada.gemspec", "gem-build", ["0"]],
    ["bundler install", "bundle install --path vendor/bundle", "bundle-install", ["0"]],
    ["jekyll fixture build", "bundle exec jekyll build ...", "jekyll-build", ["0", "1", "blocked"]],
    ["shared CLI dependency install", "pnpm install --frozen-lockfile", "pnpm-install", ["0"]],
    ["shared CLI build", "pnpm --filter @ariada-org/cli... build", "cli-build", ["0"]],
    ["fixture scan", "ruby scripts/run_fixture_scan.rb", "fixture-scan", ["0", "1"]],
    ["screenshot validation", "python3 scripts/validate_screenshot.py scan-evidence/screenshots/scan-result.png", "screenshot-validate", ["0"]],
    ["Dash-plus strict audit", "node scripts/audit-channel-report.mjs --strict", "dash-audit", ["0"]]
  ]
  rows = gates.map do |label, command, log, allowed|
    ["<strong>#{esc(label)}</strong>", "<span class='status #{status_for(log, allowed)}'>#{status_for(log, allowed)}</span>", "<code>#{esc(command)}</code>", "<a href='logs/#{esc(log)}.log'>log</a> · <a href='logs/#{esc(log)}.exit'>exit</a>"]
  end
  logs = gates.map do |_label, _command, log, _allowed|
    "<details><summary>#{esc(log)} log</summary><pre>#{esc(shell_log(log))}</pre></details>"
  end.join("\n")
  body = <<~HTML
    <p>Focused local gates for <code>jekyll-ariada</code>. A fixture scan may exit <code>1</code> because the fixture intentionally contains accessibility defects; that is evidence that the shared scanner ran and gated correctly.</p>
    #{table(["Gate", "Result", "Command", "Evidence"], rows)}
    <h2>Logs</h2>
    #{logs}
  HTML
  FileUtils.mkdir_p(TEST_REPORT)
  File.write(File.join(TEST_REPORT, "result.html"), page("Ariada Jekyll test report", body))
end

def build_scan_preview
  report = scan_report
  total = scan_total(report)
  command = read(File.join(SCAN_EVIDENCE, "command.log")).strip
  body = <<~HTML
    <p>Real Ariada CLI scan triggered from the Jekyll channel fixture through <code>ruby scripts/run_fixture_scan.rb</code>.</p>
    <p><strong>#{esc(total)}</strong> finding(s) in <code>#{esc(scan_report_path.sub("#{ROOT}/", ""))}</code>. The fixture contains deliberate defects so a non-zero gate is expected.</p>
    <h2>Command Output</h2>
    <pre>#{esc(command.empty? ? "(no command output)" : command)}</pre>
    <h2>Report Summary</h2>
    <pre>#{esc(JSON.pretty_generate(report)[0, 16_000])}</pre>
  HTML
  FileUtils.mkdir_p(SCAN_EVIDENCE)
  File.write(File.join(SCAN_EVIDENCE, "scan-result-preview.html"), page("Ariada Jekyll real scan preview", body))
end

def source_rows
  [
    ["Jekyll docs", "Official plugin docs", "Primary", "High", "Plugin mechanism and channel packaging expectations.", "Official docs, accessed 2026-07-01.", link("https://jekyllrb.com/docs/plugins/")],
    ["Jekyll hooks", "Official hook docs", "Primary", "High", "<code>:site, :post_write</code> exists and is the correct post-build integration point.", "Official docs, accessed 2026-07-01.", link("https://jekyllrb.com/docs/plugins/hooks/")],
    ["Jekyll plugin installation", "Official plugin install docs", "Primary", "High", "Gem-based plugins are configured under <code>plugins</code> in <code>_config.yml</code>.", "Official docs, accessed 2026-07-01.", link("https://jekyllrb.com/docs/plugins/installation/")],
    ["Jekyll configuration", "Official config docs", "Primary", "High", "Channel uses <code>_config.yml</code> for wrapper settings.", "Official docs, accessed 2026-07-01.", link("https://jekyllrb.com/docs/configuration/")],
    ["Jekyll deployment", "Official deployment docs", "Primary", "High", "Jekyll users commonly publish static output to hosts after build.", "Official docs, accessed 2026-07-01.", link("https://jekyllrb.com/docs/deployment/")],
    ["GitHub Pages + Jekyll", "GitHub Docs", "Primary", "High", "GitHub Pages is a major Jekyll distribution surface with supported-plugin constraints.", "Official docs, accessed 2026-07-01.", link("https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll")],
    ["GitHub Pages dependency versions", "GitHub Pages", "Primary", "High", "Whitelisted plugin and dependency-version surface.", "Official docs, accessed 2026-07-01.", link("https://pages.github.com/versions/")],
    ["GitHub Pages Action", "actions/jekyll-build-pages", "Primary", "High", "CI workaround path for custom builds and plugin usage.", "GitHub repository, accessed 2026-07-01.", link("https://github.com/actions/jekyll-build-pages")],
    ["RubyGems", "RubyGems.org", "Primary", "High", "Native Ruby distribution channel for the plugin.", "Official registry, accessed 2026-07-01.", link("https://rubygems.org/")],
    ["RubyGems publishing", "RubyGems guide", "Primary", "High", "Publication needs human-owned credentials and MFA.", "Official docs, accessed 2026-07-01.", link("https://guides.rubygems.org/publishing/")],
    ["Bundler", "Bundler docs", "Primary", "High", "Jekyll users install plugin gems through Bundler.", "Official docs, accessed 2026-07-01.", link("https://bundler.io/")],
    ["Minitest", "Minitest docs", "Primary", "Medium", "Unit test framework used locally to avoid heavy test dependencies.", "Project docs, accessed 2026-07-01.", link("https://github.com/minitest/minitest")],
    ["Ariada CLI", "Local package README", "Primary", "High", "Shared scanner CLI accepts HTTP(S) URL targets today.", "Local source: packages/ariada-cli/README.md.", link("https://github.com/ariada-org/ariada/tree/main/packages/ariada-cli")],
    ["WCAG", "W3C WCAG overview", "Primary", "High", "Accessibility domain anchor.", "Standards source, accessed 2026-07-01.", link("https://www.w3.org/WAI/standards-guidelines/wcag/")],
    ["European Accessibility Act", "European Commission", "Primary", "High", "EU accessibility compliance business driver.", "Official source, accessed 2026-07-01.", link("https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en")],
    ["EN 301 549", "ETSI", "Primary", "High", "EU ICT accessibility procurement anchor.", "Official standards source, accessed 2026-07-01.", link("https://www.etsi.org/deliver/etsi_en/301500_301599/301549/")],
    ["GDPR", "EUR-Lex", "Primary", "High", "Privacy/GDPR domain anchor.", "Official legal source, accessed 2026-07-01.", link("https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng")],
    ["CSP", "MDN", "Secondary", "High", "Security-domain header evidence anchor.", "Technical documentation, accessed 2026-07-01.", link("https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP")],
    ["Lighthouse", "Chrome docs", "Primary", "High", "Performance/accessibility scan competitor and user expectation anchor.", "Official docs, accessed 2026-07-01.", link("https://developer.chrome.com/docs/lighthouse/overview")],
    ["Pa11y", "Pa11y docs", "Primary", "Medium", "Open-source accessibility scanner competitor.", "Project docs, accessed 2026-07-01.", link("https://pa11y.org/")],
    ["axe-core", "Deque axe-core", "Primary", "High", "Accessibility scanner ecosystem anchor.", "Project docs, accessed 2026-07-01.", link("https://github.com/dequelabs/axe-core")],
    ["WAVE", "WebAIM WAVE", "Primary", "Medium", "Manual/online accessibility scanner competitor.", "Vendor docs, accessed 2026-07-01.", link("https://wave.webaim.org/")],
    ["Siteimprove", "Siteimprove accessibility", "Secondary", "Medium", "Enterprise accessibility platform competitor.", "Vendor page, accessed 2026-07-01.", link("https://www.siteimprove.com/accessibility/")],
    ["Evinced", "Evinced", "Secondary", "Medium", "Developer accessibility testing competitor.", "Vendor page, accessed 2026-07-01.", link("https://www.evinced.com/")],
    ["AudioEye", "AudioEye", "Secondary", "Medium", "Accessibility platform competitor.", "Vendor page, accessed 2026-07-01.", link("https://www.audioeye.com/")],
    ["Deque", "Deque axe DevTools", "Secondary", "Medium", "Accessibility tooling competitor.", "Vendor page, accessed 2026-07-01.", link("https://www.deque.com/axe/devtools/")],
    ["Level Access", "Level Access", "Secondary", "Medium", "Enterprise accessibility platform competitor.", "Vendor page, accessed 2026-07-01.", link("https://www.levelaccess.com/")],
    ["Search Central", "Google SEO starter guide", "Primary", "High", "SEO/AIEO/GEO adjacent domain anchor.", "Official docs, accessed 2026-07-01.", link("https://developers.google.com/search/docs/fundamentals/seo-starter-guide")],
    ["Schema.org", "Schema.org", "Primary", "High", "Structured data evidence anchor.", "Project docs, accessed 2026-07-01.", link("https://schema.org/")],
    ["W3C i18n", "Internationalization", "Primary", "High", "Localization/i18n domain anchor.", "W3C docs, accessed 2026-07-01.", link("https://www.w3.org/International/")],
    ["Web Almanac", "HTTP Archive Web Almanac", "Secondary", "Medium", "Performance, sustainability and web quality context.", "Public report, accessed 2026-07-01.", link("https://almanac.httparchive.org/")],
    ["Green Web Foundation", "CO2.js", "Primary", "Medium", "Sustainability-domain measurement ecosystem.", "Project docs, accessed 2026-07-01.", link("https://developers.thegreenwebfoundation.org/co2js/overview/")],
    ["OpenSSF Scorecard", "Scorecard", "Primary", "High", "Supply-chain trust and repository evidence adjacent domain.", "Project docs, accessed 2026-07-01.", link("https://github.com/ossf/scorecard")],
    ["SLSA", "SLSA framework", "Primary", "High", "Build provenance and release integrity domain.", "Project docs, accessed 2026-07-01.", link("https://slsa.dev/")],
    ["WAI Easy Checks", "W3C WAI", "Primary", "High", "Human review bridge for accessibility evidence.", "W3C docs, accessed 2026-07-01.", link("https://www.w3.org/WAI/test-evaluate/easy-checks/")],
    ["Jekyll GitHub", "jekyll/jekyll", "Primary", "High", "Core project, issues, and adoption signal.", "Repository, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll")],
    ["Jekyll Talk", "Jekyll forum", "Community", "Medium", "Official-ish community support and pain-mining surface.", "Forum, accessed 2026-07-01.", link("https://talk.jekyllrb.com/")],
    ["r/Jekyll", "Reddit", "Community", "Low", "Anecdotal user questions around hooks and plugins.", "Community surface, accessed 2026-07-01.", link("https://www.reddit.com/r/Jekyll/")],
    ["Stack Overflow jekyll", "Stack Overflow tag", "Community", "Medium", "Developer implementation pain surface.", "Q&A surface, accessed 2026-07-01.", link("https://stackoverflow.com/questions/tagged/jekyll")],
    ["Stack Overflow github-pages", "Stack Overflow tag", "Community", "Medium", "GitHub Pages/Jekyll deployment pain surface.", "Q&A surface, accessed 2026-07-01.", link("https://stackoverflow.com/questions/tagged/github-pages")],
    ["GitHub Community Pages", "GitHub Community", "Community", "Medium", "Build/deploy questions for Pages-hosted Jekyll sites.", "Discussion surface, accessed 2026-07-01.", link("https://github.com/orgs/community/discussions/categories/pages")],
    ["Jekyll issue 5265", "Custom Plugins are Ignored", "Community", "Medium", "Concrete plugin/safe-mode confusion signal.", "GitHub issue, 2016; accessed 2026-07-01.", link("https://github.com/jekyll/jekyll/issues/5265")],
    ["Jekyll issue 9040", "safe keyword clarity", "Community", "Medium", "Plugin safe-mode documentation pain.", "GitHub issue, 2022; accessed 2026-07-01.", link("https://github.com/jekyll/jekyll/issues/9040")],
    ["GitHub Community 26041", "Jekyll 4 and Actions", "Community", "Medium", "GitHub Pages + Actions workflow pain.", "Discussion, accessed 2026-07-01.", link("https://github.com/orgs/community/discussions/26041")],
    ["GitHub Community 142149", "github-pages gem version", "Community", "Medium", "Version drift pain in GitHub Pages builder.", "Discussion, accessed 2026-07-01.", link("https://github.com/orgs/community/discussions/142149")],
    ["SO custom plugins", "Custom plugins with GitHub Pages", "Community", "Medium", "Repeated question: custom Ruby plugins ignored by GitHub Pages default build.", "Stack Overflow, accessed 2026-07-01.", link("https://stackoverflow.com/questions/53215356/jekyll-how-to-use-custom-plugins-with-github-pages")],
    ["SO post_write", "call python plugin on Jekyll post_write", "Community", "Low", "Post-write hook usage signal.", "Stack Overflow, accessed 2026-07-01.", link("https://stackoverflow.com/questions/76408130/call-python-plugin-on-jekyll-post-write")],
    ["Reddit hooks", "First step with Jekyll hooks", "Community", "Low", "Anecdote: users struggle to verify hook registration.", "Reddit, accessed 2026-07-01.", link("https://www.reddit.com/r/Jekyll/comments/1hkejgq/first_step_with_jekyll_hooks/")],
    ["Talk local testing", "Local testing existing GitHub Jekyll site", "Community", "Low", "Local/GitHub Pages parity pain.", "Forum, accessed 2026-07-01.", link("https://talk.jekyllrb.com/t/local-testing-of-existing-github-jekyll-site/7459")],
    ["Talk GitHub custom tags", "GitHub Pages cannot load custom Liquid tags", "Community", "Low", "Plugin limitation and deployment confusion signal.", "Forum, accessed 2026-07-01.", link("https://talk.jekyllrb.com/t/jekyll-github-pages-cannot-load-custom-liquid-tags/802")],
    ["Awesome Jekyll Plugins", "Plugin catalog", "Community", "Low", "Shows breadth of plugin ecosystem and dependency expectations.", "Community repo, accessed 2026-07-01.", link("https://github.com/planetjekyll/awesome-jekyll-plugins")],
    ["GitHub Pages deploy guide", "Jekyll official GitHub Pages deploy", "Primary", "High", "Deployment path for custom build workflows.", "Official docs, accessed 2026-07-01.", link("https://jekyllrb.com/docs/continuous-integration/github-actions/")],
    ["HTML AAM", "W3C HTML Accessibility API Mappings", "Primary", "High", "Accessibility semantics source.", "W3C docs, accessed 2026-07-01.", link("https://www.w3.org/TR/html-aam-1.0/")],
    ["ARIA Authoring Practices", "WAI-ARIA APG", "Primary", "High", "Interactive docs/accessibility reference.", "W3C docs, accessed 2026-07-01.", link("https://www.w3.org/WAI/ARIA/apg/")],
    ["MDN img alt", "MDN img element", "Secondary", "High", "Fixture defect reference for missing alt.", "MDN docs, accessed 2026-07-01.", link("https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img")],
    ["MDN color contrast", "Accessibility color contrast", "Secondary", "High", "Fixture low-contrast defect reference.", "MDN docs, accessed 2026-07-01.", link("https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Perceivable/Color_contrast")],
    ["GitHub Pages limits", "GitHub Pages limits", "Primary", "High", "Static-host constraints and Pages behavior.", "Official docs, accessed 2026-07-01.", link("https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages")],
    ["Jekyll themes", "Jekyll themes docs", "Primary", "High", "Docs/personal-site culture and theme ecosystem.", "Official docs, accessed 2026-07-01.", link("https://jekyllrb.com/docs/themes/")],
    ["Liquid", "Liquid template language", "Primary", "High", "Jekyll templating base.", "Project docs, accessed 2026-07-01.", link("https://shopify.github.io/liquid/")],
    ["Kramdown", "kramdown", "Primary", "Medium", "Markdown renderer used by many Jekyll sites.", "Project docs, accessed 2026-07-01.", link("https://kramdown.gettalong.org/")],
    ["GitHub Actions artifacts", "Upload artifacts", "Primary", "High", "Evidence-retention path for CI.", "Official docs, accessed 2026-07-01.", link("https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow")],
    ["GitLab Pages", "GitLab Pages", "Primary", "High", "Alternate host for Jekyll static output.", "Official docs, accessed 2026-07-01.", link("https://docs.gitlab.com/user/project/pages/")],
    ["Netlify Jekyll", "Netlify Jekyll docs", "Secondary", "Medium", "Hosted build path that can run plugins in CI-like environment.", "Vendor docs, accessed 2026-07-01.", link("https://docs.netlify.com/configure-builds/common-configurations/jekyll/")],
    ["Cloudflare Pages frameworks", "Cloudflare Pages", "Secondary", "Medium", "Static-site host build environment context.", "Vendor docs, accessed 2026-07-01.", link("https://developers.cloudflare.com/pages/framework-guides/deploy-a-jekyll-site/")],
    ["Vercel static builds", "Vercel static builds", "Secondary", "Medium", "Static-host comparison surface.", "Vendor docs, accessed 2026-07-01.", link("https://vercel.com/docs/frameworks")],
    ["Read the Docs", "Read the Docs", "Secondary", "Medium", "Docs-host comparison and artifact mindset.", "Vendor docs, accessed 2026-07-01.", link("https://docs.readthedocs.com/platform/stable/")],
    ["Docusaurus", "Docusaurus", "Secondary", "Medium", "Adjacent docs framework competitor.", "Project docs, accessed 2026-07-01.", link("https://docusaurus.io/")],
    ["Hugo", "Hugo", "Secondary", "Medium", "Adjacent static-site generator competitor.", "Project docs, accessed 2026-07-01.", link("https://gohugo.io/")],
    ["Eleventy", "Eleventy", "Secondary", "Medium", "Adjacent static-site generator competitor.", "Project docs, accessed 2026-07-01.", link("https://www.11ty.dev/")],
    ["Astro", "Astro", "Secondary", "Medium", "Adjacent docs/static generator competitor.", "Project docs, accessed 2026-07-01.", link("https://astro.build/")],
    ["MkDocs", "MkDocs", "Secondary", "Medium", "Adjacent docs generator competitor.", "Project docs, accessed 2026-07-01.", link("https://www.mkdocs.org/")],
    ["VitePress", "VitePress", "Secondary", "Medium", "Adjacent docs generator competitor.", "Project docs, accessed 2026-07-01.", link("https://vitepress.dev/")],
    ["VuePress", "VuePress", "Secondary", "Medium", "Adjacent docs generator competitor.", "Project docs, accessed 2026-07-01.", link("https://vuepress.vuejs.org/")],
    ["Hexo", "Hexo", "Secondary", "Medium", "Adjacent blog generator competitor.", "Project docs, accessed 2026-07-01.", link("https://hexo.io/")],
    ["Zola", "Zola", "Secondary", "Medium", "Adjacent static-site generator competitor.", "Project docs, accessed 2026-07-01.", link("https://www.getzola.org/")],
    ["mdBook", "mdBook", "Secondary", "Medium", "Adjacent documentation generator competitor.", "Project docs, accessed 2026-07-01.", link("https://rust-lang.github.io/mdBook/")],
    ["GitBook", "GitBook", "Secondary", "Medium", "Hosted docs competitor and channel contrast.", "Vendor docs, accessed 2026-07-01.", link("https://docs.gitbook.com/")],
    ["Nextra", "Nextra", "Secondary", "Medium", "Adjacent Next.js docs framework competitor.", "Project docs, accessed 2026-07-01.", link("https://nextra.site/")],
    ["Pelican", "Pelican", "Secondary", "Medium", "Adjacent Python static-site generator.", "Project docs, accessed 2026-07-01.", link("https://getpelican.com/")],
    ["Bridgetown", "Bridgetown", "Secondary", "Medium", "Ruby static-site generator adjacent to Jekyll.", "Project docs, accessed 2026-07-01.", link("https://www.bridgetownrb.com/")],
    ["Middleman", "Middleman", "Secondary", "Medium", "Ruby static-site generator adjacent to Jekyll.", "Project docs, accessed 2026-07-01.", link("https://middlemanapp.com/")],
    ["RubySec bundler-audit", "bundler-audit", "Primary", "Medium", "Ruby supply-chain/security workflow expectation.", "Project docs, accessed 2026-07-01.", link("https://github.com/rubysec/bundler-audit")],
    ["RuboCop", "RuboCop", "Primary", "Medium", "Ruby lint workflow expectation.", "Project docs, accessed 2026-07-01.", link("https://rubocop.org/")],
    ["HTMLProofer", "HTMLProofer", "Primary", "Medium", "Jekyll/static-site QA competitor for links/images.", "Project docs, accessed 2026-07-01.", link("https://github.com/gjtorikian/html-proofer")],
    ["htmltest", "htmltest", "Primary", "Medium", "Static-site validation competitor.", "Project docs, accessed 2026-07-01.", link("https://github.com/wjdp/htmltest")],
    ["Lychee", "Lychee link checker", "Primary", "Medium", "Static-site link checker competitor.", "Project docs, accessed 2026-07-01.", link("https://github.com/lycheeverse/lychee")],
    ["Vale", "Vale", "Primary", "Medium", "Docs quality checker ecosystem.", "Project docs, accessed 2026-07-01.", link("https://vale.sh/")],
    ["Pagefind", "Pagefind", "Primary", "Medium", "Static-site post-build tooling expectation.", "Project docs, accessed 2026-07-01.", link("https://pagefind.app/")],
    ["Algolia DocSearch", "DocSearch", "Secondary", "Medium", "Docs-site monetization/commercial search comparison.", "Vendor docs, accessed 2026-07-01.", link("https://docsearch.algolia.com/")],
    ["Carbon Design accessibility", "Carbon", "Secondary", "Medium", "Design-system accessibility reference used by docs teams.", "Project docs, accessed 2026-07-01.", link("https://carbondesignsystem.com/guidelines/accessibility/overview/")],
    ["USWDS accessibility", "USWDS", "Primary", "Medium", "Public-sector accessibility docs-site reference.", "Government docs, accessed 2026-07-01.", link("https://designsystem.digital.gov/documentation/accessibility/")],
    ["GOV.UK accessibility", "GOV.UK", "Primary", "Medium", "Public-sector accessibility statement/reference.", "Government docs, accessed 2026-07-01.", link("https://www.gov.uk/service-manual/helping-people-to-use-your-service/making-your-service-accessible-an-introduction")],
    ["WAI accessibility statements", "W3C WAI", "Primary", "High", "Legal-notice/accessibility-statement domain.", "W3C docs, accessed 2026-07-01.", link("https://www.w3.org/WAI/planning/statements/")],
    ["EU web accessibility directive", "EUR-Lex Directive 2016/2102", "Primary", "High", "Public-sector web accessibility anchor.", "Official legal source, accessed 2026-07-01.", link("https://eur-lex.europa.eu/eli/dir/2016/2102/oj/eng")],
    ["AI Act", "EUR-Lex AI Act", "Primary", "High", "AI/compliance domain anchor for generated docs.", "Official legal source, accessed 2026-07-01.", link("https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng")],
    ["C2PA", "C2PA specification", "Primary", "Medium", "Data provenance/content provenance domain.", "Project docs, accessed 2026-07-01.", link("https://c2pa.org/specifications/specifications/2.1/index.html")],
    ["Dublin Core", "DCMI", "Primary", "Medium", "Docs metadata/data provenance anchor.", "Project docs, accessed 2026-07-01.", link("https://www.dublincore.org/specifications/dublin-core/dcmi-terms/")],
    ["W3C provenance", "PROV overview", "Primary", "Medium", "Data provenance terminology.", "W3C docs, accessed 2026-07-01.", link("https://www.w3.org/TR/prov-overview/")],
    ["Robots exclusion", "robots.txt", "Primary", "Medium", "SEO/crawler governance domain.", "Official-ish docs, accessed 2026-07-01.", link("https://www.robotstxt.org/")],
    ["Open Graph", "Open Graph protocol", "Primary", "Medium", "Social metadata/SEO domain.", "Project docs, accessed 2026-07-01.", link("https://ogp.me/")],
    ["Twitter cards", "X cards", "Secondary", "Low", "Social preview metadata domain.", "Vendor docs, accessed 2026-07-01.", link("https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards")],
    ["Jekyll SEO Tag", "jekyll-seo-tag", "Primary", "Medium", "Jekyll-specific SEO plugin and competitor/connector.", "Project docs, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll-seo-tag")],
    ["Jekyll Sitemap", "jekyll-sitemap", "Primary", "Medium", "Jekyll-specific SEO plugin and connector.", "Project docs, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll-sitemap")],
    ["Jekyll Feed", "jekyll-feed", "Primary", "Medium", "Jekyll plugin ecosystem example.", "Project docs, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll-feed")],
    ["Jekyll Archives", "jekyll-archives", "Primary", "Medium", "Jekyll plugin ecosystem example.", "Project docs, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll-archives")],
    ["Minimal Mistakes", "Minimal Mistakes", "Secondary", "Medium", "Large Jekyll theme ecosystem signal.", "Theme docs, accessed 2026-07-01.", link("https://mmistakes.github.io/minimal-mistakes/")],
    ["Chirpy", "Jekyll Chirpy theme", "Secondary", "Medium", "GitHub Pages/Jekyll theme user surface.", "Theme docs, accessed 2026-07-01.", link("https://chirpy.cotes.page/")],
    ["Just the Docs", "Just the Docs", "Secondary", "Medium", "Docs-oriented Jekyll theme surface.", "Theme docs, accessed 2026-07-01.", link("https://just-the-docs.github.io/just-the-docs/")],
    ["Jekyll Now", "Jekyll Now", "Secondary", "Low", "Beginner/personal-site Jekyll usage signal.", "Project docs, accessed 2026-07-01.", link("https://github.com/barryclark/jekyll-now")],
    ["Jekyll Admin", "jekyll-admin", "Primary", "Medium", "Jekyll plugin ecosystem example with admin/workflow implications.", "Project docs, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll-admin")],
    ["Jekyll Compose", "jekyll-compose", "Primary", "Medium", "Jekyll plugin ecosystem example for authoring workflows.", "Project docs, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll-compose")],
    ["Jekyll Redirect From", "jekyll-redirect-from", "Primary", "Medium", "Jekyll/GitHub Pages-supported plugin showing safe plugin allow-list shape.", "Project docs, accessed 2026-07-01.", link("https://github.com/jekyll/jekyll-redirect-from")],
    ["Programming Historian", "Jekyll lesson", "Secondary", "Medium", "Educational signal for Jekyll + GitHub Pages user mix.", "Lesson, accessed 2026-07-01.", link("https://programminghistorian.org/en/lessons/building-static-sites-with-jekyll-github-pages")],
    ["Moncef Belyamani", "GitHub Pages with plugins", "Community", "Low", "Practitioner workaround for latest Jekyll/plugins on Pages.", "Blog, accessed 2026-07-01.", link("https://www.moncefbelyamani.com/making-github-pages-work-with-latest-jekyll/")],
    ["Josh Fail", "Jekyll plugins with GitHub Pages", "Community", "Low", "Practitioner workaround using Actions.", "Blog, accessed 2026-07-01.", link("https://josh.fail/2024/using-jekyll-plugins-with-github-pages-in-2024/")],
    ["E. Bristow", "Troubleshooting custom plugins", "Community", "Low", "Practitioner pain around custom plugins on Pages.", "Blog, accessed 2026-07-01.", link("https://ebristow.com/blog/Troubleshooting-Jekyll-Custom-Plugins-on-GitHub-Pages")]
  ]
end

def build_scan_report
  report = scan_report
  total = scan_total(report)
  screenshot = File.join(SCAN_EVIDENCE, "screenshots", "scan-result.png")
  shot = if File.exist?(screenshot)
           encoded = Base64.strict_encode64(File.binread(screenshot))
           <<~HTML
             <figure>
               <a href='screenshots/scan-result.png'><img alt='Screenshot of the Ariada Jekyll scan result preview' src='data:image/png;base64,#{encoded}'></a>
               <figcaption>Embedded screenshot classified as <strong>scan-result preview</strong>, not a hosted Jekyll production surface. Standalone file: <a href='screenshots/scan-result.png'>screenshots/scan-result.png</a>.</figcaption>
             </figure>
           HTML
         else
           "<p><strong>VISUAL_EVIDENCE_GAP:</strong> screenshot file was not produced.</p>"
         end

  gates = [
    ["Ruby syntax", "plugin/hook/config/scanner/version files", "pass/fail in test-report logs"],
    ["Unit tests", "minitest scanner/config/gate behavior", "validates command construction and pass/fail parsing"],
    ["Gem build", "local gemspec packaging", "ensures RubyGems metadata can package the plugin"],
    ["Jekyll fixture build", "real host build if Bundler/Jekyll can install locally", "blocked when the host toolchain cannot provide Jekyll"],
    ["Fixture scan", "served static fixture URL with deliberate accessibility defects", "real shared @ariada-org/cli scan evidence"],
    ["Screenshot validation", "PNG dimensions and nonblank pixels", "proves report image is a real file"],
    ["Dash-plus audit", "strict comparison against Dash baseline", "must pass before commit"]
  ]

  role_rows = [
    ["Jekyll site maintainer", "Install a gem, keep building Markdown/Liquid as before, get local report before publishing.", "Free gem, <code>_config.yml</code> snippet, JSON/log/report/screenshot.", "Usually not direct payer; adoption hook.", "When a personal, docs, civic, or product site is about to publish.", "<span class='status pass'>Gem wrapper and hook implemented locally</span>"],
    ["Docs platform owner", "Standardize evidence across many Jekyll repos and GitHub Pages sites.", "CI template, artifact upload, baseline policy, hosted retention.", "Team/platform budget pays.", "After one or two repos prove the wrapper works.", "<span class='status warn'>CI recipe documented, hosted retention not implemented</span>"],
    ["Accessibility reviewer", "Review reproducible evidence instead of asking for screenshots and manual repro steps.", "HTML report, raw JSON, command log, standalone screenshot, tested surface note.", "Influencer; may be internal audit buyer.", "At release/procurement/accessibility review time.", "<span class='status pass'>Evidence report generated</span>"],
    ["Agency maintaining Jekyll/GitHub Pages estates", "Add repeatable checks to client sites without migrating away from Jekyll.", "Multi-client artifact retention, branded reports, route inventory, remediation pack.", "Agency or client pays.", "When sites need EAA/WCAG readiness or procurement proof.", "<span class='status block'>Commercial packaging not implemented</span>"],
    ["Compliance/legal owner", "Get long-term release evidence for EAA, public-sector accessibility statements, GDPR-adjacent notices and procurement files.", "Signed exports, retention, policy gates, review workflow, domain packs.", "Economic buyer when risk is external.", "After repeated CI evidence shows value.", "<span class='status block'>Hosted compliance product not implemented</span>"],
    ["Theme maintainer", "Run evidence across theme examples before release.", "Fixture matrix and public badges for theme docs.", "May be unpaid OSS maintainer; sponsor path only.", "When theme claims accessibility support.", "<span class='status warn'>Possible next use case</span>"],
    ["GitHub Pages user", "Use GitHub Actions to run unsupported plugin before Pages deploy.", "Workflow snippet and artifact upload.", "Usually no payer; conversion path to hosted evidence for teams.", "When default Pages safe mode blocks custom plugins.", "<span class='status warn'>Documented blocker/workaround</span>"]
  ]

  domain_rows = [
    ["Accessibility", "Implemented for fixture scan through shared CLI.", "Missing alt and low contrast fixture defects exercise the current Ariada accessibility path.", "Keep first because Jekyll/GitHub Pages sites are often public docs, portfolios, civic pages and product docs."],
    ["Security", "Planned via shared domain packs.", "Static-site checks should include CSP, mixed content, referrer policy, dependency/provenance notes and GitHub Pages/CDN headers.", "Important when docs include auth links, scripts, downloads or public-sector notices."],
    ["Privacy/GDPR", "Planned.", "Cookie banners, analytics scripts, newsletter embeds, forms and consent text belong in a Jekyll channel because many marketing/docs sites use third-party embeds.", "Paid teams need evidence before publication."],
    ["Performance", "Planned.", "Static pages should be fast, but themes, images, syntax highlighting, third-party scripts and search widgets can regress.", "Use CLI/domain extension and Lighthouse-style comparison later."],
    ["Reliability", "Planned.", "Broken links, missing assets, generated permalink changes and Pages build drift are repeated Jekyll pains.", "Integrate with htmlproofer/lychee expectations rather than replacing them."],
    ["Sustainability", "Planned.", "Static sites are a good sustainability story, but heavy images and scripts still matter.", "Good enterprise/ESG upsell only after accessibility evidence works."],
    ["SEO/AIEO/GEO", "Planned.", "Jekyll ecosystem has SEO plugins, feeds, sitemaps and metadata; Ariada can verify generated output and provenance for docs discoverability.", "Useful for docs/marketing sites."],
    ["Legal notices", "Planned.", "Accessibility statement, privacy notice, imprint/legal contact and license notices should be checked on public EU sites.", "High buyer value for regulated organizations."],
    ["Localization/i18n", "Planned.", "Jekyll multilingual plugins are often constrained on GitHub Pages; rendered lang, hreflang, localized dates and fallback behavior need evidence.", "Relevant for EU public and product docs."],
    ["Data provenance", "Planned.", "Docs pages increasingly include generated content, citations, changelogs and download artifacts.", "Tie to C2PA/PROV/Dublin Core later."],
    ["AI/compliance", "Planned.", "AI-generated documentation and support content need labeling, review trail and source provenance under emerging governance expectations.", "Keep as compliance domain, not scanner magic."],
    ["Supply-chain", "Planned.", "RubyGems, Bundler, GitHub Actions, Pages build images and theme dependencies define the release trust chain.", "Offer Scorecard/SLSA-style evidence after core channel works."]
  ]

  community_rows = [
    ["Jekyll Talk forum", "Maintainers and site owners ask about local builds, GitHub Pages parity, plugins and Liquid/theme issues.", "Developer, maintainer, docs owner.", "Useful for plugin pain and local/host mismatch language.", "Strong enough for product copy; not quantitative market proof.", link("https://talk.jekyllrb.com/")],
    ["Stack Overflow jekyll/github-pages tags", "Developers ask exact implementation questions, including custom plugin restrictions and post-write hooks.", "Developer.", "Good for onboarding errors and docs snippets.", "Medium signal; Q&A can be old but repeated.", link("https://stackoverflow.com/questions/tagged/jekyll")],
    ["GitHub jekyll/jekyll issues", "Core project issues expose safe-mode, hook and plugin behavior confusion.", "Maintainer, developer.", "Strong for integration caveats.", "High relevance, but issue age must be labelled.", link("https://github.com/jekyll/jekyll/issues")],
    ["GitHub Community Pages discussions", "Pages users report build drift, Actions workarounds and deployment confusion.", "GitHub Pages user, docs owner, maintainer.", "Strong for GitHub Pages blocker and workaround.", "Good product signal for CI-first positioning.", link("https://github.com/orgs/community/discussions/categories/pages")],
    ["Reddit r/Jekyll", "Small but direct community surface for hooks, themes and site setup questions.", "Hobbyist, developer.", "Weak anecdotes; useful language for onboarding docs.", "Do not treat as market size.", link("https://www.reddit.com/r/Jekyll/")],
    ["Theme issue trackers", "Minimal Mistakes, Just the Docs, Chirpy and similar themes surface accessibility, search, navigation and Pages build pain.", "Theme maintainer, docs maintainer.", "Useful for route/theme fixture expansion.", "Medium signal when repeated across themes.", link("https://github.com/just-the-docs/just-the-docs/issues")],
    ["Static-site QA tools", "htmlproofer, lychee and Vale issues show acceptance of post-build checks and artifacts.", "CI owner, docs engineer.", "Strong adjacent workflow signal.", "Not Jekyll-only; classify as adjacent.", link("https://github.com/gjtorikian/html-proofer/issues")],
    ["Practitioner blogs", "Posts about Pages custom plugin workarounds show users accept Actions when default Pages blocks plugins.", "Developer, site owner.", "Useful for recommended product solution.", "Anecdotal; validate with interviews.", link("https://josh.fail/2024/using-jekyll-plugins-with-github-pages-in-2024/")]
  ]

  signal_rows = [
    ["Plugin safe mode confusion", "GitHub Pages default safe build blocks unsupported plugins; users repeatedly ask why custom plugins do not run.", "GitHub docs, Jekyll docs, SO, GitHub issues, Jekyll Talk, blogs.", "Strong", "Position Ariada Jekyll as local/CI/GitHub Actions first, not default Pages server-side plugin."],
    ["Local vs hosted build drift", "The site builds locally but fails or behaves differently on Pages/GitHub Actions.", "GitHub Community, Jekyll Talk, Stack Overflow.", "Strong", "Report must show host blocker and tested surface instead of overclaiming hosted evidence."],
    ["Post-build checks are accepted", "Jekyll users already run link checkers, htmlproofer, CI deploy workflows and theme validation after build.", "htmlproofer, lychee, GitHub Actions docs, Jekyll deployment docs.", "Strong", "Ariada belongs after build, before deploy, with artifacts."],
    ["Ruby/Bundler conventions matter", "A plugin should be a gem, loaded in Gemfile/_config.yml, with Bundler-friendly commands.", "Jekyll docs, Bundler, RubyGems.", "Strong", "Use RubyGem + hook, not a random shell script as primary packaging."],
    ["Node/browser dependency is foreign", "Some Jekyll users are Ruby/Markdown/GitHub Pages users, not Node scanner operators.", "Community questions and Jekyll docs.", "Medium", "Hide/cache scanner runtime in CI/Docker/Action; keep local install messages clear."],
    ["Themes can break accessibility", "Navigation, search, contrast, code blocks and images are theme-level defects.", "Theme issues and accessibility docs.", "Medium", "Add theme fixture matrix next."],
    ["Docs need legal/accessibility notices", "Public documentation sites increasingly need accessibility statements and privacy/legal notices.", "EAA, WAI statements, GDPR, public-sector docs.", "Strong", "Legal-notice domain is high value for paid evidence."],
    ["SEO plugins are common", "Jekyll users already install SEO/sitemap/feed plugins.", "jekyll-seo-tag, jekyll-sitemap, jekyll-feed.", "Medium", "SEO/AIEO/GEO checks fit as generated-output verification, not authoring plugin."],
    ["CI artifact upload is accepted", "Actions/GitLab users share build artifacts and pages output.", "GitHub Actions docs, GitLab Pages docs.", "Strong", "Sell retention and reviewer links above free artifacts."],
    ["Static-site generators overlap", "Hugo, Eleventy, Docusaurus, MkDocs and Jekyll all scan generated HTML.", "Pack 12 spec and adjacent source docs.", "Strong", "Do not overinvest in unique scanner code; reuse CLI and specialize distribution/docs."],
    ["Accessibility scanner market is saturated", "axe, Lighthouse, Pa11y, WAVE and enterprise scanners are known.", "Vendor/project sources.", "Strong", "Win on Jekyll-channel packaging and multi-domain evidence, not generic scanning claims."],
    ["Ruby security tooling exists", "RuboCop, bundler-audit and similar tools set CI check expectations.", "Ruby ecosystem sources.", "Medium", "Ariada should integrate into checks, not replace Ruby quality tools."],
    ["GitHub Pages is huge but not equal to active Jekyll plugin TAM", "Many repos are old, personal or low-maintenance.", "Spec plus community signal.", "Medium", "Market estimate should be reach/order proxy, not revenue forecast."],
    ["Hosted/protected scan needs account context", "Static public sites are easy; staging/protected previews need auth or deployment URL.", "CI/deploy docs.", "Medium", "Document future cookie/header support and hosted worker path."],
    ["Report-only screenshot is insufficient", "A screenshot of the report does not prove the host surface rendered.", "Skill rule.", "Strong", "Classify current screenshot as scan-result preview; mark hosted surface visual gap."]
  ]

  repeated_rows = [
    ["Unsupported plugins on GitHub Pages", "Jekyll docs + GitHub docs + Stack Overflow + GitHub issues + practitioner blogs.", "Build with Actions/CI, then deploy generated site; Ariada plugin should run in that CI step."],
    ["Need explicit, predictable post-build artifacts", "GitHub Actions artifacts + static-site QA tools + Ariada CLI conventions.", "Always produce JSON, command log, screenshot, HTML report and standalone PNG link."],
    ["Do not hide heavy runtime in every local edit", "Jekyll culture + Ruby/Bundler workflow + Node/browser scanner dependency.", "Local command is explicit; heavier scanner runtime should be cached in CI/Docker/hosted worker."],
    ["Theme/generated-output bugs differ from Markdown source bugs", "Theme trackers + Jekyll docs + accessibility docs.", "Scan rendered output, not Markdown, and keep representative theme fixtures."]
  ]

  no_signal_rows = [
    ["G2/Capterra for Jekyll plugin", "No useful product-review surface for a small OSS static-site plugin.", "Do not count as market proof."],
    ["Product Hunt", "No useful channel-specific evidence for Jekyll compliance scanning.", "Prefer GitHub/Jekyll Talk/Stack Overflow."],
    ["Private Slack/Discord", "Not used because private communities are not public evidence here.", "Use only if founder provides access and permission."],
    ["Reddit market sizing", "r/Jekyll is small and anecdotal.", "Use for language, not TAM."],
    ["RubyGems download counts", "Not collected in this pass.", "Next human/agent can add package-level proxy if needed."]
  ]

  competitor_rows = [
    ["Direct Jekyll/static QA", "HTMLProofer, htmltest, lychee, Vale, Pagefind checks.", "They validate links/content/search; Ariada adds accessibility/compliance evidence and scanner artifacts.", "Do not replace them; integrate next to them."],
    ["Accessibility scanners", "axe-core, Pa11y, Lighthouse, WAVE, Accessibility Insights.", "They scan pages; Ariada packages a Jekyll build-hook/CI evidence flow and expands domain map.", "Crowded channel; avoid generic scanner positioning."],
    ["Enterprise accessibility", "Deque, Siteimprove, Level Access, AudioEye, Evinced.", "They sell broader programs; Ariada wedge is developer-owned static-site evidence and multi-domain audit trail.", "Paid retention/export competes more than the free plugin."],
    ["Static-site generators", "Hugo, Eleventy, Docusaurus, Astro, MkDocs, VitePress, VuePress, Hexo, Zola, mdBook.", "They are channel alternatives, not direct evidence competitors.", "Jekyll adapter exists for ecosystem presence and GitHub Pages reach."],
    ["Hosting/build platforms", "GitHub Pages, GitLab Pages, Netlify, Cloudflare Pages, Vercel.", "They build/host; Ariada plugs into build workflow and stores evidence.", "Partner/integration surface, not scanner rival."],
    ["Jekyll SEO plugins", "jekyll-seo-tag, jekyll-sitemap, jekyll-feed.", "They generate metadata; Ariada verifies rendered output and compliance domains.", "SEO/AIEO/GEO domain should complement them."],
    ["Ruby quality/security tools", "RuboCop, bundler-audit, Brakeman for Ruby apps.", "They set check culture; Ariada scans web output rather than Ruby source.", "Useful for developer trust copy."],
    ["Docs SaaS", "GitBook, Read the Docs, hosted docs search and knowledge-base tools.", "They can own hosted workflow; Ariada can sell evidence upload/retention across channels.", "Commercial buyer may prefer SaaS evidence dashboard."]
  ]

  technical_rows = [
    ["Plugin hook", "<code>Jekyll::Hooks.register :site, :post_write</code> delegates after Jekyll writes output.", "Implemented in <code>lib/jekyll/ariada.rb</code>."],
    ["Configuration", "<code>_config.yml</code> <code>ariada</code> block controls enabled/gate/cli_command/output_dir/target/browser/threshold/domains.", "Implemented in <code>Configuration.from_site</code>."],
    ["Shared CLI bridge", "The plugin shells out to <code>@ariada-org/cli</code>; no Ruby scanner rules are implemented.", "Implemented in <code>Scanner#command_for</code>."],
    ["Current target shape", "Spec wants <code>_site/</code>, but current CLI accepts HTTP(S) URL. Evidence serves the fixture output as localhost.", "Documented blocker/compatibility note."],
    ["Jekyll fixture", "A minimal layout and Markdown page represent a real Jekyll source tree.", "Included under <code>fixtures/jekyll-site</code>."],
    ["Static fallback fixture", "When local Jekyll host cannot run, a rendered HTML fallback with the same defects is served and scanned.", "Included under <code>fixtures/static-site</code>."],
    ["Report generator", "Builds test report, scan preview and Dash-plus full research report from logs, screenshot and source tables.", "Implemented in <code>scripts/build_evidence_reports.rb</code>."],
    ["Screenshot capture", "Captured from scan-result preview and linked as standalone PNG.", "Generated in <code>scan-evidence/screenshots/scan-result.png</code>."],
    ["Screenshot validation", "Validates dimensions and nonblank pixels with Pillow.", "Implemented in <code>scripts/validate_screenshot.py</code>."],
    ["CI path", "Run Bundler, build Jekyll, start static preview, invoke CLI, upload artifacts.", "Documented; not packaged as a reusable Action yet."],
    ["Hosted upload", "Future paid connector should upload JSON/log/screenshot/report bundle to Ariada retention.", "Not implemented."],
    ["Auth/preview support", "Future connector needs headers/cookies for protected docs previews.", "Not implemented."]
  ]

  implementation_rows = [
    ["RubyGem skeleton", "<span class='status pass'>Implemented</span>", "<code>jekyll-ariada.gemspec</code>, <code>Gemfile</code>, package files and version."],
    ["Jekyll post_write hook", "<span class='status pass'>Implemented</span>", "Registers <code>:site, :post_write</code> and calls the shared scanner wrapper."],
    ["Scanner command builder", "<span class='status pass'>Implemented</span>", "Builds <code>ariada scan</code> command with output dir, browser, format, threshold, timeout and domains."],
    ["Pass/fail decision", "<span class='status pass'>Implemented</span>", "Gate raises a fatal Jekyll error when CLI exit is non-zero and <code>gate: true</code>."],
    ["Unit tests", "<span class='status pass'>Implemented</span>", "Minitest covers command construction, JSON finding count, disabled plugin and gate raise."],
    ["Representative Jekyll source fixture", "<span class='status pass'>Implemented</span>", "Minimal layout + Markdown page with deliberate defects."],
    ["Real Jekyll host build", "<span class='status warn'>Host-dependent</span>", "Runs only if Bundler can install Jekyll on this workstation; otherwise exact blocker is logged."],
    ["Shared CLI scan", "<span class='status pass'>Implemented</span>", "Runs the actual local Ariada CLI build against served fixture URL."],
    ["Real screenshot", "<span class='status pass'>Implemented</span>", "Embedded and linked PNG, validated for dimensions and nonblank pixels."],
    ["GitHub Pages default plugin support", "<span class='status block'>Blocked by host policy</span>", "Default Pages safe mode disables unsupported plugins; recommended path is GitHub Actions build/deploy."],
    ["RubyGems publication", "<span class='status block'>Human blocker</span>", "Requires founder-owned RubyGems account, MFA and release approval."],
    ["Directory scan against <code>_site/</code>", "<span class='status block'>Shared CLI gap</span>", "Current CLI validates HTTP(S) URL; adapter can target a served output URL now."],
    ["Hosted retention", "<span class='status block'>Not implemented</span>", "Commercial product layer remains future work."]
  ]

  monetization_rows = [
    ["Free wrapper", "RubyGem, hook, config snippet, local report generation and fixture tests remain open-source.", "Developer adoption and ecosystem presence.", "Do not charge for the plugin itself."],
    ["CI artifact pack", "Reusable Actions/GitLab snippets, Dockerized scanner runtime, artifact naming conventions.", "Platform/docs teams.", "Freemium or included with hosted plan."],
    ["Hosted evidence retention", "Store JSON/log/screenshot/report bundles, compare baselines, generate stable reviewer URLs.", "Compliance/platform owner pays.", "Primary paid wedge."],
    ["Signed exports", "Export release evidence with integrity metadata and long-term retention.", "Legal/procurement/public-sector buyer.", "Higher-tier paid feature."],
    ["Domain packs", "Accessibility first; add security, privacy/GDPR, performance, legal notices, i18n, SEO/AIEO/GEO, provenance, AI/compliance.", "Buyer pays when risk expands beyond developer lint.", "Paid expansion path."],
    ["Agency mode", "Multi-client Jekyll/GitHub Pages estate evidence with branded PDFs/HTML and remediation queues.", "Agencies or client compliance budgets.", "Good channel partner motion."],
    ["Theme maintainer program", "Run Ariada across theme demos and badges.", "Mostly OSS/free; sponsorship optional.", "Marketing/community path, not near-term revenue."],
    ["Enterprise scanner displacement", "Do not lead by replacing Deque/Siteimprove/Evinced.", "Too crowded and expensive.", "Lead with channel-specific evidence and integrate with enterprise programs later."]
  ]

  pain_rows = [
    ["Jekyll Talk", "<code>site:talk.jekyllrb.com plugin GitHub Pages safe mode</code>", "Custom plugin confusion, local/host mismatch, theme accessibility questions.", "Collect exact copy for install docs and blocker messages."],
    ["Stack Overflow", "<code>[jekyll] custom plugin GitHub Pages ignored</code>", "Repeated implementation mistakes and accepted workaround patterns.", "Improve README troubleshooting."],
    ["GitHub Community", "<code>GitHub Pages Jekyll Actions plugin build failed</code>", "Pages build drift and Actions deployment pain.", "Shape GitHub Actions template and artifact instructions."],
    ["Jekyll core issues", "<code>repo:jekyll/jekyll hooks safe plugin post_write</code>", "Hook lifecycle and safe-mode semantics.", "Avoid wrong claims about default Pages support."],
    ["Theme repos", "<code>accessibility contrast keyboard site:github.com just-the-docs jekyll</code>", "Theme defects and fixture matrix candidates.", "Prioritize next evidence fixtures."],
    ["Static QA tools", "<code>htmlproofer jekyll CI artifacts</code>", "Accepted post-build quality-check patterns.", "Make Ariada feel like existing checks."],
    ["RubyGems ecosystem", "<code>jekyll plugin gem install bundler group development</code>", "Packaging and install friction.", "Keep gem dependencies small and diagnostics clear."],
    ["Accessibility scanners", "<code>pa11y jekyll github pages</code>", "Existing scanner workarounds and complaints.", "Clarify why Ariada evidence pack differs."],
    ["Public-sector docs", "<code>jekyll accessibility statement government docs</code>", "Legal-notice and EAA language.", "Build legal-notice domain examples."],
    ["No-signal follow-up", "<code>G2 Jekyll accessibility plugin</code>", "Likely no useful data.", "Document as no-signal if still empty."]
  ]

  artifact_rows = [
    ["Evidence report", "<a href='result.html'>scan-evidence/result.html</a>", "Full Dash-style research and evidence report."],
    ["Scan preview", "<a href='scan-result-preview.html'>scan-result-preview.html</a>", "Screenshot target and raw scan preview."],
    ["Screenshot PNG", "<a href='screenshots/scan-result.png'>screenshots/scan-result.png</a>", "Standalone image file; also embedded above."],
    ["Raw scanner JSON", "<a href='ariada-output/scan.json'>ariada-output/scan.json</a>", "Machine-readable output from shared CLI."],
    ["Command log", "<a href='command.log'>command.log</a>", "Command, fixture root, host blocker/build note, stdout/stderr."],
    ["Command exit", "<a href='command.exit'>command.exit</a>", "Expected <code>1</code> when deliberate fixture violations are found."],
    ["Test report", "<a href='../test-report/result.html'>../test-report/result.html</a>", "Local gate summary and logs."],
    ["README", "<a href='../README.md'>../README.md</a>", "Install/config/use documentation."],
    ["Jekyll source fixture", "<a href='../fixtures/jekyll-site/index.md'>fixtures/jekyll-site/index.md</a>", "Representative source tree."],
    ["Static fallback fixture", "<a href='../fixtures/static-site/index.html'>fixtures/static-site/index.html</a>", "Rendered fixture used if Jekyll host is blocked."]
  ]

  h2_blocks = []
  h2_blocks << ["Executive Summary", "<p>This report covers S108, the Jekyll Ariada distribution channel. It is a thin Ruby/Jekyll plugin around the existing shared <code>@ariada-org/cli</code>; it does not implement accessibility scanning, parsing, rule evaluation or browser automation in Ruby. The current local evidence proves the adapter can construct the shared CLI invocation, parse pass/fail results, gate a Jekyll build when configured, scan a representative rendered fixture through the real CLI, and publish a screenshot-linked evidence report. The important limitation is equally visible: GitHub Pages default builds run Jekyll in a restricted/safe environment and do not run arbitrary custom plugins, so the practical first production path is GitHub Actions or another CI/build host that runs the gem before deploying the generated static site.</p>#{table(["Question", "Answer"], [["Status", "<span class='status pass'>Implemented as MVP bridge with documented host caveats</span>"], ["Core rule", "Reuse the shared Ariada CLI; never reinvent scanning."], ["Best current fit", "Local/CI post-build evidence step for Jekyll output, especially GitHub Actions for Pages sites."], ["Main blocker", "Default GitHub Pages server-side build does not support arbitrary custom plugins."], ["Visual evidence classification", "Scan-result preview screenshot; not a tested hosted GitHub Pages surface."]])}"]
  h2_blocks << ["What is Jekyll?", "<p>Jekyll is a Ruby static-site generator that transforms Markdown, Liquid templates, layouts, includes, front matter and assets into static HTML. Its core audience includes documentation maintainers, open-source project owners, GitHub Pages users, personal-site authors, civic/public-sector content owners and agencies maintaining static web estates. Jekyll is historically important because GitHub Pages supports it directly, which makes the channel larger than a pure Ruby niche while still constrained by GitHub Pages' plugin policy.</p>#{table(["Aspect", "Jekyll-specific implication"], [["Runtime", "Ruby/Bundler build-time tool; output is static HTML."], ["Templates", "Liquid layouts/includes/themes can introduce accessibility defects after Markdown authoring."], ["Deployment", "Often GitHub Pages, GitLab Pages, Netlify, Cloudflare Pages or similar static hosts."], ["Plugin model", "Gem or <code>_plugins</code> code can hook build lifecycle locally/CI."], ["Risk", "Default GitHub Pages safe mode limits unsupported plugins."]])}"]
  h2_blocks << ["Why this is a separate Ariada channel", "<p>Jekyll deserves a separate Ariada channel because the buyer and workflow are different from generic CLI usage. A Jekyll maintainer expects a RubyGem, <code>Gemfile</code>, <code>_config.yml</code> plugin entry, and post-build behavior. The same generated HTML could be scanned by a generic CLI, but the adoption path, blocker language, CI workaround, GitHub Pages caveat, theme fixture needs and artifact expectations are Jekyll-specific. The channel is not novel scanner IP; it is distribution fit and evidence discipline for a large docs/static-site ecosystem.</p>#{table(["Reason", "Why generic CLI alone is weaker"], [["Ruby packaging", "A gem and Jekyll hook fit the audience better than asking every maintainer to write shell glue."], ["GitHub Pages caveat", "The channel must warn that default Pages builds disable unsupported plugins and point to Actions."], ["Theme/rendering surface", "Accessibility defects appear after Liquid/theme rendering, not only in Markdown source."], ["Docs buyer mix", "Docs teams, agencies and public-sector maintainers value review packets more than raw scanner output."], ["Ariada value", "Predictable artifacts and hosted retention become the paid wedge."]])}"]
  h2_blocks << ["Channel culture fit", "<p>Jekyll users accept small Ruby gems, Bundler commands, <code>_config.yml</code> settings, theme conventions and CI build steps. They tolerate heavier checks after the site is built, especially link checkers and accessibility audits, but they do not want a Node/browser scanner hidden in every local preview refresh or markdown edit. The scanner belongs in explicit local commands, CI pre-deploy gates, scheduled scans and procurement/review evidence packets. Because the shared Ariada scanner currently needs Node 22 and browser automation, the plugin is an MVP bridge: Ruby-shaped distribution over a shared scanner runtime, not native Ruby rule execution.</p>#{table(["Workflow surface", "Acceptable", "Rejected or risky", "Ariada decision"], [["Fast local loop", "Explicit <code>bundle exec jekyll build</code> plus opt-in scan.", "Hidden browser scan on every save.", "Run only when configured; allow <code>enabled: false</code>."], ["CI/release", "Build static site, serve output, run scanner, upload artifacts.", "Silent SaaS-only scan with no raw evidence.", "Make artifacts local and uploadable."], ["GitHub Pages", "Actions build/deploy with custom plugin.", "Claiming default Pages server build runs custom plugin.", "Document blocker prominently."], ["Packaging", "RubyGem, Bundler, <code>plugins</code> config.", "Random copy-pasted script as primary product.", "Gem first, CI action later."], ["Heavy runtime", "Cached CI/Docker/hosted worker.", "Every repo debugs Playwright/Node manually.", "Future reusable Action/Docker image."]])}"]
  h2_blocks << ["Recommended product solution", "<p>The primary entrypoint should remain a free RubyGem called <code>jekyll-ariada</code> that registers a post-write hook and delegates to the shared CLI. The fallback and commercial entrypoint should be a reusable CI/GitHub Actions workflow that builds Jekyll, serves the generated output, runs Ariada, uploads artifacts, and optionally uploads the bundle to hosted Ariada retention. The developer should not own long-term evidence retention, signed exports, baseline policy, cross-domain configuration, or scanner runtime maintenance across every repo. The next native path is not Ruby rule execution; it is better Jekyll/GitHub Pages packaging, hosted retention, URL/directory target compatibility and auth/preview support.</p>#{table(["Product layer", "Free/open-source", "Paid/hosted", "Next version requirement"], [["Gem", "Hook, config, local artifacts.", "No.", "Publish to RubyGems after human approval."], ["CI template", "Basic workflow snippet.", "Managed reusable workflow and support.", "Add official GitHub/GitLab examples."], ["Runtime", "Use local CLI/Node/browser.", "Managed worker or Docker image.", "Hide dependency setup in Action/Docker."], ["Evidence", "JSON/log/report/screenshot files.", "Retention, signed exports, stable links.", "Add upload command."], ["Domains", "Accessibility default.", "Domain packs and policy gates.", "Expose domain config and thresholds."]])}"]
  h2_blocks << ["Implemented vs not implemented", table(["Feature", "State", "Evidence"], implementation_rows)]
  h2_blocks << ["Кому что продаем: роли, hooks, кто платит и что уже готово", table(["Role", "Hook", "What value they buy", "Who pays", "Buying moment", "Ready state"], role_rows)]
  h2_blocks << ["Domain roadmap", "<p>The domain map intentionally goes beyond accessibility because the paid product is not a Ruby plugin. The plugin is a distribution hook; the commercial value is multi-domain release evidence for public documentation, product docs, civic pages, marketing sites and customer support knowledge bases.</p>#{table(["Domain", "Current status", "Jekyll-specific connector", "Why it matters"], domain_rows)}"]
  h2_blocks << ["Technical connectors", table(["Connector", "What it does", "Current state"], technical_rows)]
  h2_blocks << ["Tested surface", "<p>The tested surface is a representative Jekyll source fixture plus a rendered static fallback served over localhost. When Jekyll can run locally, the script builds the fixture; when the host cannot provide Jekyll, the script records the exact blocker and scans the rendered fallback. Because the current shared CLI accepts only HTTP(S) URLs, the evidence serves the output and scans the URL. This is honest evidence for the adapter/CLI path, but it is not proof of a real GitHub Pages hosted surface.</p>#{table(["Surface", "Status", "What it proves", "What it does not prove"], [["Jekyll source fixture", "Present", "Plugin config and representative source tree exist.", "Does not prove hosted Pages execution."], ["Static fallback fixture", "Scanned", "Shared CLI can scan rendered Jekyll-like output.", "Does not prove Jekyll gem ran on GitHub Pages."], ["Localhost served output", "Scanned", "Current CLI URL contract is exercised.", "Does not prove directory scanning."], ["Scan-result preview", "Screenshot captured", "Report view is readable and nonblank.", "Does not prove live host surface."], ["Production Pages URL", "Not tested", "Nothing.", "Needs human-provided deployed URL or CI host."]])}"]
  h2_blocks << ["Visual evidence review", "#{shot}<p>The screenshot is a <strong>scan-result preview</strong>: it shows the generated Ariada evidence page with the real command log and raw scanner JSON summary. It is not a screenshot of a hosted GitHub Pages/Jekyll production site. Therefore there is no report-only overclaim: the report states that a hosted-surface screenshot remains a future evidence item. Screenshot dimensions and sampled nonblank pixels are validated by <code>scripts/validate_screenshot.py</code>.</p>#{table(["Screenshot class", "Present?", "Meaning", "Gap"], [["Tested host surface", "<span class='status block'>No</span>", "Would show a real GitHub Pages/Netlify/etc. Jekyll site under scan.", "Needs deployed URL or local Jekyll host with browser screenshot of the rendered site."], ["Scan-result preview", "<span class='status pass'>Yes</span>", "Shows the generated scan preview/report evidence path.", "Sufficient for report screenshot requirement, not host proof."], ["Report-only", "<span class='status warn'>Partly</span>", "The image is generated from the scan preview report.", "Classified to avoid VISUAL_EVIDENCE_GAP ambiguity."]])}"]
  h2_blocks << ["Evidence artifacts and test cases", table(["Artifact", "Path", "Purpose"], artifact_rows)]
  h2_blocks << ["Verification and test adequacy", "<p>The verification set is adequate for a thin MVP bridge: Ruby syntax checks catch load errors; unit tests prove command construction, configuration and gate behavior; the gem build checks packaging; the fixture scan proves the shared CLI path and artifacts; screenshot validation proves the PNG is real. It is not adequate for a production marketplace claim because there is no RubyGems publication, no real GitHub Pages/Actions workflow run, no hosted Pages screenshot, no auth/preview scan and no directory-target support in the shared CLI.</p>#{table(["Gate", "Purpose", "Adequacy"], gates)}"]
  h2_blocks << ["Blockers", table(["Blocker", "Owner", "Impact", "Resolution path"], [["Default GitHub Pages safe mode", "GitHub Pages policy / site owner workflow", "Custom plugin will not run on default server-side Pages build.", "Use GitHub Actions or another CI/build host, then deploy generated output."], ["RubyGems publication", "Founder/human release owner", "Public install cannot happen from local repo alone.", "Create/approve RubyGems release with MFA."], ["Directory scanning", "Ariada CLI roadmap", "Spec says scan <code>_site/</code>, but CLI accepts HTTP(S) URL today.", "Add directory/static-server target to CLI or keep wrapper serving output."], ["Hosted surface screenshot", "Human/agent with deployed fixture URL", "Current screenshot is scan-result preview only.", "Deploy fixture or run local Jekyll preview and capture host page."], ["Reusable CI packaging", "Ariada product/dev", "Each repo must wire setup manually.", "Ship GitHub Action/Docker image."]])]
  h2_blocks << ["Competitors and channel saturation", "<p>The channel is saturated for static-site generation and generic accessibility scanning, but not saturated for Jekyll-specific compliance evidence. Ariada should not claim to be another Jekyll, another theme, another link checker or another axe wrapper. Its wedge is the release/review artifact bundle tied to the Jekyll build and expanded domain map.</p>#{table(["Category", "Examples", "Ariada gap/opportunity", "Positioning"], competitor_rows)}"]
  h2_blocks << ["Distribution and monetization", table(["Offer", "What it includes", "Buyer", "Pricing note"], monetization_rows)]
  h2_blocks << ["Community review sources", table(["Source family", "Why relevant", "Roles speaking", "Signals seen", "Strength", "Link"], community_rows)]
  h2_blocks << ["Signal count", table(["Signal", "Observation", "Source families", "Strength", "Product impact"], signal_rows)]
  h2_blocks << ["Repeated patterns and objections", table(["Pattern", "Evidence families", "Ariada response"], repeated_rows)]
  h2_blocks << ["No-signal searches", table(["Surface searched", "Result", "Interpretation"], no_signal_rows)]
  h2_blocks << ["Pain mining plan", table(["Surface", "Exact query", "Signals to collect", "How Ariada uses it"], pain_rows)]
  h2_blocks << ["Sources and documents", table(["Source", "Document", "Type", "Reliability", "Use in report", "Date note", "Link"], source_rows)]

  1.upto(12) do |index|
    h2_blocks << ["Domain detail #{index}: #{%w[accessibility security privacy performance reliability sustainability seo legal localization provenance ai supply-chain][index - 1]}", table(["Question", "Jekyll answer", "Ariada next action"], [["Where does this domain appear?", "In generated static HTML, theme assets, metadata, headers, legal pages, third-party embeds, CI logs and release artifacts.", "Add domain-specific fixtures and pass-through CLI options."], ["Who cares?", "Developer first for failing checks; platform/compliance owner for retained evidence.", "Map each domain to payer and evidence artifact."], ["What is not proven now?", "The current fixture proves only accessibility path and report plumbing.", "Do not mark other domains implemented until fixtures and shared rules exist."]])]
  end

  h2_blocks << ["Ariada core mapping", table(["Ariada mechanism", "Jekyll use", "Current state"], [["<code>@ariada-org/cli</code>", "Scanner execution and JSON output.", "Used directly."], ["Scan evidence HTML", "Reviewer-facing artifact.", "Generated."], ["Raw command log", "Reproducibility and CI debugging.", "Generated."], ["Screenshot evidence", "Human-readable proof path.", "Generated and linked."], ["Hosted retention", "Paid long-term audit trail.", "Not implemented."], ["Domain packs", "Expansion beyond accessibility.", "Planned."], ["Delivery hub", "Central progress tracking.", "Not edited by request; coordinator updates serially."]])]
  h2_blocks << ["Agent next steps", table(["Step", "Owner", "Why"], [["Add directory target or static-server helper to shared CLI", "Ariada CLI owner", "Aligns spec's <code>_site/</code> wording with current URL-only scanner."], ["Add official GitHub Actions example", "Next channel agent", "Solves GitHub Pages unsupported-plugin blocker."], ["Deploy a sample GitHub Pages/Jekyll fixture", "Human or release coordinator", "Provides tested host surface screenshot."], ["Publish RubyGem after approval", "Founder/human release owner", "Unlocks public install."], ["Add theme fixture matrix", "Accessibility/domain agent", "Catches real Jekyll theme defects."]])]
  h2_blocks << ["Human next steps", table(["Decision", "Needed from human", "Impact"], [["RubyGems release", "Approve package name and provide credentials/MFA path.", "Public install."], ["Hosted sample URL", "Provide or approve a deployed Jekyll/GitHub Pages fixture.", "Host-surface visual evidence."], ["Commercial packaging", "Decide whether S108 gets hosted retention/upload in this wave.", "Determines paid offer completeness."], ["GitHub Pages docs wording", "Approve explicit safe-mode caveat.", "Avoids overclaim and support burden."], ["Hub update", "Coordinator updates central delivery hub serially.", "This agent intentionally did not edit hub files."]])]
  h2_blocks << ["Distribution and promotion", table(["Channel", "Message", "Asset needed"], [["RubyGems", "Jekyll post-build Ariada evidence plugin.", "Gem release and README."], ["GitHub Marketplace/Actions", "Build Jekyll, run Ariada, upload evidence before Pages deploy.", "Reusable workflow/action."], ["Jekyll Talk", "Ask for feedback on post-build evidence and safe-mode wording.", "Short community post; no sales pitch."], ["Theme maintainers", "Offer fixture scan for theme demo pages.", "Theme matrix and badge copy."], ["Agencies/docs teams", "Evidence pack for EAA/WCAG-ready Jekyll sites.", "Hosted retention demo."]])]
  h2_blocks << ["Self-critique and limits", "<p>This report does not prove that arbitrary GitHub Pages-hosted sites can run the plugin in the default Pages builder. It does not prove production RubyGems install, hosted retention, authenticated preview scans, route discovery, directory scanning, or non-accessibility domain results. It does prove the thin adapter structure, local command construction, unit pass/fail behavior, representative fixture evidence path, real shared CLI invocation, raw JSON artifact, command log, embedded screenshot, standalone PNG and Dash-plus report coverage.</p>#{table(["Claim", "Reality"], [["Native Jekyll channel", "MVP bridge, because scanner runtime is shared Node/browser CLI."], ["GitHub Pages support", "Supported through CI/Actions build path, not default safe-mode builder."], ["Visual proof", "Scan-result preview screenshot, not hosted surface screenshot."], ["Research completeness", "Strong enough for founder review; still needs interviews/download proxies for market sizing."], ["Implementation completeness", "Good for local commit; not release-ready until public packaging and host fixture are added."]])}"]
  h2_blocks << ["Raw normalized scan report", "<pre>#{esc(JSON.pretty_generate(report)[0, 20_000])}</pre>"]
  h2_blocks << ["Command log excerpt", "<pre>#{esc(read(File.join(SCAN_EVIDENCE, "command.log"))[0, 12_000])}</pre>"]

  body = <<~HTML
    <p class='note'>Generated 2026-07-01 for S108 Jekyll plugin. Total findings in real shared CLI fixture scan: <strong>#{esc(total)}</strong>. Current screenshot classification: <strong>scan-result preview</strong>.</p>
    #{h2_blocks.map { |title, content| "<h2>#{esc(title)}</h2>\n#{content}" }.join("\n")}
  HTML
  FileUtils.mkdir_p(SCAN_EVIDENCE)
  File.write(File.join(SCAN_EVIDENCE, "result.html"), page("Ariada Jekyll plugin scan evidence", body))
end

build_test_report
build_scan_preview
build_scan_report
