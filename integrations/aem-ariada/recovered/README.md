# Ariada AEM packed runtime

This private npm artifact is embedded in the AEM OSGi bundle. It contains the
real Ariada CLI, core engine, Playwright adapter, rules-axe analyzer, axe-core,
Playwright, and their production dependency closure at exact versions.

It contains no browser binary and has no install lifecycle. The AEM host must
provide Node 22 or newer and a compatible Chrome/Chromium installation.

Use `--browser-executable-path`, `ARIADA_AEM_BROWSER_EXECUTABLE`, or the
compatible fallback `ARIADA_EXISTING_CHROMIUM_EXECUTABLE` to select an existing
Chromium executable. An executable path and `--browser-channel` are mutually
exclusive. The runtime validates executable access before Playwright launch.
