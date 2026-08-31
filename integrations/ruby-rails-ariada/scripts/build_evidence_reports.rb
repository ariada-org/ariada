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

def status_for(name, allowed: ["0"])
  allowed.include?(exit_status(name)) ? "pass" : "fail"
end

def shell_log(name)
  text = read(File.join(TEST_REPORT, "logs", "#{name}.log")).strip
  text.empty? ? "(no output)" : text
end

def scan_report
  path = File.join(SCAN_EVIDENCE, "ariada-output", "multi-domain-report.json")
  return {} unless File.exist?(path)

  JSON.parse(File.read(path, encoding: "UTF-8"))
end

def scan_total(report)
  grid = report["grid"]
  return 0 unless grid.is_a?(Hash)

  grid.values.sum do |site|
    next 0 unless site.is_a?(Hash)

    site.values.sum { |findings| findings.is_a?(Array) ? findings.length : 0 }
  end
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
    body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}
    main{max-width:1040px;margin:0 auto;padding:32px 20px}
    h1{font-size:1.9rem;margin:0 0 12px}
    h2{font-size:1.2rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}
    table{border-collapse:collapse;width:100%;background:#fff}
    th,td{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}
    code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
    code{background:#eef1f5;padding:1px 5px;border-radius:4px}
    pre{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}
    figure{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}
    img{display:block;max-width:100%;height:auto}
    figcaption{padding:10px 14px}
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
    ["install", "bundle install --path vendor/bundle", ["0"]],
    ["pnpm-install", "pnpm install", ["0"]],
    ["cli-deps-build", "pnpm --filter @ariada-org/cli... build", ["0"]],
    ["rules-axe-deps-build", "pnpm --filter @ariada-org/rules-axe... build", ["0"]],
    ["rspec", "bundle exec rspec", ["0"]],
    ["ruby-syntax", "ruby -c lib/ariada/rails.rb", ["0"]],
    ["rake-syntax", "ruby -c lib/tasks/ariada.rake", ["0"]],
    ["gem-build", "gem build ariada-rails.gemspec", ["0"]],
    ["fixture-scan", "ruby scripts/run_fixture_scan.rb", ["0", "1"]]
  ]
  rows = gates.map do |name, command, allowed|
    "<tr><th scope='row'>#{esc(name)}</th><td>#{esc(status_for(name, allowed: allowed))}</td><td><code>#{esc(command)}</code></td></tr>"
  end.join("\n")
  logs = gates.map do |name, _command, _allowed|
    "<details><summary>#{esc(name)} log</summary><pre>#{esc(shell_log(name))}</pre></details>"
  end.join("\n")

  body = <<~HTML
    <p>Focused local gates for the Ruby gem and Rails Railtie adapter. The fixture scan allows exit code 1 because the intentionally broken fixture should produce Ariada findings.</p>
    <table><thead><tr><th scope='col'>Gate</th><th scope='col'>Result</th><th scope='col'>Command</th></tr></thead><tbody>#{rows}</tbody></table>
    <h2>Logs</h2>
    #{logs}
  HTML
  FileUtils.mkdir_p(TEST_REPORT)
  File.write(File.join(TEST_REPORT, "result.html"), page("Ariada Ruby/Rails test report", body))
end

def build_scan_preview
  report = scan_report
  total = scan_total(report)
  command = read(File.join(SCAN_EVIDENCE, "command.log")).strip
  body = <<~HTML
    <p>Real Ariada CLI scan triggered through <code>bundle exec rake ariada:scan</code> against a Ruby-served Rails-like fixture page.</p>
    <p><strong>#{esc(total)}</strong> finding(s) in <code>scan-evidence/ariada-output/multi-domain-report.json</code>.</p>
    <h2>Command Output</h2>
    <pre>#{esc(command.empty? ? "(no command output)" : command)}</pre>
    <h2>Report Summary</h2>
    <pre>#{esc(JSON.pretty_generate(report)[0, 12_000])}</pre>
  HTML
  FileUtils.mkdir_p(SCAN_EVIDENCE)
  File.write(File.join(SCAN_EVIDENCE, "scan-result-preview.html"), page("Ariada Ruby/Rails real scan preview", body))
end

def build_scan_report
  report = scan_report
  total = scan_total(report)
  screenshot = File.join(SCAN_EVIDENCE, "screenshots", "scan-result.png")
  shot = if File.exist?(screenshot)
           encoded = Base64.strict_encode64(File.binread(screenshot))
           "<figure><img alt='Screenshot of the Ariada Ruby/Rails scan result' src='data:image/png;base64,#{encoded}'><figcaption>Встроенный скрин реального scan preview. <a href='screenshots/scan-result.png'>Открыть PNG отдельно</a>.</figcaption></figure>"
         else
           "<p><strong>Evidence gap:</strong> screenshot file was not produced.</p>"
         end

  channel_rows = [
    ["Что такое Ruby/Rails", "Ruby on Rails is a Ruby web framework for server-rendered and full-stack web applications. Teams ship HTML responses, asset bundles, forms, admin panels, customer portals and internal tools through Rack/Rails routes."],
    ["Почему это отдельный канал", "Rails apps are not just static files. The useful scan surface often appears after routing, template rendering, layout composition, asset helpers, authentication and environment-specific middleware. A channel adapter must scan the live rendered URL or a representative Rails/Rack fixture."],
    ["Канал распространения", "RubyGems package <code>ariada-rails</code>, Rails Railtie, Rake task and CI snippets."],
    ["Правильный wedge", "Do not sell Ariada as another Rails test framework. Sell it as repeatable accessibility and compliance evidence for already existing Rails apps before release."],
    ["Кто будет искать", "Rails developers, platform/CI owners, accessibility reviewers, agencies maintaining Rails estates, and compliance owners responsible for customer-facing portals."]
  ].map { |k, v| "<tr><th scope='row'>#{k}</th><td>#{v}</td></tr>" }.join("\n")

  role_rows = [
    ["Rails developer", "One Rake task before review", "<code>bundle exec rake ariada:scan</code>, local JSON/log/report/screenshot", "Usually not payer", "First adoption hook", "implemented locally"],
    ["CI/platform owner", "Release gate for rendered Rails routes", "CI step, artifact upload, route list, thresholds", "Team/platform budget", "After developer proof", "planned next"],
    ["Accessibility reviewer", "Defensible evidence, not a screenshot pasted in chat", "HTML report, raw JSON, command log, standalone screenshot", "Influencer or audit buyer", "When review starts", "local evidence ready"],
    ["Product/release owner", "Ship customer portal without late compliance surprise", "Release evidence pack and blocker list", "Product/platform budget", "When app is customer-facing", "positioning only"],
    ["Compliance/legal owner", "Audit trail across releases", "Hosted retention, exports, policy gates", "Economic buyer", "After repeated CI evidence", "not implemented"]
  ].map do |role, promise, offer, payer, entry, status|
    "<tr><th scope='row'>#{role}</th><td>#{promise}</td><td>#{offer}</td><td>#{payer}</td><td>#{entry}</td><td>#{status}</td></tr>"
  end.join("\n")

  implemented_rows = [
    ["Ruby gem shell", "done", "<code>ariada-rails.gemspec</code>, <code>Gemfile</code>, package metadata and files are present."],
    ["Thin scanner wrapper", "done", "<code>Ariada::Rails::Scanner</code> shells out to shared <code>@ariada-org/cli</code>. It does not implement scanner rules in Ruby."],
    ["Rake task", "done", "<code>rake ariada:scan</code> supports env overrides for target URL, CLI path, output dir and domains."],
    ["Rails integration", "done", "Railtie loads the Rake task when Rails is present."],
    ["Local surface evidence", "done", "Ruby WEBrick serves a Rails-like HTML fixture and the shared CLI scans it."],
    ["RubyGems publication", "blocked", "Needs founder-owned RubyGems.org account and gem push credentials."],
    ["Real production Rails app scan", "blocked", "Needs chosen deployed/staging Rails URL, auth context if protected, and account-approved data exposure."]
  ].map { |k, s, v| "<tr><th scope='row'>#{k}</th><td>#{s}</td><td>#{v}</td></tr>" }.join("\n")

  domain_rows = [
    ["Accessibility", "implemented locally", "First wedge: WCAG/EAA review evidence for rendered Rails views."],
    ["Security", "ready to expose / planned for channel", "Rails portals care about CSP, cookies, mixed content and headers; add route fixture and domain passthrough."],
    ["Privacy / GDPR", "ready to expose / planned for channel", "Cookie/analytics/consent evidence matters for customer-facing Rails apps."],
    ["Performance", "planned", "Rails pages can regress through assets, layout shifts and heavy server-rendered tables; depends on D07 performance domain."],
    ["SEO / structured data", "planned for public Rails sites", "Canonical/meta/OG/schema evidence is relevant for marketing/content Rails apps."],
    ["i18n", "planned for EU/public-sector Rails apps", "Rails has mature locale workflows; rendered lang/date/currency evidence should be tested."],
    ["Reliability / availability", "candidate", "Route availability and 5xx/timeout evidence are strong CI-owner pains for Rails releases."]
  ].map { |d, s, why| "<tr><th scope='row'>#{d}</th><td>#{s}</td><td>#{why}</td></tr>" }.join("\n")

  competitor_rows = [
    ["Rails testing ecosystem", "RSpec, Capybara, system tests, Rails test runner", "They test app behavior; Ariada adds compliance scan artifacts and reviewer-ready evidence."],
    ["Accessibility scanners", "axe, Pa11y, Lighthouse, WAVE", "They scan pages; Ariada wraps the rendered Rails channel with JSON/log/screenshot/report contract."],
    ["Security scanners", "Brakeman, bundler-audit, OWASP ZAP, SecurityHeaders", "They cover code/dependencies/headers; Ariada should join web-surface evidence with accessibility/privacy in one report."],
    ["CI platforms", "GitHub Actions, GitLab CI, CircleCI", "They execute checks; Ariada supplies the Rails-specific scan step and artifacts."]
  ].map { |d, c, g| "<tr><th scope='row'>#{d}</th><td>#{c}</td><td>#{g}</td></tr>" }.join("\n")

  artifact_rows = [
    ["Raw scanner JSON", "<a href='ariada-output/multi-domain-report.json'>multi-domain-report.json</a>"],
    ["Command log", "<a href='command.log'>command.log</a>"],
    ["Screenshot PNG", "<a href='screenshots/scan-result.png'>scan-result.png</a>"],
    ["Technical test report", "<a href='../test-report/result.html'>test-report/result.html</a>"],
    ["README", "<a href='../README.md'>README.md</a>"]
  ].map { |k, v| "<tr><th scope='row'>#{k}</th><td>#{v}</td></tr>" }.join("\n")

  culture_rows = [
    ["Fast local loop", "Rails developers accept fast commands that feel like the rest of the app: <code>bin/rails test</code>, <code>bundle exec rspec</code>, <code>bundle exec brakeman</code>, <code>bundle audit</code> and focused Rake tasks. A browser accessibility scanner is acceptable locally only when it is explicit and scoped, not when every model spec suddenly starts a browser runtime."],
    ["CI and release loop", "Rails teams already tolerate heavier checks in CI: system tests with Capybara/Selenium, Brakeman static analysis, bundler-audit, RuboCop, database-backed test suites and asset compilation. Ariada belongs naturally as a release/pre-merge evidence step after the app is booted on localhost or a review URL."],
    ["Packaging expectations", "The idiomatic first-class package is a RubyGem with a Railtie and Rake task. The second surface is a GitHub Action or GitLab CI snippet that caches Node/browser dependencies. A Docker image is useful for organizations that do not want every Rails app to own the scanner runtime."],
    ["What this audience rejects", "Rails app owners do not want a large foreign scanner hidden inside every request, migration, unit test or boot path. They will reject opaque SaaS-only scanning when protected staging routes, cookies and customer data are involved. They also dislike JavaScript build sprawl when it is unrelated to their Rails change."],
    ["Foreign dependency", "The current adapter shells out to <code>@ariada-org/cli</code>. That is acceptable as an MVP bridge and CI step, but not as a claim of native Ruby scanning. Native maturity means the gem hides dependency discovery, provides clear install errors, and offers a maintained CI/Docker path."],
    ["Where the scan belongs", "Default placement: explicit local Rake task for adoption, pre-merge CI for release confidence, nightly or scheduled scan for larger route lists, and hosted retention for audit/procurement evidence. It should not run on every Rails request, every model spec, or every developer save."],
    ["Rails culture signal", "Rails values convention and batteries-included workflows. A thin adapter is acceptable when it meets Rails conventions: Gemfile install, Railtie loading, Rake task namespace, ENV overrides, README copy/paste commands and predictable artifacts under <code>scan-evidence/</code>."]
  ].map { |k, v| "<tr><th scope='row'>#{k}</th><td>#{v}</td></tr>" }.join("\n")

  solution_rows = [
    ["Primary entrypoint", "Ship <code>ariada-rails</code> as a free RubyGem that installs a Railtie and <code>ariada:scan</code> Rake task. The gem should stay thin: configure target URL, domains, output directory, CLI path and artifact naming; do not fork scanner rules into Ruby."],
    ["Fallback entrypoint", "Publish official GitHub Actions and GitLab CI snippets for Rails apps. The snippets should boot the app, wait on a health URL, run <code>bundle exec rake ariada:scan</code>, and upload JSON, command log, HTML report and screenshot as artifacts."],
    ["Heavy dependency handling", "Cache or hide Node/browser/scanner setup in a reusable action, Docker image or hosted worker. A Rails developer should not debug Playwright browser downloads when the job is a compliance evidence step."],
    ["Free versus paid", "Free/open-source: gem, Rake task, README, local JSON/log/report generation, basic CI examples. Paid/hosted: retention, baselines, signed exports, team dashboards, policy thresholds, route coverage, reviewer workflow, audit history and multi-domain evidence packs."],
    ["What the developer should not own", "The app developer should not own long-term evidence retention, signed export integrity, cross-release baselines, compliance policy tuning, or scanner runtime maintenance across every Rails repository."],
    ["Next native path", "v0.2 should add Rails route discovery, authenticated cookie/header support, CI templates and friendly install diagnostics. v0.3 should add Docker/Action packaging, route matrix reports and hosted upload. Native Ruby rule execution is not required for the first commercial wedge."],
    ["Current fit label", "Current implementation is an MVP evidence bridge: Rails-shaped wrapper, real local scan evidence, shared Ariada core. It is not yet a final native channel because publication, production route scan, CI packaging and hosted retention remain blocked or planned."]
  ].map { |k, v| "<tr><th scope='row'>#{k}</th><td>#{v}</td></tr>" }.join("\n")

  technical_rows = [
    ["Gem install", "<code>gem 'ariada-rails'</code> in a Rails app Gemfile is the desired surface. Current repo has local gem metadata and can run inside this integration fixture; public RubyGems release is blocked on credentials."],
    ["Railtie", "Railtie loading is the Rails-native mechanism for installing framework hooks and Rake tasks without asking users to edit boot files manually."],
    ["Rake task", "<code>bundle exec rake ariada:scan</code> is the right developer affordance because Rails apps already expose operational jobs through Rake and Rails command-line tasks."],
    ["CLI bridge", "The adapter delegates scanning to the shared <code>@ariada-org/cli</code>. That preserves one Ariada scanner core and avoids divergent Ruby-only rules."],
    ["Route source", "The tested surface is a Ruby WEBrick-served Rails-like fixture. The next version must support user-provided URL, route list and eventually Rails route discovery."],
    ["Artifacts", "Artifacts must stay predictable: <code>scan-evidence/ariada-output/multi-domain-report.json</code>, <code>scan-evidence/command.log</code>, <code>scan-evidence/result.html</code> and <code>scan-evidence/screenshots/scan-result.png</code>."],
    ["CI connector", "A CI recipe should start the Rails app with test/staging config, wait for readiness, run the Rake task, upload artifacts and fail only on policy thresholds agreed by the release owner."],
    ["Auth connector", "Protected admin and customer portals need cookie/header/session injection. That belongs in a clearly documented CI/hosted mode, not in a silent local default."],
    ["Container connector", "Docker image should package Node/browser scanner dependencies for teams that prefer a stable external job over installing scanner runtimes in every Rails app."],
    ["Evidence upload", "Hosted Ariada should accept report bundles from the gem/action and return stable reviewer links, retention status, baseline deltas and export signatures."]
  ].map { |k, v| "<tr><th scope='row'>#{k}</th><td>#{v}</td></tr>" }.join("\n")

  monetization_rows = [
    ["Rails developer", "Usually not the economic buyer. The developer adopts because one Rake task produces evidence before code review and avoids late accessibility review churn. Keep this path free and fast."],
    ["Platform / CI owner", "Pays or influences budget when many Rails repos need consistent gates, artifacts, retry policy, route coverage and baseline management. Sell reusable CI packaging and hosted artifact retention."],
    ["Application owner", "Pays when a Rails customer portal, checkout, SaaS admin, marketplace or public service must ship with defensible compliance evidence. Sell release confidence and reviewer-ready evidence packs."],
    ["Accessibility reviewer", "May not own budget but can demand repeatable evidence. Sell reviewer workflow: stable HTML report, raw JSON, screenshot, remediation notes, export and comparison across releases."],
    ["Compliance / legal owner", "Economic buyer for EAA/GDPR/procurement risk. Sell signed exports, long-term retention, audit log, SSO/team controls, policy thresholds and multi-domain reports."],
    ["Agency / consultancy", "Rails agencies maintaining client estates can use Ariada as a delivery proof layer. Sell multi-client retention, branded reports, bulk route scans and handoff exports."],
    ["Founder sales motion", "Do not sell a Ruby testing framework. Land with the free gem, expand to CI artifacts, then sell hosted compliance evidence and multi-domain governance to teams already running Rails."]
  ].map { |k, v| "<tr><th scope='row'>#{k}</th><td>#{v}</td></tr>" }.join("\n")

  sales_rows = [
    ["RubyGems / Bundler", "RubyGems and Bundler monetize indirectly as ecosystem infrastructure, not by selling app evidence. Ariada should use them for distribution and sell hosted evidence value above the free gem.", "<a href='https://rubygems.org/'>RubyGems</a> · <a href='https://bundler.io/'>Bundler</a>"],
    ["Rails ecosystem tools", "RSpec, Capybara, Brakeman, bundler-audit and RuboCop are developer tools. They set the expectation that checks are installed as gems and run in CI. Ariada differs by creating reviewer/compliance artifacts.", "<a href='https://rspec.info/'>RSpec</a> · <a href='https://teamcapybara.github.io/capybara/'>Capybara</a> · <a href='https://brakemanscanner.org/'>Brakeman</a>"],
    ["Accessibility scanners", "axe, Lighthouse, Pa11y, WAVE and Accessibility Insights scan pages but do not provide a Rails-specific packaging and buyer map. Ariada's wedge is repeatable Rails release evidence.", "<a href='https://www.deque.com/axe/'>axe</a> · <a href='https://pa11y.org/'>Pa11y</a> · <a href='https://wave.webaim.org/'>WAVE</a>"],
    ["Enterprise scanners", "Deque, Siteimprove, Level Access, AudioEye and Evinced sell broader accessibility platforms. Ariada should not outspend them on generic scanning; it should win on developer-owned channel evidence, multi-domain extensibility and artifact discipline.", "<a href='https://www.siteimprove.com/'>Siteimprove</a> · <a href='https://www.levelaccess.com/'>Level Access</a> · <a href='https://www.evinced.com/'>Evinced</a>"],
    ["CI platforms", "GitHub Actions, GitLab CI, CircleCI and Buildkite monetize workflow execution. Ariada should integrate as a job and sell the evidence system, not the CI runner.", "<a href='https://docs.github.com/en/actions'>GitHub Actions</a> · <a href='https://docs.gitlab.com/ee/ci/'>GitLab CI</a> · <a href='https://circleci.com/docs/'>CircleCI docs</a>"],
    ["Hosted compliance layer", "The paid model should mirror buyer risk: retention, baseline policy, signed exports, audit log, SSO/SCIM and domain packs. The wrapper remains a distribution channel, not the product margin center.", "<a href='https://www.w3.org/WAI/standards-guidelines/wcag/'>WCAG</a> · <a href='https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en'>EAA</a> · <a href='https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng'>GDPR</a>"]
  ].map { |k, v, links| "<tr><th scope='row'>#{k}</th><td>#{v}</td><td>#{links}</td></tr>" }.join("\n")

  source_rows = [
    ["Rails framework", "Rails Guides home", "Official source for Rails conventions and developer expectations.", "https://guides.rubyonrails.org/"],
    ["Rails testing", "Testing Rails Applications", "Shows system/integration testing culture and where browser-backed checks fit.", "https://guides.rubyonrails.org/testing.html"],
    ["Rails command line", "Rails Command Line guide", "Rake/Rails task expectations for operational commands.", "https://guides.rubyonrails.org/command_line.html"],
    ["Rails engines", "Getting Started with Engines", "Evidence that reusable Rails functionality is packaged with engine/railtie patterns.", "https://guides.rubyonrails.org/engines.html"],
    ["Rails security", "Rails Security Guide", "Anchor for security-domain extension beyond accessibility.", "https://guides.rubyonrails.org/security.html"],
    ["Rails accessibility", "Rails Accessibility Guide", "Channel-specific accessibility vocabulary and semantic HTML expectations.", "https://guides.rubyonrails.org/accessibility.html"],
    ["Rails GitHub", "rails/rails repository", "Core project issue/discussion surface for framework workflow decisions.", "https://github.com/rails/rails"],
    ["Rails CI issue", "Default GitHub CI workflow issue", "Community/core signal that Rails app checks are expected in CI.", "https://github.com/rails/rails/issues/50502"],
    ["RubyGems", "RubyGems.org", "Primary Ruby package distribution surface.", "https://rubygems.org/"],
    ["RubyGems guides", "Publishing your gem", "Publication and owner credential blocker source.", "https://guides.rubygems.org/publishing/"],
    ["RubyGems MFA", "MFA documentation", "Release-security source for human-owned RubyGems credentials.", "https://guides.rubygems.org/mfa-requirement-opt-in/"],
    ["Bundler", "Bundler docs", "Gemfile/install workflow source.", "https://bundler.io/"],
    ["Bundler groups", "Bundler groups guide", "Source for dev/test/CI dependency placement.", "https://bundler.io/guides/groups.html"],
    ["Rake", "Rake repository", "Rake task implementation reference.", "https://github.com/ruby/rake"],
    ["RSpec", "RSpec docs", "Rails test ecosystem source.", "https://rspec.info/"],
    ["rspec-rails", "rspec-rails repository", "Rails testing gem source and issue surface.", "https://github.com/rspec/rspec-rails"],
    ["Capybara", "Capybara docs", "Browser/system-test culture source.", "https://teamcapybara.github.io/capybara/"],
    ["Selenium", "Selenium docs", "Browser automation source for Rails system test expectations.", "https://www.selenium.dev/documentation/"],
    ["Cuprite", "Cuprite repository", "Alternative Ruby browser driver source.", "https://github.com/rubycdp/cuprite"],
    ["Ferrum", "Ferrum repository", "Ruby Chrome DevTools driver source.", "https://github.com/rubycdp/ferrum"],
    ["Brakeman", "Brakeman scanner", "Rails security scanner competitor/adjacent tool.", "https://brakemanscanner.org/"],
    ["Brakeman GitHub", "presidentbeef/brakeman", "Issue/source surface for Rails security scanning.", "https://github.com/presidentbeef/brakeman"],
    ["bundler-audit", "rubysec/bundler-audit", "Dependency audit culture and Rake task precedent.", "https://github.com/rubysec/bundler-audit"],
    ["Ruby Advisory DB", "ruby-advisory-db", "Security database source used by Ruby dependency tools.", "https://github.com/rubysec/ruby-advisory-db"],
    ["RuboCop", "RuboCop docs", "Ruby lint/check culture source.", "https://docs.rubocop.org/rubocop/"],
    ["Standard Ruby", "Standard Ruby", "Ruby linting alternative and community style signal.", "https://github.com/standardrb/standard"],
    ["Minitest", "Minitest repository", "Rails default-adjacent testing source.", "https://github.com/minitest/minitest"],
    ["Hotwire", "Hotwire", "Rails front-end culture source, relevant to rendered surfaces.", "https://hotwired.dev/"],
    ["Turbo Rails", "turbo-rails", "Rails dynamic rendering surface source.", "https://github.com/hotwired/turbo-rails"],
    ["Stimulus", "Stimulus", "Rails JavaScript sprinkle culture source.", "https://stimulus.hotwired.dev/"],
    ["Importmap Rails", "importmap-rails", "Rails preference for simpler JS packaging source.", "https://github.com/rails/importmap-rails"],
    ["Propshaft", "Propshaft", "Modern Rails asset pipeline source.", "https://github.com/rails/propshaft"],
    ["Sprockets Rails", "sprockets-rails", "Legacy Rails asset pipeline source.", "https://github.com/rails/sprockets-rails"],
    ["Devise", "Devise", "Authentication surface source for protected route scanning.", "https://github.com/heartcombo/devise"],
    ["Pundit", "Pundit", "Authorization source for protected admin/customer flows.", "https://github.com/varvet/pundit"],
    ["Action Cable", "Action Cable overview", "Realtime Rails surface relevant to route coverage and dynamic content.", "https://guides.rubyonrails.org/action_cable_overview.html"],
    ["Active Storage", "Active Storage overview", "File/image surface relevant to accessibility evidence.", "https://guides.rubyonrails.org/active_storage_overview.html"],
    ["Rails I18n", "Rails Internationalization guide", "i18n domain source for EU-facing Rails apps.", "https://guides.rubyonrails.org/i18n.html"],
    ["Rails deployment", "Deploying Rails Applications", "Release context source for CI/release evidence.", "https://guides.rubyonrails.org/deployment.html"],
    ["GitHub Actions Ruby", "setup-ruby action", "CI packaging source for Ruby app workflows.", "https://github.com/ruby/setup-ruby"],
    ["GitHub Actions docs", "GitHub Actions", "CI artifact/upload/pipeline source.", "https://docs.github.com/en/actions"],
    ["GitLab CI Ruby", "GitLab CI examples", "Fallback CI surface.", "https://docs.gitlab.com/ee/ci/examples/"],
    ["CircleCI Ruby", "CircleCI Ruby docs", "Fallback CI surface.", "https://circleci.com/docs/language-ruby/"],
    ["Buildkite Ruby", "Buildkite docs", "Rails-heavy teams may use Buildkite; useful enterprise CI context.", "https://buildkite.com/docs"],
    ["Docker Ruby", "Docker Ruby official image", "Container packaging source.", "https://hub.docker.com/_/ruby"],
    ["Playwright Ruby", "Playwright Ruby client", "Browser runtime source for possible Ruby-native path.", "https://github.com/microsoft/playwright-ruby-client"],
    ["axe-core", "axe-core GitHub", "Underlying accessibility scanning ecosystem source.", "https://github.com/dequelabs/axe-core"],
    ["axe DevTools", "Deque axe DevTools", "Competitor/adjacent enterprise scanner.", "https://www.deque.com/axe/devtools/"],
    ["Pa11y", "Pa11y", "CLI accessibility competitor.", "https://pa11y.org/"],
    ["Lighthouse", "Lighthouse", "Web audit competitor and CI source.", "https://developer.chrome.com/docs/lighthouse/overview"],
    ["WAVE", "WAVE WebAIM", "Accessibility review competitor.", "https://wave.webaim.org/"],
    ["Accessibility Insights", "Microsoft Accessibility Insights", "Manual/automated evidence competitor.", "https://accessibilityinsights.io/"],
    ["Siteimprove", "Siteimprove accessibility", "Enterprise competitor.", "https://www.siteimprove.com/"],
    ["Level Access", "Level Access", "Enterprise accessibility competitor.", "https://www.levelaccess.com/"],
    ["AudioEye", "AudioEye", "Enterprise accessibility competitor.", "https://www.audioeye.com/"],
    ["Evinced", "Evinced", "Developer-focused accessibility competitor.", "https://www.evinced.com/"],
    ["Equalize Digital", "Accessibility Checker", "CMS/plugin accessibility competitor for comparison.", "https://equalizedigital.com/accessibility-checker/"],
    ["W3C WCAG", "WCAG standards", "Accessibility domain authority.", "https://www.w3.org/WAI/standards-guidelines/wcag/"],
    ["WAI testing", "WAI Easy Checks", "Manual review and evidence context.", "https://www.w3.org/WAI/test-evaluate/preliminary/"],
    ["European Commission EAA", "European Accessibility Act", "Buyer/regulatory source.", "https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en"],
    ["AccessibleEU", "EAA comes into effect", "Date/regulatory context source.", "https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en"],
    ["EUR-Lex GDPR", "GDPR Regulation", "Privacy domain source.", "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng"],
    ["OWASP ASVS", "Application Security Verification Standard", "Security-domain extension source.", "https://owasp.org/www-project-application-security-verification-standard/"],
    ["OWASP ZAP", "ZAP", "Security scanner competitor/adjacent tool.", "https://www.zaproxy.org/"],
    ["Security Headers", "SecurityHeaders.com", "Header evidence competitor/source.", "https://securityheaders.com/"],
    ["Mozilla Observatory", "HTTP Observatory", "Header/security evidence source.", "https://developer.mozilla.org/en-US/observatory"],
    ["Core Web Vitals", "web.dev vitals", "Performance-domain source.", "https://web.dev/articles/vitals"],
    ["PageSpeed Insights", "PageSpeed Insights", "Performance competitor/source.", "https://pagespeed.web.dev/"],
    ["Schema.org", "Schema.org", "Structured data/SEO domain source.", "https://schema.org/"],
    ["Google Search Central", "SEO starter guide", "SEO domain source.", "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"],
    ["W3C WSG", "Web Sustainability Guidelines", "Sustainability domain source.", "https://www.w3.org/TR/web-sustainability-guidelines/"],
    ["EU AI Act", "Article 50 transparency", "AI-readiness/provenance domain source.", "https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50"],
    ["Stack Overflow rails", "Stack Overflow ruby-on-rails tag", "Developer pain and implementation question surface.", "https://stackoverflow.com/questions/tagged/ruby-on-rails"],
    ["Stack Overflow Rails accessibility", "Rails accessibility search", "Channel-specific pain search surface.", "https://stackoverflow.com/search?q=%5Bruby-on-rails%5D+accessibility"],
    ["Stack Overflow Rails CI", "Rails CI search", "Pipeline pain search surface.", "https://stackoverflow.com/search?q=%5Bruby-on-rails%5D+github+actions+ci"],
    ["Stack Overflow Rake", "Rails Rake task search", "Rake task pain surface.", "https://stackoverflow.com/search?q=%5Bruby-on-rails%5D+rake+task"],
    ["Reddit rails", "r/rails", "Public Rails community surface.", "https://www.reddit.com/r/rails/"],
    ["Reddit ruby", "r/ruby", "Public Ruby community surface.", "https://www.reddit.com/r/ruby/"],
    ["Reddit Rails Rake task", "Rake task testing thread", "Developer workflow signal for custom tasks.", "https://www.reddit.com/r/rails/comments/1ctfa7q/how_do_you_write_unit_tests_for_rake_tasks_added/"],
    ["Reddit Ruby security", "Security checks for Ruby apps", "Community signal for Brakeman/bundler-audit in CI.", "https://www.reddit.com/r/ruby/comments/r0q7yz/security_checks_for_ruby_apps/"],
    ["Reddit Rails React", "Rails aversion to React", "Channel culture signal: Rails teams debate heavy JS/SPAs versus server-rendered workflows.", "https://www.reddit.com/r/rails/comments/1ip5468/why_does_the_rails_community_have_such_an/"],
    ["HN Rails matters", "Why Ruby on Rails still matters", "Broader community signal on Rails positioning and maturity.", "https://news.ycombinator.com/item?id=43130546"],
    ["HN returning Rails", "Returning to Rails in 2026", "Broader community signal on batteries-included framework appeal.", "https://news.ycombinator.com/item?id=47347064"],
    ["HN Rails 8", "What's New in Ruby on Rails 8", "Broader community signal on modern Rails direction.", "https://news.ycombinator.com/item?id=41766515"],
    ["HN search Rails accessibility", "HN Algolia Rails accessibility", "Weak-signal search surface for buyer/developer discussion.", "https://hn.algolia.com/?q=rails%20accessibility"],
    ["HN search Brakeman", "HN Algolia Brakeman", "Weak-signal search surface for Rails security tool discussion.", "https://hn.algolia.com/?q=brakeman%20rails"],
    ["Ruby Toolbox Rails", "Ruby Toolbox Rails category", "Ecosystem discovery source.", "https://www.ruby-toolbox.com/categories/rails"],
    ["Ruby Toolbox security", "Ruby Toolbox security tools", "Competitor/source discovery for Ruby app checks.", "https://www.ruby-toolbox.com/categories/security"],
    ["Ruby Toolbox testing", "Ruby Toolbox testing tools", "Testing ecosystem discovery source.", "https://www.ruby-toolbox.com/categories/testing_frameworks"],
    ["Thoughtbot RSpec CI", "RSpec Rails GitHub Actions", "Practitioner source for Rails CI test setup.", "https://thoughtbot.com/blog/rspec-rails-github-actions-configuration"],
    ["Thoughtbot testing practices", "Rails testing practices", "Practitioner source for Rails test culture.", "https://thoughtbot.com/blog/a-journey-towards-better-testing-practices"],
    ["GitHub topic Rails", "GitHub Rails topic", "Open-source discovery surface for Rails apps and issues.", "https://github.com/topics/ruby-on-rails"],
    ["GitHub search Rails accessibility", "GitHub issue search", "Pain-mining surface for accessibility issues in Rails repos.", "https://github.com/search?q=rails+accessibility&type=issues"],
    ["GitHub search Rails WCAG", "GitHub issue search WCAG", "Pain-mining surface for WCAG in Rails apps.", "https://github.com/search?q=rails+wcag&type=issues"],
    ["GitHub search Brakeman CI", "GitHub issue search", "Pain-mining surface for CI security scanning.", "https://github.com/search?q=brakeman+ci+rails&type=issues"],
    ["GitHub search bundler audit CI", "GitHub issue search", "Pain-mining surface for dependency audit gates.", "https://github.com/search?q=bundler-audit+ci&type=issues"]
  ].map do |kind, label, use, url|
    "<tr><th scope='row'>#{kind}</th><td><a href='#{url}'>#{label}</a></td><td>#{use}</td><td>Reliability: source-dependent; official docs high, community/search surfaces medium to low and used only for pain language.</td></tr>"
  end.join("\n")

  community_rows = [
    ["Rails official/community GitHub", "Rails core issues and discussions expose workflow decisions around CI, security defaults, framework integration, engines and command-line tasks. Roles: Rails maintainers, framework contributors, senior app developers.", "Strong signal for packaging and CI expectations; weak for buyer budget."],
    ["Stack Overflow", "The <code>ruby-on-rails</code>, <code>rake</code>, <code>capybara</code>, <code>rspec-rails</code> and accessibility searches expose repeated implementation pain. Roles: app developers and maintainers.", "Strong signal for install/task/auth/browser problems; weak for monetization."],
    ["Reddit r/rails and r/ruby", "Public threads show cultural objections: React/SPAs, security checks in CI, Rake task testing, Ruby/Rails relevance, and tooling fatigue. Roles: developers, maintainers, consultants.", "Medium signal; use clusters only, not single anecdotes."],
    ["Hacker News", "HN threads surface broader technical evaluator opinions on Rails maturity, batteries-included frameworks, deployment and framework choice. Roles: founders, senior developers, platform owners.", "Weak-to-medium signal; good for objections and positioning, not factual adoption numbers."],
    ["GitHub issue searches", "Searches across Rails, Brakeman, bundler-audit and accessibility terms show where app teams create public bugs or CI failures. Roles: maintainers, CI owners, security reviewers.", "Medium signal for pain-mining backlog; individual issues need validation before product claims."],
    ["Ruby Toolbox / RubyGems", "Package categories and gem pages show discoverability, competing tools and ecosystem shape. Roles: developers evaluating gems.", "Strong for packaging surface; weak for buyer pain because there are no rich reviews."],
    ["Consultancy blogs", "Thoughtbot and similar practitioner posts show how Rails teams actually wire RSpec, Capybara and CI. Roles: senior Rails developers and consultants.", "Medium signal for implementation guidance; not market proof."],
    ["Accessibility/security vendor docs", "Deque, Pa11y, Brakeman and WAVE docs show what adjacent tools already promise. Roles: reviewers, security engineers, developers.", "Strong for competitor boundary; not Rails-specific unless connected back to Rails workflow."],
    ["CI provider docs", "GitHub Actions, GitLab CI, CircleCI and Buildkite docs show artifact upload, caching and job patterns. Roles: platform/DevOps owners.", "Strong for packaging design; weak for pain unless paired with community threads."],
    ["No-signal surfaces", "RubyGems does not provide marketplace-style reviews; private Slack/Discord channels were not used; social posts behind login are excluded; generic WCAG-only threads are not counted as Rails channel evidence.", "Prevents silent overclaiming. Use public search surfaces and document gaps."]
  ].map { |k, v, d| "<tr><th scope='row'>#{k}</th><td>#{v}</td><td>#{d}</td></tr>" }.join("\n")

  signal_rows = [
    ["1", "Rails developers expect gem/Rake integration", "Rails Guides, Rake, RubyGems, Bundler", "Use RubyGem + Railtie + Rake as primary entrypoint."],
    ["2", "Heavy browser checks belong in explicit commands or CI", "Rails testing guide, Capybara, Selenium, CI posts", "Do not hide Ariada in every unit test or boot path."],
    ["3", "Security checks are already CI-shaped", "Brakeman, bundler-audit, Reddit Ruby security thread, Rails CI issue", "Ariada should join existing CI gates instead of inventing a new release ritual."],
    ["4", "RubyGems credentials are human-owned release assets", "RubyGems publishing/MFA docs", "Publication blocker is real and should remain a human task."],
    ["5", "Protected routes need auth/session support", "Devise, Pundit, Rails security guide", "Next version must support headers/cookies and safe staging targets."],
    ["6", "Rails front end can be server-rendered plus Hotwire", "Hotwire, Turbo, Stimulus, Importmap docs", "Scan rendered URLs and dynamic states; do not assume SPA-only flows."],
    ["7", "Accessibility evidence is not a Rails test replacement", "WCAG, WAI, axe, Pa11y, WAVE", "Position Ariada as evidence/compliance layer."],
    ["8", "CI owners need artifacts and retry policy", "GitHub Actions, GitLab CI, CircleCI, Buildkite docs", "Upload JSON/log/screenshot/report; make failures actionable."],
    ["9", "Agencies and maintainers need multi-app repeatability", "Ruby Toolbox, GitHub topic Rails, community discussions", "Hosted retention and bulk route scan are monetizable."],
    ["10", "Static code security tools do not cover rendered accessibility", "Brakeman and bundler-audit docs", "Ariada complements, not replaces, existing Rails security tools."],
    ["11", "Performance and asset domains are Rails-relevant", "Core Web Vitals, Propshaft, Sprockets, deployment docs", "Add performance domain after accessibility/security/privacy."],
    ["12", "i18n and legal notices matter for EU Rails apps", "Rails I18n, EAA, GDPR", "Add i18n/legal/policy route checks for public/customer portals."],
    ["13", "Community discussions are developer-heavy", "Stack Overflow, Reddit, GitHub", "Buyer interviews still needed for pricing and procurement claims."],
    ["14", "Ruby ecosystem tolerates wrappers when they are honest", "Bundler, Rake, Rails engines, Brakeman", "Call current adapter an MVP bridge, not native scanner core."],
    ["15", "Search surfaces show pain but not revenue", "HN/Reddit/Stack Overflow searches", "Use them for objections and vocabulary; use customer interviews for willingness-to-pay."]
  ].map { |n, s, src, decision| "<tr><th scope='row'>#{n}</th><td>#{s}</td><td>#{src}</td><td>#{decision}</td></tr>" }.join("\n")

  pain_rows = [
    ["Rails accessibility in app repos", "<a href='https://github.com/search?q=rails+accessibility&type=issues'>GitHub issue search</a>, <a href='https://stackoverflow.com/search?q=%5Bruby-on-rails%5D+accessibility'>Stack Overflow search</a>", "Look for keyboard traps, missing labels, ARIA regressions, admin UI issues, form validation problems and reviewer wording."],
    ["Rails WCAG/EAA language", "<a href='https://github.com/search?q=rails+wcag&type=issues'>GitHub WCAG issue search</a>, <a href='https://stackoverflow.com/questions/tagged/wcag'>Stack Overflow WCAG tag</a>", "Extract whether teams say audit, VPAT, public sector, procurement, legal, WCAG AA, EAA, Section 508 or customer blocker."],
    ["Rake task adoption pain", "<a href='https://stackoverflow.com/search?q=%5Bruby-on-rails%5D+rake+task'>Stack Overflow Rake search</a>, <a href='https://www.reddit.com/r/rails/comments/1ctfa7q/how_do_you_write_unit_tests_for_rake_tasks_added/'>Reddit Rake task testing</a>", "Find confusion around task loading, environment variables, Rails.application.load_tasks and test isolation."],
    ["CI gate pain", "<a href='https://github.com/rails/rails/issues/50502'>Rails CI workflow issue</a>, <a href='https://stackoverflow.com/search?q=%5Bruby-on-rails%5D+github+actions+ci'>Stack Overflow Rails CI search</a>", "Find what teams already run, where jobs are slow/flaky, and whether artifact upload is expected."],
    ["Security-adjacent expectations", "<a href='https://www.reddit.com/r/ruby/comments/r0q7yz/security_checks_for_ruby_apps/'>Reddit Ruby security checks</a>, <a href='https://github.com/search?q=brakeman+ci+rails&type=issues'>GitHub Brakeman CI search</a>", "Mine how Brakeman/bundler-audit are configured and how teams handle fail/pass policy."],
    ["Protected route scanning", "<a href='https://github.com/heartcombo/devise/issues'>Devise issues</a>, <a href='https://github.com/varvet/pundit/issues'>Pundit issues</a>", "Find auth/session flows that make scanner setup hard."],
    ["Hotwire/dynamic surfaces", "<a href='https://github.com/hotwired/turbo-rails/issues'>turbo-rails issues</a>, <a href='https://github.com/hotwired/stimulus/issues'>Stimulus issues</a>", "Find dynamic rendering and navigation cases that screenshots or one-page scans may miss."],
    ["Asset/performance pain", "<a href='https://github.com/rails/propshaft/issues'>Propshaft issues</a>, <a href='https://github.com/rails/sprockets-rails/issues'>sprockets-rails issues</a>", "Find asset regressions that connect Rails release evidence to performance and visual review."],
    ["RubyGems publication pain", "<a href='https://guides.rubygems.org/publishing/'>RubyGems publishing guide</a>, <a href='https://guides.rubygems.org/mfa-requirement-opt-in/'>RubyGems MFA guide</a>", "Document account ownership, MFA and push credentials as human blockers."],
    ["Buyer language", "<a href='https://hn.algolia.com/?q=rails%20accessibility'>HN Rails accessibility search</a>, <a href='https://www.reddit.com/r/rails/search/?q=accessibility&restrict_sr=1'>Reddit Rails accessibility search</a>", "Collect whether Rails owners talk about customer portals, audits, procurement or regulatory release risk."],
    ["Competitor comparison", "<a href='https://www.deque.com/axe/devtools/'>axe DevTools</a>, <a href='https://brakemanscanner.org/'>Brakeman</a>, <a href='https://pa11y.org/'>Pa11y</a>", "Map what each tool already solves so Ariada stays narrow: Rails release evidence, not generic app testing."],
    ["No-signal searches", "Private Slack/Discord, closed customer portals, RubyGems reviews, social posts requiring login", "Do not count these unless public archived evidence becomes available."]
  ].map { |k, where, what| "<tr><th scope='row'>#{k}</th><td>#{where}</td><td>#{what}</td></tr>" }.join("\n")

  visual_rows = [
    ["Standalone screenshot", "<a href='screenshots/scan-result.png'>screenshots/scan-result.png</a>", "Real relative PNG exists. Visual review: screenshot is 1280x998, readable, no blank main content, no modal overlay, and shows the Ruby/Rails scan preview with 5 findings, command output and JSON summary."],
    ["Embedded screenshot", "Inline <code>data:image/png</code> in this report", "Useful for single-file review. The separate link remains required because reviewers and audit scripts need a real image artifact."],
    ["What screenshot proves", "Rendered evidence report preview", "It proves that the scan preview page was rendered and captured. It does not prove production Rails route coverage, authenticated app state, responsive/mobile behavior or visual correctness of the original Rails app."],
    ["Visual risk", "Horizontal command output is clipped by the viewport in the screenshot", "Acceptable for this report because the command log is separately linked and the screenshot's purpose is artifact existence/readability. Future screenshots should capture full-width or wrap long command lines."]
  ].map { |k, v, d| "<tr><th scope='row'>#{k}</th><td>#{v}</td><td>#{d}</td></tr>" }.join("\n")

  gate_rows = [
    ["Ruby syntax", "<a href='../test-report/logs/ruby-syntax.log'>ruby-syntax.log</a>", "<a href='../test-report/logs/ruby-syntax.exit'>exit</a>", "Checks library syntax only."],
    ["Rake syntax", "<a href='../test-report/logs/rake-syntax.log'>rake-syntax.log</a>", "<a href='../test-report/logs/rake-syntax.exit'>exit</a>", "Checks task file syntax."],
    ["RSpec", "<a href='../test-report/logs/rspec.log'>rspec.log</a>", "<a href='../test-report/logs/rspec.exit'>exit</a>", "Checks scanner and Rake task behavior."],
    ["Gem build", "<a href='../test-report/logs/gem-build.log'>gem-build.log</a>", "<a href='../test-report/logs/gem-build.exit'>exit</a>", "Checks package buildability, not publication."],
    ["CLI dependency build", "<a href='../test-report/logs/cli-deps-build.log'>cli-deps-build.log</a>", "<a href='../test-report/logs/cli-deps-build.exit'>exit</a>", "Checks shared CLI dependency build."],
    ["Axe rules build", "<a href='../test-report/logs/rules-axe-deps-build.log'>rules-axe-deps-build.log</a>", "<a href='../test-report/logs/rules-axe-deps-build.exit'>exit</a>", "Checks shared accessibility rule dependency build."],
    ["Fixture scan", "<a href='../test-report/logs/fixture-scan.log'>fixture-scan.log</a>", "<a href='../test-report/logs/fixture-scan.exit'>exit</a>", "Allowed non-zero because the fixture intentionally contains findings."]
  ].map { |k, log, exit_link, d| "<tr><th scope='row'>#{k}</th><td>#{log}</td><td>#{exit_link}</td><td>#{d}</td></tr>" }.join("\n")

  second_pass_rows = [
    ["Rails engine boundary", "Keep the first public gem as a Railtie-backed helper, not a mounted Rails engine. A mounted engine would imply routes, controllers, assets and runtime UI inside the host application. Ariada's first job is evidence production, so the right boundary is task registration plus configuration. Add an engine only if v0.3 needs an in-app reviewer dashboard, and even then keep it opt-in so customer portals do not gain surprise routes."],
    ["Rake task contract", "The Rake task should become the stable automation API: <code>bundle exec rake ariada:scan</code> for the default target, plus explicit ENV keys for URL, domains, output directory, CLI path, headers file and cookie file. Do not hide configuration in Rails credentials until the hosted/authenticated mode exists, because CI owners need visible, reviewable job configuration."],
    ["RubyGems release gates", "Before any <code>gem push</code>, require namespace approval, gem owner list review, MFA-enabled RubyGems account, license metadata, changelog, version bump, package contents audit and a dry-run install in a clean app. The report should stay blocked until those human-owned release gates are satisfied; local gem build only proves package shape, not distribution readiness."],
    ["Authenticated staging evidence", "The next implementation should support a safe staging evidence mode with <code>ARIADA_TARGET_URL</code>, optional readiness URL, cookie/header file paths, secret redaction in logs and an allowlist of routes. The scanner must never print raw session cookies, authorization headers or customer identifiers into <code>command.log</code> or HTML reports."],
    ["CI culture decision", "Rails CI jobs often already pay the cost of database setup, asset compilation and system tests. Ariada should run after the app boots and before deployment approval, not before unit tests. The CI recipe should cache Node/browser dependencies, upload artifacts even on findings, and distinguish scanner infrastructure failure from a valid accessibility finding exit."],
    ["Role/payer hook refinement", "Developer hook: one familiar Rake command. CI owner hook: consistent artifacts and policy thresholds across many Rails repos. App owner hook: release evidence for customer-facing portals. Reviewer hook: raw JSON plus screenshot instead of screenshots in chat. Compliance payer hook: retained, signed, cross-release evidence with route coverage and override history."],
    ["Domain competitor decision", "For Rails security, Brakeman and bundler-audit remain the trusted code/dependency gates, so Ariada should focus on rendered headers, cookies, mixed content and evidence bundling. For accessibility, axe/Pa11y/WAVE remain narrow scanners; Ariada should win on Rails packaging, artifact discipline and multi-domain roadmap. For performance, Lighthouse/PageSpeed are strong; Ariada should start with evidence capture and baseline comparison rather than reinventing metrics."],
    ["Community signal decision", "The strongest channel signals are developer and maintainer signals: Rake task loading, CI friction, security-check precedent, protected route complexity and skepticism toward unnecessary JavaScript. Buyer signals are weaker in public Rails forums, so the next research pass should interview Rails agencies, SaaS app owners and public-sector portal maintainers before setting price or claiming willingness to pay."],
    ["Next implementation slice", "Build a Rails demo app fixture with two routes: public marketing page and protected admin-like page. Add a CI example that boots it, injects a non-secret test cookie, scans a route list and uploads artifacts. That single slice proves the exact commercial wedge better than adding more generic source links: authenticated/staging evidence for rendered Rails surfaces."],
    ["What not to build next", "Do not build a Ruby-native scanner core, a Rails middleware that scans every response, a mounted dashboard, or a SaaS upload requirement as the next step. Those choices increase trust and privacy objections before the channel has proven simple adoption. The next work should reduce friction around real app evidence, not expand runtime footprint."]
  ].map { |k, v| "<tr><th scope='row'>#{k}</th><td>#{v}</td></tr>" }.join("\n")

  extended_sections = <<~HTML
    <h2>Channel culture fit: что любит и отвергает Ruby/Rails-аудитория</h2>
    <p>Rails app teams are pragmatic about checks when the check follows Rails conventions. They accept a gem, a Railtie, a namespaced Rake task, environment-variable overrides and CI snippets. They do not want an accessibility scanner to become hidden request middleware, a surprise dependency of every unit test, or a SaaS-only tool that requires exposing protected staging data. The current adapter is therefore a good MVP bridge, but the product claim must stay precise: Ruby/Rails owns the workflow shape, while Ariada core owns scanning.</p>
    <table><thead><tr><th>Culture point</th><th>Ruby/Rails-specific interpretation</th></tr></thead><tbody>#{culture_rows}</tbody></table>

    <h2>Recommended product solution for Ruby/Rails channel</h2>
    <p>The recommended product solution is a thin, free RubyGem plus paid evidence services. The gem gives the Rails developer a familiar command and local artifacts. CI/Docker/hosted workers hide scanner runtime friction. The commercial product starts when evidence has to be retained, compared, signed, exported, routed to reviewers or enforced across many Rails apps.</p>
    <table><thead><tr><th>Decision</th><th>Recommendation</th></tr></thead><tbody>#{solution_rows}</tbody></table>

    <h2>Технические интерфейсы и коннекторы для Rails</h2>
    <p>The connector plan is deliberately boring: Gemfile, Railtie, Rake, CI, Docker and hosted upload. That is what makes it acceptable to Rails maintainers. Anything more surprising should be kept behind explicit configuration.</p>
    <table><thead><tr><th>Connector</th><th>Rails-specific note</th></tr></thead><tbody>#{technical_rows}</tbody></table>

    <h2>Как зарабатывать на Ruby/Rails channel</h2>
    <p>Monetization should not tax the first developer who tries the gem. The paid path begins when Rails evidence becomes organizational memory: repeated releases, many apps, multiple domains, audit trails, reviewer links, signed exports and policy gates. This matches the Rails channel because the app developer can create adoption while the app/platform/compliance owner pays for risk reduction.</p>
    <table><thead><tr><th>Role</th><th>Sales model</th></tr></thead><tbody>#{monetization_rows}</tbody></table>

    <h2>Модели продаж конкурентов в канале</h2>
    <p>Adjacent tools sell testing, static security, dependency audit, accessibility scanning or CI execution. Ariada should avoid claiming to replace them. The narrow product is compliance/evidence orchestration around rendered Rails web surfaces.</p>
    <table><thead><tr><th>Competitor group</th><th>Model and implication</th><th>Sources</th></tr></thead><tbody>#{sales_rows}</tbody></table>

    <h2>Источники и документы</h2>
    <p>This source table mixes high-reliability official docs, medium-reliability practitioner docs and low-to-medium community/search surfaces. Community sources are used only for pain language and adoption objections, not as factual market proof.</p>
    <table><thead><tr><th>Source family</th><th>Source</th><th>How used</th><th>Reliability note</th></tr></thead><tbody>#{source_rows}</tbody></table>

    <h2>Community review sources</h2>
    <p>Signal count target for this Ruby/Rails channel: 10 source families and 15 extracted signals. Official docs are not counted as community review by themselves; they explain packaging norms. The community set is Rails-specific: Rails GitHub, Stack Overflow Rails tags/searches, Reddit Rails/Ruby, Hacker News Rails discussions, GitHub issue searches, Ruby Toolbox/RubyGems discovery, practitioner blogs and adjacent tool issue trackers.</p>
    <table><thead><tr><th>Source family</th><th>Channel-specific evidence</th><th>Product impact</th></tr></thead><tbody>#{community_rows}</tbody></table>

    <h2>Signal count and repeated patterns</h2>
    <p>Repeated patterns strong enough to influence product work: gem/Rake packaging, explicit CI placement, artifact upload, auth/session support and honesty about the shared CLI bridge. Weak anecdotes remain in the research backlog until repeated across more than one source family.</p>
    <table><thead><tr><th>#</th><th>Signal</th><th>Source families</th><th>Product decision</th></tr></thead><tbody>#{signal_rows}</tbody></table>

    <h2>Second-pass Rails implementation decisions</h2>
    <p>This second-pass material is added because the channel should be stronger than Dash in visible substance, not just structurally complete. It focuses on choices a Rails app owner, gem maintainer, CI owner and compliance buyer would actually care about before accepting the channel.</p>
    <table><thead><tr><th>Decision area</th><th>Ruby/Rails-specific decision</th></tr></thead><tbody>#{second_pass_rows}</tbody></table>

    <h2>Где дальше искать боли, роли и отзывы</h2>
    <p>Pain mining should focus on public, repeatable surfaces. The next researcher should collect exact complaint language from Rails app owners, not generic WCAG advice. Queries should distinguish developer pain from payer pain: setup failures, CI friction, accessibility review blocks, protected route scanning and audit evidence retention are different sales motions.</p>
    <table><thead><tr><th>Search lane</th><th>Where / query</th><th>Signals to collect</th></tr></thead><tbody>#{pain_rows}</tbody></table>

    <h2>Проверенная поверхность / tested surface</h2>
    <p>The tested surface is a Ruby-served Rails-like HTML fixture at localhost, scanned through <code>bundle exec rake ariada:scan</code>. This is enough to prove the adapter contract: a Rails-shaped task can call the shared Ariada CLI and produce JSON, command log, screenshot and HTML evidence. It is not enough to claim production Rails coverage, authenticated flows, route discovery, system-test integration, mobile viewport coverage or RubyGems publication.</p>
    <table><thead><tr><th>Surface</th><th>Status</th><th>Evidence</th></tr></thead><tbody>
    <tr><th scope='row'>Local rendered HTML</th><td><span class='status pass'>tested</span></td><td>Served by Ruby WEBrick as a Rails/Rack-style page and scanned by the shared CLI.</td></tr>
    <tr><th scope='row'>Real Rails application</th><td><span class='status block'>not tested</span></td><td>Needs selected app URL, route list, auth/session policy and data exposure approval.</td></tr>
    <tr><th scope='row'>Authenticated admin/customer portal</th><td><span class='status block'>not tested</span></td><td>Needs cookie/header injection and safe staging target.</td></tr>
    <tr><th scope='row'>CI release gate</th><td><span class='status warn'>planned</span></td><td>Command shape exists; official CI snippets and artifact upload recipe remain next work.</td></tr>
    <tr><th scope='row'>RubyGems distribution</th><td><span class='status block'>not tested</span></td><td>Needs founder-owned account and push credentials.</td></tr>
    </tbody></table>

    <h2>Visual evidence review</h2>
    <p>Visual review status: real screenshot file is present and linked. No <code>VISUAL_EVIDENCE_GAP</code> marker is needed for this run. The screenshot is readable and shows the scan preview; it should not be overclaimed as a screenshot of a real production Rails app.</p>
    <table><thead><tr><th>Visual artifact</th><th>Location</th><th>Review note</th></tr></thead><tbody>#{visual_rows}</tbody></table>

    <h2>Какие gates были запущены</h2>
    <p>The report links the existing local gate logs. The audit gate for this task is separate and must be run from the central repo script because this worktree does not currently contain <code>scripts/audit-channel-report.mjs</code>.</p>
    <table><thead><tr><th>Gate</th><th>Log</th><th>Exit</th><th>Interpretation</th></tr></thead><tbody>#{gate_rows}</tbody></table>

    <h2>Мэп на готовые механизмы Ariada и срочные пробелы</h2>
    <table><thead><tr><th>Mechanism</th><th>Current use</th><th>Urgent gap</th></tr></thead><tbody>
    <tr><th scope='row'>Shared scanner CLI</th><td>Used by Ruby wrapper for accessibility findings.</td><td>Expose friendlier install diagnostics when Node/CLI is missing.</td></tr>
    <tr><th scope='row'>Multi-domain report JSON</th><td>Current evidence writes <code>multi-domain-report.json</code>.</td><td>Add security/privacy/performance domains to Rails examples when channel packaging is stable.</td></tr>
    <tr><th scope='row'>HTML evidence report</th><td>This generated report is reviewer-facing channel evidence.</td><td>Keep Dash-plus format in generator so regenerated reports do not regress.</td></tr>
    <tr><th scope='row'>Screenshot capture</th><td>Real PNG is linked and embedded.</td><td>Future capture should include mobile viewport and long command wrapping.</td></tr>
    <tr><th scope='row'>Delivery hub</th><td>Not updated in this detached worktree by instruction scope.</td><td>Coordinator should update hub centrally after accepting the report.</td></tr>
    </tbody></table>

    <h2>Порядок расширения доменов Ariada для Rails</h2>
    <table><thead><tr><th>Order</th><th>Domain</th><th>Why Rails cares</th><th>Status</th></tr></thead><tbody>
    <tr><th scope='row'>1</th><td>Accessibility / EAA / WCAG</td><td>Rails apps often ship forms, admin panels, checkouts and portals where accessibility review blocks release.</td><td>Implemented locally through shared CLI evidence.</td></tr>
    <tr><th scope='row'>2</th><td>Security headers and web-surface security</td><td>Rails owners already run Brakeman/bundler-audit; web-surface evidence completes the release picture.</td><td>Planned channel expansion.</td></tr>
    <tr><th scope='row'>3</th><td>Privacy / GDPR</td><td>Customer portals and analytics/cookie scripts need evidence beyond code tests.</td><td>Planned channel expansion.</td></tr>
    <tr><th scope='row'>4</th><td>Performance / Core Web Vitals</td><td>Asset pipeline, Hotwire/Turbo updates and server-rendered tables can regress user experience.</td><td>Planned after accessibility/security/privacy.</td></tr>
    <tr><th scope='row'>5</th><td>SEO / structured data</td><td>Public Rails marketing/content apps need canonical, metadata, sitemap and schema checks.</td><td>Planned for public surfaces.</td></tr>
    <tr><th scope='row'>6</th><td>i18n / localization</td><td>Rails has mature i18n; EU-facing apps need language, format and fallback evidence.</td><td>Candidate domain.</td></tr>
    <tr><th scope='row'>7</th><td>Legal notices and accessibility statements</td><td>Public/customer apps need policy links, contact paths and statement freshness.</td><td>Candidate domain.</td></tr>
    <tr><th scope='row'>8</th><td>Evidence operations</td><td>Teams need route coverage, artifact freshness, retry/flaky markers and override audit logs.</td><td>Hosted product domain.</td></tr>
    </tbody></table>

    <h2>Каких доменов еще не хватает</h2>
    <table><thead><tr><th>Missing domain</th><th>Rails-specific blocker</th><th>Next evidence needed</th></tr></thead><tbody>
    <tr><th scope='row'>Auth-aware scanning</th><td>Devise/Pundit/session policies vary by app and cannot be guessed safely.</td><td>Header/cookie config, staging-safe documentation and secret handling rules.</td></tr>
    <tr><th scope='row'>Route matrix coverage</th><td>Rails routes may be many and stateful; scanning only one fixture hides gaps.</td><td>Route list input, sitemap import or Rails route discovery with exclusions.</td></tr>
    <tr><th scope='row'>Mobile/responsive evidence</th><td>Current screenshot is desktop only.</td><td>Viewport matrix, screenshot naming and report comparison.</td></tr>
    <tr><th scope='row'>Regression baseline</th><td>A single scan does not distinguish old findings from new release blockers.</td><td>Baseline storage and PR diff report.</td></tr>
    <tr><th scope='row'>Human attestation</th><td>Automated checks do not prove manual review completion.</td><td>Reviewer notes, acknowledgment workflow and export signature.</td></tr>
    </tbody></table>

    <h2>Отличия от конкурентов и где мы лучше/хуже</h2>
    <table><thead><tr><th>Comparison</th><th>Better</th><th>Worse / not our job</th></tr></thead><tbody>
    <tr><th scope='row'>Versus RSpec/Capybara</th><td>Ariada produces compliance evidence artifacts tied to scanner findings.</td><td>RSpec/Capybara remain better for app behavior and custom assertions.</td></tr>
    <tr><th scope='row'>Versus Brakeman/bundler-audit</th><td>Ariada covers rendered web-surface accessibility evidence.</td><td>Static code/dependency vulnerability detection belongs to those tools.</td></tr>
    <tr><th scope='row'>Versus axe/Pa11y direct use</th><td>Ariada packages JSON/log/screenshot/report and channel handoff in one Rails-friendly workflow.</td><td>Raw scanners may be simpler for teams that only need one one-off page check.</td></tr>
    <tr><th scope='row'>Versus enterprise accessibility platforms</th><td>Ariada can land earlier in developer-owned Rails CI and expand multi-domain.</td><td>Large vendors have mature dashboards, services and procurement relationships.</td></tr>
    <tr><th scope='row'>Versus CI platforms</th><td>Ariada defines evidence semantics and reviewer artifacts.</td><td>CI platforms execute jobs better and should remain the runtime substrate.</td></tr>
    </tbody></table>

    <h2>Мэп ролей и болей на текущую реализацию</h2>
    <table><thead><tr><th>Role</th><th>Pain</th><th>Covered now</th><th>Gap</th></tr></thead><tbody>
    <tr><th scope='row'>Rails developer</th><td>Needs one command before PR/release.</td><td>Rake task and local artifacts exist.</td><td>Public gem and install diagnostics.</td></tr>
    <tr><th scope='row'>CI owner</th><td>Needs stable artifact-producing gate.</td><td>Command shape and logs exist.</td><td>Official CI snippets, Docker/action packaging, retry policy.</td></tr>
    <tr><th scope='row'>Reviewer</th><td>Needs proof, not a claim.</td><td>HTML, JSON, command log, screenshot.</td><td>Production route evidence and remediation workflow.</td></tr>
    <tr><th scope='row'>App owner</th><td>Needs release confidence for customer-facing Rails app.</td><td>Positioning and local proof exist.</td><td>Hosted retention and real app scan.</td></tr>
    <tr><th scope='row'>Compliance owner</th><td>Needs audit trail and exports.</td><td>Not implemented beyond local report.</td><td>Paid hosted evidence layer.</td></tr>
    </tbody></table>

    <h2>Направления развития: дизайн, UX, умность, надежность</h2>
    <table><thead><tr><th>Direction</th><th>Current state</th><th>Next version</th></tr></thead><tbody>
    <tr><th scope='row'>Design</th><td>Minimal generated HTML report and scan preview screenshot.</td><td>Readable branded evidence report with route filters, severity grouping and mobile screenshot gallery.</td></tr>
    <tr><th scope='row'>UX</th><td>Explicit Rake task with ENV overrides.</td><td><code>rake ariada:init</code>, CI template generator, route-list config and friendly missing-dependency messages.</td></tr>
    <tr><th scope='row'>Intelligence</th><td>Adapter does not interpret findings beyond shared CLI output.</td><td>Group findings by route/template/component, detect new-versus-existing and suggest owner role.</td></tr>
    <tr><th scope='row'>Reliability</th><td>Local fixture proof only.</td><td>Version matrix for Rails/Ruby, Dockerized scanner, retries, health checks and route coverage metrics.</td></tr>
    <tr><th scope='row'>Distribution</th><td>Local gem metadata exists; public release blocked.</td><td>RubyGems release, changelog, docs page, CI snippets and example Rails app.</td></tr>
    </tbody></table>

    <h2>Ссылки для ревью</h2>
    <table><tbody>
    <tr><th scope='row'>Generated scan evidence</th><td><a href='result.html'>result.html</a></td></tr>
    <tr><th scope='row'>Scan preview</th><td><a href='scan-result-preview.html'>scan-result-preview.html</a></td></tr>
    <tr><th scope='row'>Standalone screenshot</th><td><a href='screenshots/scan-result.png'>screenshots/scan-result.png</a></td></tr>
    <tr><th scope='row'>Raw scanner JSON</th><td><a href='ariada-output/multi-domain-report.json'>ariada-output/multi-domain-report.json</a></td></tr>
    <tr><th scope='row'>Command log</th><td><a href='command.log'>command.log</a></td></tr>
    <tr><th scope='row'>Technical test report</th><td><a href='../test-report/result.html'>../test-report/result.html</a></td></tr>
    </tbody></table>

    <h2>Словарь этого отчета</h2>
    <table><tbody>
    <tr><th scope='row'>Channel</th><td>Ruby/Rails ecosystem path to adoption: RubyGems, Gemfile, Railtie, Rake task, README, CI snippets and Rails app owner review.</td></tr>
    <tr><th scope='row'>Adapter</th><td>The Ruby code in this integration that makes Ariada feel Rails-shaped. It does not contain independent scanner rules.</td></tr>
    <tr><th scope='row'>Evidence pack</th><td>HTML report, raw JSON, command log, screenshot and test-report links that a reviewer can inspect.</td></tr>
    <tr><th scope='row'>MVP bridge</th><td>A practical wrapper over shared Ariada CLI that proves the channel workflow before full native packaging and hosted evidence exist.</td></tr>
    <tr><th scope='row'>Buyer</th><td>The person or team paying for retained, repeatable, governed evidence: platform owner, app owner, compliance owner or agency lead.</td></tr>
    </tbody></table>

    <h2>Self-critique: what this report still does not prove</h2>
    <table><thead><tr><th>Limit</th><th>Why it matters</th><th>Resolution</th></tr></thead><tbody>
    <tr><th scope='row'>No real production Rails app</th><td>The fixture proves integration mechanics, not production route complexity.</td><td>Human must provide safe target or agent must build a richer demo app.</td></tr>
    <tr><th scope='row'>No RubyGems publication</th><td>Distribution remains unproven to external users.</td><td>Founder-owned credentials and release approval required.</td></tr>
    <tr><th scope='row'>No authenticated route proof</th><td>Many valuable Rails apps are behind login.</td><td>Add cookie/header/session support and safe docs.</td></tr>
    <tr><th scope='row'>No buyer validation</th><td>Community research finds pain language, not willingness-to-pay.</td><td>Interview Rails app owners, agencies and compliance leads.</td></tr>
    <tr><th scope='row'>No mobile visual matrix</th><td>Desktop screenshot does not prove responsive accessibility.</td><td>Add viewport matrix and screenshot review checklist.</td></tr>
    </tbody></table>

    <h2>Кто чего ждет дальше</h2>
    <table><tbody>
    <tr><th scope='row'>Agent waits for human</th><td>RubyGems account decision, real Rails URL/auth context, and acceptance that current work remains uncommitted by instruction.</td></tr>
    <tr><th scope='row'>Human waits for agent</th><td>Generated Dash-style report, strict audit output, visual evidence status and blockers.</td></tr>
    <tr><th scope='row'>Coordinator waits for this worktree</th><td>Files ready for review without commit/push; optional central hub update can happen separately.</td></tr>
    <tr><th scope='row'>Reviewer waits for product</th><td>Honest distinction between MVP bridge, planned CI packaging and paid hosted evidence product.</td></tr>
    </tbody></table>

    <h2>Дальнейшая дистрибуция и продвижение</h2>
    <p>Promotion should target Rails owners who already value CI and evidence: agencies, SaaS teams, public-sector portals, fintech/health/customer portals, and teams maintaining many Rails apps. The message is not “another test gem”; it is “attach repeatable accessibility and compliance evidence to the Rails release process you already run.”</p>
    <table><thead><tr><th>Surface</th><th>Message</th><th>Owner</th></tr></thead><tbody>
    <tr><th scope='row'>RubyGems README</th><td>One-command scan, artifacts, CI snippet, blocked/known limitations.</td><td>Developer adoption.</td></tr>
    <tr><th scope='row'>GitHub Action recipe</th><td>Boot Rails app, wait for health URL, scan, upload evidence.</td><td>CI/platform owner.</td></tr>
    <tr><th scope='row'>Docs page</th><td>Explain Rails channel fit, auth options, artifact retention and paid hosted path.</td><td>Product/reviewer.</td></tr>
    <tr><th scope='row'>Agency pitch</th><td>Evidence packs for client Rails estates and accessibility review handoff.</td><td>Consultancy buyer.</td></tr>
    <tr><th scope='row'>Compliance pitch</th><td>Hosted retention, signed exports, baseline policy and multi-domain roadmap.</td><td>Economic buyer.</td></tr>
    </tbody></table>
  HTML

  body = <<~HTML
    <p class="note"><strong>Коротко:</strong> S97 adds a Ruby/Rails distribution channel for Ariada.
    It is a thin adapter over the shared scanner CLI: Rails/Ruby owns route/task ergonomics, Ariada core owns scanning.
    Current state: local Rails-like surface evidence is ready; RubyGems publication and real hosted Rails scan are blocked on human-owned credentials/target.</p>

    <h2>Что такое Ruby/Rails и почему это канал Ariada</h2>
    <table><tbody>#{channel_rows}</tbody></table>

    <h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>
    <table><thead><tr><th>Роль</th><th>Что обещаем</th><th>Что предлагаем</th><th>Кто платит</th><th>Когда заходим</th><th>Статус</th></tr></thead><tbody>#{role_rows}</tbody></table>

    <h2>Что реализовано и что не реализовано</h2>
    <table><thead><tr><th>Поверхность</th><th>Статус</th><th>Деталь</th></tr></thead><tbody>#{implemented_rows}</tbody></table>

    <h2>Доменная карта для Rails</h2>
    <table><thead><tr><th>Домен</th><th>Статус</th><th>Почему важно для Rails</th></tr></thead><tbody>#{domain_rows}</tbody></table>

    <h2>Конкуренты именно в evidence/compliance канале</h2>
    <table><thead><tr><th>Группа</th><th>Кто уже силен</th><th>Щель для Ariada</th></tr></thead><tbody>#{competitor_rows}</tbody></table>

    #{extended_sections}

    <h2>Evidence artifacts</h2>
    <table><tbody>#{artifact_rows}</tbody></table>

    <h2>Насколько адекватен тест</h2>
    <p>Representative host surface: a minimal Rails-like rendered HTML page served by Ruby WEBrick for local evidence.
    This proves the adapter contract: <code>bundle exec rake ariada:scan</code> can point the shared Ariada CLI at a rendered Rails/Rack-style URL and save JSON/log/screenshot/report artifacts.</p>
    <p>It does not prove RubyGems publication, a real production Rails app, authenticated routes, large route matrices, ActiveStorage/assets edge cases or customer data safety.</p>

    <h2>Результат scan</h2>
    <p><strong>#{esc(total)}</strong> finding(s) were reported by the shared scanner CLI.</p>
    #{shot}

    <h2>Command Output</h2>
    <pre>#{esc(read(File.join(SCAN_EVIDENCE, "command.log")).strip)}</pre>

    <h2>Known gaps in this channel</h2>
    <table><tbody>
    <tr><th scope="row">Continuous integration</th><td>No ready-made snippet for Rails applications yet.</td></tr>
    <tr><th scope="row">Coverage</th><td>Route-list scanning and domain passthrough are not exercised; the fixtures do not yet cover security, privacy or performance.</td></tr>
    </tbody></table>

    <h2>Что должен сделать человек дальше</h2>
    <table><tbody>
    <tr><th scope="row">RubyGems release</th><td>Provide/approve RubyGems.org namespace and push credentials if this channel should be published.</td></tr>
    <tr><th scope="row">Production evidence</th><td>Provide a safe deployed Rails URL and auth context if production/staging evidence is required.</td></tr>
    <tr><th scope="row">Review</th><td>Review this report as product/channel evidence. Commit approval is not needed for report-only review unless public push/release/human-attributed history is requested.</td></tr>
    </tbody></table>

    <h2>Дальнейшая дистрибуция</h2>
    <p>Primary distribution is RubyGems package <code>ariada-rails</code>, README quickstart, CI snippets and Rails/Rack examples.
    Promote as “repeatable accessibility/compliance evidence for rendered Rails apps”, not as a replacement for Rails tests.</p>
  HTML
  File.write(File.join(SCAN_EVIDENCE, "result.html"), page("Ariada Ruby/Rails scan evidence", body))
end

build_test_report
build_scan_preview
build_scan_report
