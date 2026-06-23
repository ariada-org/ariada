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
 File.exist?(path) ? File.read(path, encoding: "UTF-8"): ""
end

def exit_status(name)
 read(File.join(TEST_REPORT, "logs", "#{name}.exit")).strip
end

def status_for(name, allowed: ["0"])
 allowed.include?(exit_status(name)) ? "pass": "fail"
end

def shell_log(name)
 text = read(File.join(TEST_REPORT, "logs", "#{name}.log")).strip
 text.empty? ? "(no output)": text
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

 site.values.sum { |findings| findings.is_a?(Array) ? findings.length: 0 }
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
 <pre>#{esc(command.empty? ? "(no command output)": command)}</pre>
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
 "<figure><img alt='Screenshot of the Ariada Ruby/Rails scan result' src='data:image/png;base64,#{encoded}'><figcaption>Browser screenshot of the real scan result preview.</figcaption></figure>"
 else
 "<p><strong>Evidence gap:</strong> screenshot file was not produced.</p>"
 end

 body = <<~HTML
 <p>Representative host surface: a minimal Rails-like rendered HTML page served by Ruby WEBrick for local evidence.</p>
 <p>Scanner path: <code>rake ariada:scan</code> to <code>@ariada-org/cli</code>; no scanner rules are implemented in Ruby.</p>
 <p><strong>#{esc(total)}</strong> finding(s) were reported by the shared scanner CLI.</p>
 #{shot}
 <h2>Command Output</h2>
 <pre>#{esc(read(File.join(SCAN_EVIDENCE, "command.log")).strip)}</pre>
 <h2>Host Blockers</h2>
 <p>RubyGems publication requires the founder-owned RubyGems.org account and <code>gem push</code> credentials. Local Rails/Rack-style scan evidence is complete.</p>
 HTML
 File.write(File.join(SCAN_EVIDENCE, "result.html"), page("Ariada Ruby/Rails scan evidence", body))
end

build_test_report
build_scan_preview
build_scan_report
