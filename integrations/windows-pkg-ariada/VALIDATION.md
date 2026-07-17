# Validation Notes

## WinGet

Expected Windows validation:

```powershell
winget validate --manifest .\winget\manifests\a\Ariada\Ariada\0.1.0
winget install --manifest .\winget\manifests\a\Ariada\Ariada\0.1.0
ariada --version
```

Current blocker:

- This macOS environment does not provide `winget`.
- The release ZIP and real SHA256 are not published yet, so install validation
  cannot be truthful.

## Scoop

Expected Windows validation:

```powershell
scoop install .\scoop\ariada.json
ariada --version
scoop uninstall ariada
```

Current blocker:

- This macOS environment does not provide Scoop.
- The placeholder hash must be replaced with the real release SHA256 before
  installation.

## Structure Checks Available On macOS

```bash
python3 - <<'PY'
import json
from pathlib import Path
json.loads(Path("scoop/ariada.json").read_text())
for path in Path("winget").rglob("*.yaml"):
    text = path.read_text()
    assert "PackageIdentifier: Ariada.Ariada" in text
print("windows package manifests are parseable text/json")
PY
```
