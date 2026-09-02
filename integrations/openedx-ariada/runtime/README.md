# Open edX Ariada packed runtime

This private distribution is embedded in the Python wheel. It contains the real
Ariada CLI, core engine and Playwright adapter, axe rules package, and Playwright
library. Every runtime root is exact semver and included with npm
`bundleDependencies`.

It has no install script and contains no browser executable. Consumers invoke
`bin/scan.mjs` with Node 22 and an already-installed browser.

