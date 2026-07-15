# TYPO3 Smoke Evidence

Last local smoke run: 2026-06-22.

Command shape:

```bash
bash integrations/typo3-ariada/scripts/smoke-typo3.sh
```

The smoke creates a temporary TYPO3 13 project in `/tmp`, installs this extension
as a Composer path repository, and uses a mocked `ariada` executable so the test
proves the extension boundary without requiring a live scanner binary.

Evidence from the local run:

```text
Installing typo3/cms-base-distribution (v13.4.1)
Locking typo3/cms-core (v13.4.32)
Installing ariada/typo3-ariada: Symlinking from /repo/integrations/typo3-ariada
EXTENSION_DISCOVERED
TYPO3 CMS 13.4.32 (Application Context: Production) - PHP 8.3.31
ariada:scan             Run an Ariada accessibility scan for a URL.
{
    "mode": "cli",
    "target": "https://example.org",
    "exitCode": 0,
    "findings": [
        {
            "ruleId": "mock-rule",
            "severity": "minor",
            "message": "mock finding"
        }
    ]
}
SMOKE_PASS
```
