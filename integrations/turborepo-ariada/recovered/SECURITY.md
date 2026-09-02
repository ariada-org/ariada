# Security

## Runtime boundary

- URL mode accepts only absolute HTTP(S) URLs without embedded credentials.
- Ariada's private-network guard remains enabled for URL mode.
- HTML mode accepts only a regular file inside the current package, limits it
  to 5 MiB, and serves only `/` on `127.0.0.1` for the duration of the scan.
- Output must remain inside the current package and is written atomically with
  owner-only temporary-file permissions.
- Diagnostic capture is bounded and no page content or credentials are logged.

## Browser supply

This integration does not ship browser executables. Source, package, consumer,
CI, and acceptance commands set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Actual
gates require a pre-provisioned compatible cache through
`PLAYWRIGHT_BROWSERS_PATH`; absence is a failed prerequisite, never a download
fallback.

## Dependency and artifact gates

Run `npm run security` before release. Production dependencies are audited at
high severity, all shipped dependency specifiers are exact semver, the complete
closure is bundled, local protocols are rejected, and an empty-cache offline
consumer must pass `npm ls --all` with lifecycle scripts disabled.

Report vulnerabilities through the Ariada repository's private security
reporting channel. Do not include live credentials or private target content.

