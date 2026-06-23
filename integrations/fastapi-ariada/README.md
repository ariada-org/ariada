<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# Ariada FastAPI Middleware

Reusable FastAPI/Starlette middleware and CLI bridge for running Ariada
accessibility scans against FastAPI routes. The integration renders FastAPI
routes with `TestClient`, serves that rendered HTML through a temporary
localhost server when needed, and delegates scanning to the shared
`@ariada-org/cli`.

The middleware does not implement scanner rules.

## Install

```bash
pip install ariada-fastapi
npm install -g @ariada-org/cli
python -m playwright install chromium
```

Register the middleware:

```python
from fastapi import FastAPI
from ariada_fastapi import install_ariada

app = FastAPI()
install_ariada(app, targets=["/", "/checkout/"], cli_command="ariada")
```

## Usage

```bash
python -m ariada_fastapi --app app:app /
python -m ariada_fastapi --app app:app /checkout/ --domains accessibility
python -m ariada_fastapi --app app:app --all --output-dir./ariada-output
```

Targets may be:

- FastAPI paths such as `/checkout/`, rendered through `TestClient`.
- Local HTML files, served through a temporary localhost server.
- HTTP or HTTPS URLs, passed directly to `ariada scan`.

The command exits non-zero when the Ariada CLI reports gate violations unless
`--no-fail` is passed.

## Local Verification

```bash
python -m pip install -e ".[dev]"
ruff check.
pytest
python -m build
```

Live PyPI publication requires the founder-owned PyPI account and token.
