require "jekyll/ariada/configuration"
require "jekyll/ariada/scanner"
require "jekyll/ariada/version"

module Jekyll
  module Ariada
    class << self
      def run(site, runner: nil)
        config = Configuration.from_site(site)
        return nil unless config.enabled

        scanner = Scanner.new(config.to_h, runner: runner)
        result = scanner.scan(config.target)
        log_result(result)

        if config.gate && result.exit_code.to_i != 0
          raise Jekyll::Errors::FatalException, "Ariada scan failed for #{result.target} with exit #{result.exit_code}"
        end

        result
      end

      def log_result(result)
        logger = Jekyll.logger
        if result.exit_code.to_i.zero?
          logger.info "Ariada:", "scan passed for #{result.target}"
        else
          logger.warn "Ariada:", "scan reported #{result.total_findings} finding(s) for #{result.target}"
        end
      end
    end
  end
end

if defined?(Jekyll::Hooks)
  Jekyll::Hooks.register :site, :post_write do |site|
    Jekyll::Ariada.run(site)
  end
end
