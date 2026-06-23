<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# Ariada Symfony Bundle

Symfony bundle for running Ariada accessibility scans from `bin/console`.
The bundle adds an `ariada:scan {url?}` command, reads defaults from Symfony
configuration, and delegates scanning to the shared `@ariada-org/cli`.

The bundle does not implement scanner rules. It is a thin Symfony distribution
channel around the shared Ariada command-line scanner.

## Install

```bash
composer require ariada/symfony-ariada
npm install -g @ariada-org/cli
python -m playwright install chromium
```

Enable the bundle if Symfony Flex does not do it automatically:

```php
// config/bundles.php
return [
 Ariada\Symfony\AriadaSymfonyBundle::class => ['all' => true],
];
```

## Configure

```yaml
# config/packages/ariada.yaml
ariada_symfony:
 default_url: 'http://127.0.0.1:8000/'
 cli_command: 'ariada'
 output_dir: '%kernel.project_dir%/var/ariada-output'
 browser: 'chromium'
 severity_threshold: 'moderate'
 timeout_ms: 30000
 domains: ['accessibility']
```

## Use

```bash
bin/console ariada:scan
bin/console ariada:scan https://example.test --domains accessibility,privacy
bin/console ariada:scan http://127.0.0.1:8000/admin --output-dir var/ariada-output
```

The command exits with the same code as `ariada scan`, except `--no-fail` maps
policy findings to exit code `0` while preserving runtime failures.

## Local Verification

```bash
composer install
composer validate --strict
vendor/bin/phpunit
```

Packagist publication requires the maintainer-owned Packagist account and
release credentials.
