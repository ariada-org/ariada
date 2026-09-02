# Ariada Sitecore scanner runtime

This package is embedded inside the Sitecore module. It contains the real
`@ariada-org/cli`, core scanner, Playwright adapter, axe rule adapter, and their
runtime dependency graph. The package is staged with exact semver dependencies,
packed with bundled dependencies, and installed by the package gate using an
empty npm cache in offline mode.

The Sitecore CM invokes `bin/sitecore-scan.mjs` directly with Node. No npm
install, `npx`, workspace, registry lookup, postinstall, or lifecycle script is
used on the Sitecore host. Playwright browser binaries are an administrator-
provisioned host prerequisite and are deliberately not duplicated in this
platform-neutral package.

