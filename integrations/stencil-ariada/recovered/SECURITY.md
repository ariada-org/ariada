# Security

Report suspected vulnerabilities through the security contact documented by the
ariada.org project. Do not include secrets or private target URLs in public issues.

## Browser policy

No browser download is permitted. Installation and packaging use
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and `--ignore-scripts`. Runtime scans require
an explicitly pre-provisioned browser cache through `PLAYWRIGHT_BROWSERS_PATH`.

## Trust boundaries

- Harness and report paths are constrained to Stencil `rootDir`.
- Reports cannot overlap the served `www` output.
- The static server binds only to ephemeral `127.0.0.1`, rejects traversal and
  symlink escapes, disables caching, and closes in `finally`.
- Stencil usage examples are project-authored executable browser content. Audit
  only trusted component repositories.
- Scanner output is parsed fail-closed. Schema identity, URL, summary counts,
  analyzer presence, AX tree presence, and process/report exits must agree.
- There is no shell execution, postinstall hook, remote upload, credential input,
  or public listener.

## Supply chain

All direct dependency versions are exact. The publish tarball bundles the full
runtime graph. The source lock resolves the two unavailable Ariada packages from
committed vendor tarballs; those build inputs are excluded from the distributable.
The empty-cache offline consumer test proves that installation does not depend on
registry access or lifecycle scripts.
