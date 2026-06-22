# Ariada Windows Package Manifests

Draft packaging manifests for installing the Ariada CLI on Windows through
Windows Package Manager (`winget`) and Scoop.

## Contents

- `winget/manifests/a/Ariada/Ariada/0.1.0/` — WinGet YAML triplet for package
  identifier `Ariada.Ariada`.
- `scoop/ariada.json` — Scoop manifest for a bucket submission.
- `VALIDATION.md` — local validation commands and current blockers.

## Current Release Assumption

The manifests point to the intended public release artifact:

```text
https://github.com/ariada-org/ariada/releases/download/ariada-cli-v0.1.0/ariada-windows-x64.zip
```

The ZIP must contain `ariada.exe` at the archive root. The placeholder SHA256 in
both manifests must be replaced with the real hash before submission or install
testing.

## Founder / Release Owner Actions

- Build and sign the Windows CLI artifact.
- Publish the release asset under the URL above, or update both manifests to the
  final URL.
- Replace the placeholder SHA256 value in:
  - `winget/.../Ariada.Ariada.installer.yaml`
  - `scoop/ariada.json`
- Validate on Windows with `winget validate` and `scoop install`.

No marketplace submission has been performed from this stream.
