$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "fileutils"
require "json"
require "minitest/autorun"
require "ostruct"
require "tmpdir"

module Jekyll
  module Errors
    class FatalException < StandardError; end
  end

  def self.logger
    @logger ||= Object.new.tap do |logger|
      def logger.info(*); end
      def logger.warn(*); end
    end
  end
end

require "jekyll/ariada/configuration"
require "jekyll/ariada/scanner"
