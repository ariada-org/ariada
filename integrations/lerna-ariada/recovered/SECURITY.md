# Security

## Supported version

Security fixes target the current `0.1.x` line until a stable release policy is
published.

## Runtime boundary

The integration only orchestrates the installed Ariada CLI. It accepts HTTP(S)
targets, passes arguments without a shell, binds test infrastructure to loopback,
forces browser download suppression, validates every JSON artifact, and writes
package reports beneath the selected report root. It does not accept credentials
or execute report content.

Treat target URLs as potentially sensitive CI metadata. Use protected CI variables
for private preview URLs and do not commit signed query strings. Never place event
bus tokens, registry credentials, browser profiles or cookies in this package.

## Reporting

Report vulnerabilities privately to `security@ariada.org`. Do not include active
credentials or customer data in a report.
