# Ariada for PHP Composer and Laravel

Composer package scaffold for running Ariada accessibility scans from Laravel
release workflows.

## What It Does

- Provides a Laravel service provider with auto-discovery.
- Adds `php artisan ariada:scan {url?}` for CI and local release review.
- Wraps the shared `@ariada-org/cli` instead of reimplementing scanner logic in PHP.
- Keeps the core scanner wrapper framework-neutral so plain PHP or future Symfony
 package code can use the same command-building behavior.
- Ships PHPUnit/Testbench coverage for JSON parsing, command construction, and
 Artisan output.

## Install

```sh
composer require ariada/laravel-accessibility
php artisan vendor:publish --tag=ariada-config
```

Install the shared Ariada CLI separately:

```sh
pnpm add -g @ariada-org/cli
```

or point Laravel at a repository build:

```env
ARIADA_CLI_BINARY="node /path/to/ariada/packages/ariada-cli/dist/bin.js"
ARIADA_BASE_URL="https://app.example.test"
ARIADA_DOMAINS="accessibility"
ARIADA_SEVERITY_THRESHOLD="serious"
```

## Usage

```sh
php artisan ariada:scan
php artisan ariada:scan https://app.example.test/dashboard
php artisan ariada:scan https://app.example.test/dashboard --format=json --threshold=critical
```

Exit code `0` means the configured gate passed. Exit code `1` means Ariada
found release-blocking evidence at or above the configured threshold.

## Local Verification

Expected gates when PHP and Composer are available:

```sh
composer validate
composer install
vendor/bin/phpunit
vendor/bin/pint --test
node scripts/validate-structure.mjs
node scripts/generate-evidence.mjs
```

The current build environment used for this stream does not expose `php` or
`composer` in `PATH`, so Composer resolution, PHPUnit, Laravel Testbench, and
Pint must be rerun on a PHP-enabled host before Packagist submission.

## Evidence

`scan-evidence/result.html` is a self-contained evidence report. It uses a
representative Laravel Blade-style dashboard fixture, runs the real shared
Ariada CLI when Node workspace dependencies are present, and embeds a screenshot
of the scan evidence page.

## Human Gate

Publishing remains blocked on founder-controlled Packagist steps:

- Packagist account access.
- Repository submission under the chosen package namespace.
- Release tag and package metadata confirmation.
