<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
SPDX-License-Identifier: EUPL-1.2
-->

# Ariada pytest Plugin

pytest plugin for running Ariada accessibility scans inside a Python test suite.

The plugin does not implement scanner rules. It validates a URL or generated
HTML file, temporarily serves file targets on localhost, and delegates scanning
to the shared `@ariada-org/cli`.

## Install

```bash
pip install pytest-ariada
npm install -g @ariada-org/cli
python -m playwright install chromium
```

## Usage

```python
def test_accessibility(ariada_scan):
 result = ariada_scan("site/index.html")
 assert result.total_findings >= 0
```

Or configure a default target:

```bash
pytest --ariada-target site/index.html --ariada-no-fail
```

## Human Gates

Publishing requires founder-owned PyPI credentials. Running inside private CI
requires that repository's generated HTML or served app URL. Local pytester and
file-surface evidence is complete.
