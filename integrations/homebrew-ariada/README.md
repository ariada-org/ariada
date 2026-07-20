# Ariada Homebrew Tap

This directory is the ready-to-copy tap layout for `ariada-org/homebrew-tap`.

## Product

`brew install ariada` gives macOS and Linux developers a standard install path
for the Ariada CLI. The formula installs the npm CLI package and exposes the
`ariada` command.

## Files

- `Formula/ariada.rb`: Homebrew formula for the Ariada CLI.
- `SMOKE.md`: local audit and install checklist.

## Publish Steps

Before this formula can pass a real Homebrew install:

1. Publish `@ariada-org/cli@0.1.0` to npm or replace `url` with a GitHub release
   tarball.
2. Replace the placeholder `sha256` with the tarball checksum.
3. Copy this directory into `ariada-org/homebrew-tap`.
4. Run:

```bash
brew audit --strict Formula/ariada.rb
brew install --build-from-source Formula/ariada.rb
ariada --version
```

Publishing the tap repository is founder or release-maintainer work.
