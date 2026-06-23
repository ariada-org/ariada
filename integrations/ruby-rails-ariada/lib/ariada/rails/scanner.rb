require "json"
require "open3"
require "shellwords"

module Ariada
 module Rails
 ScanResult = Struct.new(
:target,
:exit_code,
:stdout,
:stderr,
:report_path,
:total_findings,
 keyword_init: true
) do
 def gate_failed?
 exit_code == 1
 end

 def runtime_failed?
 exit_code.to_i >= 2
 end
 end

 class Scanner
 DEFAULTS = {
 cli_command: "ariada",
 output_dir: "ariada-output",
 browser: "chromium",
 format: "json",
 severity_threshold: "moderate",
 timeout_ms: 30_000,
 domains: []
 }.freeze

 def initialize(options = nil, runner: nil, **keyword_options)
 merged_options = (options || {}).merge(keyword_options)
 @options = DEFAULTS.merge(symbolize_keys(merged_options))
 @runner = runner || method(:run_command)
 end

 def scan(target)
 output_dir = @options.fetch(:output_dir)
 FileUtils.mkdir_p(output_dir)

 stdout, stderr, status = @runner.call(command_for(target))
 report_path, total_findings = read_report_summary(output_dir)

 ScanResult.new(
 target: target,
 exit_code: status.to_i,
 stdout: stdout.to_s,
 stderr: stderr.to_s,
 report_path: report_path,
 total_findings: total_findings
)
 end

 def command_for(target)
 command = Shellwords.split(@options.fetch(:cli_command).to_s)
 command += [
 "scan",
 target.to_s,
 "--format",
 @options.fetch(:format).to_s,
 "--output-dir",
 @options.fetch(:output_dir).to_s,
 "--browser",
 @options.fetch(:browser).to_s,
 "--severity-threshold",
 @options.fetch(:severity_threshold).to_s,
 "--timeout-ms",
 @options.fetch(:timeout_ms).to_s
 ]

 domains = Array(@options[:domains]).compact.reject { |value| value.to_s.empty? }
 command += ["--domains", domains.join(",")] unless domains.empty?
 command
 end

 private

 def run_command(command)
 stdout, stderr, status = Open3.capture3(*command)
 [stdout, stderr, status.exitstatus]
 end

 def read_report_summary(output_dir)
 ["multi-domain-report.json", "scan.json"].each do |name|
 path = File.join(output_dir, name)
 next unless File.exist?(path)

 data = JSON.parse(File.read(path))
 return [path, count_findings(data)]
 end
 [nil, 0]
 end

 def count_findings(data)
 summary = data["summary"] if data.is_a?(Hash)
 return summary["total"].to_i if summary.is_a?(Hash) && summary.key?("total")

 grid = data["grid"] if data.is_a?(Hash)
 if grid.is_a?(Hash)
 return grid.values.sum do |site|
 next 0 unless site.is_a?(Hash)

 site.values.sum { |findings| findings.is_a?(Array) ? findings.length: 0 }
 end
 end

 report = data["report"] if data.is_a?(Hash)
 findings = report["findings"] if report.is_a?(Hash)
 return findings.length if findings.is_a?(Array)
 return findings.values.sum { |value| value.is_a?(Array) ? value.length: 0 } if findings.is_a?(Hash)

 0
 end

 def symbolize_keys(hash)
 hash.each_with_object({}) { |(key, value), memo| memo[key.to_sym] = value }
 end
 end
 end
end
