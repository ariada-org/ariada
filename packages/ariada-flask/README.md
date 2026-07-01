<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# Ariada Flask Extension

Reusable Flask extension for running Ariada accessibility scans from the Flask
CLI. It renders Flask routes with the Flask test client, serves that rendered
HTML through a temporary localhost server when needed, and delegates scanning to
the shared `@ariada-org/cli`.

The extension does not implement scanner rules.

## Install

```bash
pip install ariada-flask
npm install -g @ariada-org/cli
python -m playwright install chromium
```

Register the extension:

```python
from flask import Flask
from ariada_flask import init_app

app = Flask(__name__)
app.config["ARIADA_SCAN_TARGETS"] = ["/", "/checkout/"]
app.config["ARIADA_CLI_COMMAND"] = "ariada"
init_app(app)
```

## Usage

```bash
flask --app app ariada-scan /
flask --app app ariada-scan /checkout/ --domains accessibility --severity-threshold serious
flask --app app ariada-scan --all --output-dir ./ariada-output
```

Targets may be:

- Flask paths such as `/checkout/`, rendered through the test client.
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

Publishing to PyPI requires a PyPI account with publish rights for this package.
