Gem::Specification.new do |spec|
  spec.name = "ariada-rails"
  spec.version = "0.1.0"
  spec.authors = ["Alexander Brichkin (Agonist Development AB)"]
  spec.email = ["git@ariada.org"]

  spec.summary = "Ruby and Rails wrapper for the Ariada scanner CLI"
  spec.description = "Provides a Ruby scanner wrapper, rake task, and Rails Railtie that delegate scans to @ariada-org/cli."
  spec.homepage = "https://github.com/ariada-org/ariada/tree/main/integrations/ruby-rails-ariada"
  spec.license = "EUPL-1.2"
  spec.required_ruby_version = ">= 2.6.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage

  spec.files = Dir[
    "README.md",
    "LICENSE*",
    "lib/**/*.rb",
    "lib/**/*.rake"
  ]
  spec.require_paths = ["lib"]

  spec.add_dependency "rake", "~> 13.0"

  spec.add_development_dependency "bundler", ">= 1.17", "< 3.0"
  spec.add_development_dependency "rspec", "~> 3.13"
end
