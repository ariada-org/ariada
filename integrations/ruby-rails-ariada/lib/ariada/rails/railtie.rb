require "ariada/rails"

module Ariada
  module Rails
    class Railtie < ::Rails::Railtie
      rake_tasks do
        load File.expand_path("../../tasks/ariada.rake", __dir__)
      end
    end
  end
end
