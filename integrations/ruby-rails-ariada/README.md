<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# Ariada Ruby/Rails Adapter

Ruby gem and Rails Railtie for running Ariada accessibility scans from Ruby
projects. The adapter provides:

- a framework-agnostic `Ariada::Rails::Scanner` class;
- a `rake ariada:scan` task for Rails and plain Ruby projects;
- a Rails Railtie that loads the task when Rails is present.

The adapter shells out to the shared `@ariada-org/cli`. It does not implement
scanner rules.

## Install

```bash
gem install ariada-rails
npm install -g @ariada-org/cli
python -m playwright install chromium
```

For local development from this repository:

```ruby
gem "ariada-rails", path: "integrations/ruby-rails-ariada"
```

## Rails Usage

Configure targets in an initializer:

```ruby
Ariada::Rails.configure do |config|
  config.cli_command = "ariada"
  config.targets = ["/", "/checkout"]
  config.domains = ["accessibility"]
  config.output_dir = "tmp/ariada-output"
end
```

Run a scan:

```bash
ARIADA_TARGET=http://127.0.0.1:3000/checkout bundle exec rake ariada:scan
```

CI overrides are available without a Rails initializer:

```bash
ARIADA_TARGET=http://127.0.0.1:3000/checkout \
ARIADA_CLI="ariada" \
ARIADA_OUTPUT_DIR=tmp/ariada-output \
ARIADA_DOMAINS=accessibility,privacy \
bundle exec rake ariada:scan
```

The task exits non-zero when the Ariada CLI reports gate violations. In CI, run
it after starting the Rails server or point `ARIADA_TARGET` at a deployed review
app URL.

## Plain Ruby Usage

```ruby
scanner = Ariada::Rails::Scanner.new(output_dir: "ariada-output")
result = scanner.scan("https://example.test")
abort "Ariada violations: #{result.total_findings}" if result.gate_failed?
```

## Local Verification

```bash
bundle install
bundle exec rspec
gem build ariada-rails.gemspec
```

RubyGems publication requires the founder-owned RubyGems.org account and `gem
push` credentials. This branch builds the gem locally only.
