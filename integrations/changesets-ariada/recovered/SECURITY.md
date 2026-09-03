# Security

## Process and network boundary

The hook resolves the Ariada CLI from its own installed package and launches it
with Node argument arrays and `shell: false`. Targets must be HTTP(S). The hook
rejects private and loopback literal targets unless the operator deliberately passes
`--allow-private`, which is intended for controlled local fixtures and preview
infrastructure.

Child output is bounded. Operational scanner failures block release. Reports do not
copy environment variables, response bodies, credentials, or browser paths.
Changelog writes use a temporary sibling and atomic rename.

## Supply chain

The source project has no Ariada production dependency declarations or lifecycle
installers. The publish tarball contains an exact-version bundled runtime closure,
and the package gate proves it using an empty-cache offline install with lifecycle
scripts disabled. Package and dependency inventories are sorted and paired with a
deterministic tarball checksum.

Playwright browser binaries are not distributed. Set
`PLAYWRIGHT_BROWSERS_PATH` to a browser cache provisioned by the execution
environment. The package and its CI never invoke a browser downloader.

## Credentials and disclosure

The hook needs no registry or hosted-service credential to scan. Publication
credentials belong in the release platform's secret store and must never be added
to package configuration, reports, examples, or artifacts. Report vulnerabilities
through the repository's private security-reporting process.
