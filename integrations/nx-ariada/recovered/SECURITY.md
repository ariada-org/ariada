# Security policy

## Supported release

Security fixes are prepared for the current `0.1.x` line until a later line is announced.

## Runtime boundaries

- Scan only trusted build output. The local server prevents traversal and escaping symlinks but serves files with the current user's permissions.
- Caller-provided private or loopback URLs require `allowPrivate: true`; do not enable it for untrusted configuration.
- Chromium is an operational prerequisite. Keep browser binaries patched and provision them outside package installation.
- The plugin spawns only its bundled Ariada CLI with `shell: false`. It never evaluates project text or interpolates options into a shell command.
- Reports may contain selectors and page metadata. Treat `.ariada/` as build evidence and apply the repository's retention policy.

## Supply chain

The source lock uses exact versions. Release packaging bundles the complete scanner closure, forbids install lifecycle scripts, rejects `file:`, `workspace:`, and `link:` protocols, and records deterministic SHA-256 and file inventory evidence. CI installs with `--ignore-scripts` and runs the production dependency audit.

Report vulnerabilities through the private security contact listed by the repository. Do not include secrets or private site content in a public issue.
