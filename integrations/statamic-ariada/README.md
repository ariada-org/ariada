# Ariada for Statamic

Statamic addon scaffold for scanning rendered entry URLs through the Ariada CLI
or hosted API.

## What It Does

- Provides a Statamic addon service provider.
- Resolves the rendered URL for an entry.
- Builds an Ariada scan request for a control-panel utility or entry action.

## Local Verification

```sh
node scripts/validate-structure.mjs
php -l src/ServiceProvider.php
```

## Host Blocker

Composer install, Statamic control-panel smoke, and Marketplace submission need
PHP/Composer/Statamic credentials on the host machine.
