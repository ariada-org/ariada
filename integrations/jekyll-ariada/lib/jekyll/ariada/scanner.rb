require "fileutils"
require "json"
require "open3"
require "shellwords"
require "socket"
require "webrick"

module Jekyll
  module Ariada
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

      def initialize(options = {}, runner_arg = nil)
        runner = runner_arg.is_a?(Hash) ? runner_arg[:runner] : runner_arg
        @options = DEFAULTS.merge(options || {})
        @runner = runner || method(:run_command)
      end

      def scan(target)
        output_dir = @options.fetch(:output_dir)
        FileUtils.mkdir_p(output_dir)

        scan_target, server, thread = target_for_cli(target)
        stdout, stderr, status = @runner.call(command_for(scan_target))
        report_path, total_findings = read_report_summary(output_dir)

        ScanResult.new(
          target: target,
          exit_code: status.to_i,
          stdout: stdout.to_s,
          stderr: stderr.to_s,
          report_path: report_path,
          total_findings: total_findings
        )
      ensure
        server&.shutdown
        thread&.join
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

      def target_for_cli(target)
        return [target.to_s, nil, nil] unless File.directory?(target.to_s)

        port = free_port
        logger = WEBrick::Log.new(File::NULL)
        server = WEBrick::HTTPServer.new(
          BindAddress: "127.0.0.1",
          Port: port,
          DocumentRoot: target.to_s,
          Logger: logger,
          AccessLog: []
        )
        thread = Thread.new { server.start }
        sleep 0.3
        ["http://127.0.0.1:#{port}/", server, thread]
      end

      def free_port
        socket = TCPServer.new("127.0.0.1", 0)
        port = socket.addr[1]
        socket.close
        port
      end

      def run_command(command)
        stdout, stderr, status = Open3.capture3(*command)
        [stdout, stderr, status.exitstatus]
      end

      def read_report_summary(output_dir)
        ["multi-domain-report.json", "scan.json"].each do |name|
          path = File.join(output_dir, name)
          next unless File.exist?(path)

          data = JSON.parse(File.read(path, encoding: "UTF-8"))
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

            site.values.sum { |findings| findings.is_a?(Array) ? findings.length : 0 }
          end
        end

        report = data["report"] if data.is_a?(Hash)
        findings = report["findings"] if report.is_a?(Hash)
        return findings.length if findings.is_a?(Array)
        return findings.values.sum { |value| value.is_a?(Array) ? value.length : 0 } if findings.is_a?(Hash)

        0
      end
    end
  end
end
