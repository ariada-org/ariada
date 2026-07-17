require "fileutils"
require "ariada/rails/configuration"
require "ariada/rails/scanner"
require "ariada/rails/version"

module Ariada
  module Rails
    class << self
      def configuration
        @configuration ||= Configuration.new
      end

      def configure
        yield(configuration)
      end

      def scan(target, options = {})
        Scanner.new(configuration_options.merge(options)).scan(target)
      end

      def configuration_options
        {
          cli_command: configuration.cli_command,
          output_dir: configuration.output_dir,
          browser: configuration.browser,
          format: configuration.format,
          severity_threshold: configuration.severity_threshold,
          timeout_ms: configuration.timeout_ms,
          domains: configuration.domains
        }
      end
    end
  end
end

require "ariada/rails/railtie" if defined?(::Rails::Railtie)
