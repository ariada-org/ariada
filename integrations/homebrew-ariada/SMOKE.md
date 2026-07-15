# Homebrew Smoke Notes

## Local Syntax Check

```bash
ruby -c Formula/ariada.rb
```

Expected: `Syntax OK`.

## Real Install Check

```bash
brew audit --strict Formula/ariada.rb
brew install --build-from-source Formula/ariada.rb
ariada --version
```

Current blocker: the formula intentionally contains a placeholder `sha256`
because the npm tarball or GitHub release artifact is not published from this
workspace. The expected actor is the release owner who publishes the CLI artifact
and records its checksum.
