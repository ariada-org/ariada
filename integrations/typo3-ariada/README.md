# Ariada TYPO3 Extension

TYPO3 12/13 extension that exposes Ariada accessibility scans in two places:

- **Backend module:** Web > Ariada, with a URL form and a simple findings table.
- **CLI command:** `vendor/bin/typo3 ariada:scan https://example.org` for CI.

The extension is intentionally thin. It invokes the Ariada CLI by default and can
optionally call an HTTP scan endpoint; it does not reimplement scanning logic.

## Install

```bash
composer config repositories.ariada-typo3 path integrations/typo3-ariada
composer require ariada/typo3-ariada:@dev
```

For local CLI mode, install the Ariada command somewhere in `PATH`, or set:

```bash
export ARIADA_CLI=/absolute/path/to/ariada
```

For HTTP mode, set:

```bash
export ARIADA_API_URL=https://scanner.example.org
export ARIADA_API_TOKEN=replace-with-your-token
```

## Use

Backend: open **Web > Ariada**, enter a URL, and run the scan.

CLI:

```bash
vendor/bin/typo3 ariada:scan https://example.org
```

The command prints JSON with the scan mode, target, exit code, and findings. It
returns a non-zero exit status when the underlying Ariada scan fails.

## Smoke Test

Run a real TYPO3 13 Composer smoke with Docker:

```bash
bash integrations/typo3-ariada/scripts/smoke-typo3.sh
```

The smoke installs this extension into a temporary TYPO3 project, checks Composer
extension discovery, verifies that `vendor/bin/typo3 list` contains
`ariada:scan`, and runs the command against a mocked Ariada binary.

## Implementation Notes

- Extension metadata follows TYPO3's Composer package convention for
  `typo3-cms-extension` packages and keeps `ext_emconf.php` for TER tooling.
- Backend module registration lives in `Configuration/Backend/Modules.php`.
- The Symfony console command uses the `AsCommand` attribute supported by TYPO3
  12.4+.

Update:
- Author: S8 (subagent)
- Date: 2026-06-22
