module Jekyll
  module Ariada
    class Configuration
      DEFAULTS = {
        "enabled" => true,
        "gate" => true,
        "cli_command" => "ariada",
        "output_dir" => "ariada-output",
        "browser" => "chromium",
        "format" => "json",
        "severity_threshold" => "moderate",
        "timeout_ms" => 30_000,
        "domains" => []
      }.freeze

      attr_reader :enabled,
                  :gate,
                  :cli_command,
                  :output_dir,
                  :browser,
                  :format,
                  :severity_threshold,
                  :timeout_ms,
                  :domains,
                  :target

      def self.from_site(site)
        raw = site.config.fetch("ariada", {})
        data = DEFAULTS.merge(raw || {})
        data["cli_command"] = ENV["ARIADA_CLI"] if ENV["ARIADA_CLI"] && !ENV["ARIADA_CLI"].empty?
        data["output_dir"] = ENV["ARIADA_OUTPUT_DIR"] if ENV["ARIADA_OUTPUT_DIR"] && !ENV["ARIADA_OUTPUT_DIR"].empty?
        data["target"] ||= site.dest
        new(data)
      end

      def initialize(data)
        @enabled = truthy?(data.fetch("enabled"))
        @gate = truthy?(data.fetch("gate"))
        @cli_command = data.fetch("cli_command").to_s
        @output_dir = data.fetch("output_dir").to_s
        @browser = data.fetch("browser").to_s
        @format = data.fetch("format").to_s
        @severity_threshold = data.fetch("severity_threshold").to_s
        @timeout_ms = data.fetch("timeout_ms").to_i
        @domains = Array(data.fetch("domains")).map(&:to_s).reject(&:empty?)
        @target = data.fetch("target").to_s
      end

      def to_h
        {
          cli_command: cli_command,
          output_dir: output_dir,
          browser: browser,
          format: format,
          severity_threshold: severity_threshold,
          timeout_ms: timeout_ms,
          domains: domains
        }
      end

      private

      def truthy?(value)
        ![false, "false", "0", 0, nil].include?(value)
      end
    end
  end
end
