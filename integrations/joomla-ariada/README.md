# Ariada for Joomla

Joomla 5 administrator component for running Ariada scans from a CMS admin
surface. The component is intentionally thin: it stores scan settings, invokes
the configured Ariada CLI or a compatible hosted scan endpoint, and renders the
latest JSON report in Joomla administrator.

## Package

Build the installable package from this directory:

```sh
zip -r com_ariada.zip com_ariada.xml admin media
```

Install `com_ariada.zip` through Joomla administrator or with Joomla CLI
extension installation tooling.

## Configuration

Open System -> Manage -> Extensions -> Ariada -> Options and set:

- Target URL: public `http` or `https` page to scan.
- Execution mode: `Auto`, `Local CLI`, or `Hosted HTTP`.
- CLI binary: defaults to `ariada`.
- Domains: comma-separated Ariada domain IDs.
- Hosted endpoint and API key: only required for hosted mode.

Local mode expects `proc_open` to be available and an `ariada` executable on
`PATH`, for example from `@ariada-org/cli`. Hosted mode signs the request body
with HMAC-SHA256 and sends only the configured URL, domains, and threshold to
the configured endpoint.

## Smoke Test

The minimum stream acceptance gate is a real Joomla 5 installation smoke:

1. Download or boot Joomla 5.
2. Install `com_ariada.zip`.
3. Confirm the Ariada component appears in the administrator component list.
4. Configure a target URL and run a scan from the Ariada administrator page.

## License

GPL-2.0-or-later.
