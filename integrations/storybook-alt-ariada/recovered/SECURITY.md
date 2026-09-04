# Security

Report suspected vulnerabilities through the security contact documented by the
ariada.org project. Do not include secrets or private story URLs in public
issues.

## Browser policy

No browser download is permitted. Installation and packaging use
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and `--ignore-scripts`. Runtime scans require
an explicitly pre-provisioned browser through `PLAYWRIGHT_BROWSERS_PATH`.

## Trust boundaries

- The local static server binds only to ephemeral `127.0.0.1`, rejects traversal
  and symlink escapes, disables caching, and closes in `finally`.
- Histoire manifests accept only same-origin absolute paths and cap input at 5 MB.
- Ladle metadata is fetched with a timeout, status check, and 5 MB body cap.
- Story IDs are validated and sanitized before becoming report directories.
- Histoire and Ladle stories are executable project-authored browser code. Scan
  only trusted component repositories.
- Readiness is fail-closed for locally served builds. A missing marker or timeout
  is a runner error, not a silent scan.
- Scanner output is fail-closed: schema, URL, summary counts, analyzer, AX tree,
  and process/report exits must agree.
- There is no shell execution, public listener, upload, credential input,
  preinstall, or postinstall hook.

## Supply chain

All direct dependency versions are exact. The publish tarball bundles the full
Ariada runtime graph but not optional Histoire or Ladle peers. Source installation
uses checksummed package-local tarballs only for unpublished Ariada inputs. The
empty-cache packed consumer proves installation without registry access or
lifecycle scripts.
