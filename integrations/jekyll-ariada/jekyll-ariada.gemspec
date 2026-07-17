Gem::Specification.new do |spec|
  spec.name = "jekyll-ariada"
  spec.version = "0.1.0"
  spec.authors = ["Alexander Brichkin (Agonist Development AB)"]
  spec.email = ["git@ariada.org"]

  spec.summary = "Jekyll post-build wrapper for the Ariada scanner CLI"
  spec.description = "Registers a Jekyll post_write hook that delegates built-site scans to @ariada-org/cli."
  spec.homepage = "https://github.com/ariada-org/ariada/tree/main/integrations/jekyll-ariada"
  spec.license = "EUPL-1.2"
  spec.required_ruby_version = ">= 2.6.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage

  spec.files = Dir[
    "README.md",
    "lib/**/*.rb"
  ]
  spec.require_paths = ["lib"]

  spec.add_development_dependency "bundler", ">= 1.17", "< 3.0"
  spec.add_development_dependency "jekyll", "~> 4.3"
  spec.add_development_dependency "minitest", "~> 5.0"
  spec.add_development_dependency "rake", "~> 13.0"
end
