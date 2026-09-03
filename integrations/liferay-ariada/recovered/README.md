# Ariada Liferay packed runtime

`ariada-org-liferay-runtime-1.0.0.tgz` is an immutable npm packed artifact.
It contains the real Ariada CLI, core engine, Playwright adapter, rules-axe,
Playwright library, and their runtime dependencies. It intentionally contains
no browser executable.

The OSGi JAR embeds this tarball and extracts it to the bundle data directory
after validating `SHA256SUMS`. Consumers need Node.js 22 and a separately
provisioned Playwright Chromium. No npm install or browser download runs in
Liferay.

`scripts/build-runtime.sh` is a repository maintainer command. It packs the
canonical monorepo packages, rejects local protocols from the resulting
artifact, and assembles bundled dependencies with lifecycle scripts disabled.
The normal Gradle consumer build only verifies and embeds the committed
artifact; it does not use the pnpm workspace.

