<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# Ariada Django App

Reusable Django app for running Ariada accessibility scans from `manage.py`.
It renders Django routes with the Django test client, serves that rendered HTML
through a temporary localhost server when needed, and delegates scanning to the
shared `@ariada-org/cli`.

The app does not implement scanner rules.

## Install

```bash
pip install ariada-django
npm install -g @ariada-org/cli
python -m playwright install chromium
```

Add the app:

```python
INSTALLED_APPS = [
    "ariada_django",
    # ...
]

ARIADA_SCAN_TARGETS = ["/", "/checkout/"]
ARIADA_CLI_COMMAND = "ariada"
```

## Usage

```bash
python manage.py ariada_scan /
python manage.py ariada_scan /checkout/ --domains accessibility --severity-threshold serious
python manage.py ariada_scan --all --output-dir ./ariada-output
```

Targets may be:

- Django paths such as `/checkout/`, rendered through the test client.
- Local HTML files, served through a temporary localhost server.
- HTTP or HTTPS URLs, passed directly to `ariada scan`.

The command exits non-zero when the Ariada CLI reports gate violations unless
`--no-fail` is passed.

## Local Verification

```bash
python -m pip install -e ".[dev]"
ruff check .
pytest
python -m build
```

Live PyPI publication requires the founder-owned PyPI account and token.

---

Update:
- Author: TURING (orchestrator)
- Date: 2026-06-23
