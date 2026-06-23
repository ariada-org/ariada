require "spec_helper"

RSpec.describe Ariada::Rails::Scanner do
 def write_report(dir, total:)
 FileUtils.mkdir_p(dir)
 File.write(
 File.join(dir, "scan.json"),
 JSON.pretty_generate("summary" => { "total" => total }, "report" => { "findings" => [] })
)
 end

 it "builds an ariada scan command for a URL target" do
 scanner = described_class.new(
 cli_command: "bundle exec ariada",
 output_dir: "tmp/out",
 domains: %w[accessibility privacy]
)

 expect(scanner.command_for("https://example.test")).to eq(
 [
 "bundle",
 "exec",
 "ariada",
 "scan",
 "https://example.test",
 "--format",
 "json",
 "--output-dir",
 "tmp/out",
 "--browser",
 "chromium",
 "--severity-threshold",
 "moderate",
 "--timeout-ms",
 "30000",
 "--domains",
 "accessibility,privacy"
 ]
)
 end

 it "returns a gate failure result when the shared CLI exits with violations" do
 Dir.mktmpdir("ariada-rails-spec") do |dir|
 write_report(dir, total: 2)
 runner = lambda do |_command|
 ["Wrote #{dir}/scan.json\n", "", 1]
 end

 result = described_class.new(output_dir: dir, runner: runner).scan("https://example.test")

 expect(result.gate_failed?).to be(true)
 expect(result.runtime_failed?).to be(false)
 expect(result.total_findings).to eq(2)
 expect(result.report_path).to end_with("scan.json")
 end
 end

 it "counts multi-domain report grid findings" do
 Dir.mktmpdir("ariada-rails-grid-spec") do |dir|
 FileUtils.mkdir_p(dir)
 File.write(
 File.join(dir, "multi-domain-report.json"),
 JSON.generate(
 "grid" => {
 "https://example.test" => {
 "accessibility" => [{ "ruleId" => "image-alt" }],
 "security" => [{ "ruleId" => "csp" }]
 }
 }
)
)

 result = described_class.new(output_dir: dir, runner: ->(_command) { ["", "", 0] }).scan("/")

 expect(result.total_findings).to eq(2)
 expect(result.report_path).to end_with("multi-domain-report.json")
 end
 end
end
