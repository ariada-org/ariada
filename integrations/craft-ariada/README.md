# Ariada for Craft CMS

Craft 5 plugin scaffold for scanning rendered entry URLs through the existing
Ariada CLI or hosted scan API.

## What It Does

- Registers a Craft plugin named `Ariada Accessibility Scan`.
- Provides a service that builds a rendered entry URL from site base URL and
  entry URI.
- Delegates scanning to a local CLI command or hosted endpoint.

## Local Verification

```sh
node scripts/validate-structure.mjs
php -l src/Plugin.php
```

## Host Blocker

Craft install, control-panel utility smoke, Composer install, and Craft Plugin
Store submission require PHP/Composer/Craft credentials on the test machine.
