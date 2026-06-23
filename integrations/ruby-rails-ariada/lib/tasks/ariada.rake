require "ariada/rails"

namespace :ariada do
  desc "Run Ariada scan for ARIADA_TARGET or configured Rails targets"
  task :scan do
    target = ENV["ARIADA_TARGET"] || Ariada::Rails.configuration.targets.first
    abort "Set ARIADA_TARGET or Ariada::Rails.configuration.targets" unless target

    result = Ariada::Rails.scan(target)
    puts result.stdout unless result.stdout.empty?
    warn result.stderr unless result.stderr.empty?
    abort "Ariada scan failed for #{target} with exit #{result.exit_code}" if result.exit_code.to_i != 0
  end
end
