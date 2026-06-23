<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
SPDX-License-Identifier: EUPL-1.2
-->

# Ariada tox/nox Helper

Thin Python helper for running Ariada accessibility scans from tox or nox.

The package does not implement scanning. It validates a URL or HTML file target,
then delegates to the shared `@ariada-org/cli`.

## Install

```bash
pip install tox-nox-ariada
npm install -g @ariada-org/cli
python -m playwright install chromium
```

## tox

```ini
[testenv:a11y]
deps = tox-nox-ariada
commands =
 ariada-toxnox scan {toxinidir}/site/index.html --no-fail
```

## nox

```python
import nox


@nox.session
def a11y(session):
 session.install("tox-nox-ariada")
 session.run("ariada-toxnox", "scan", "site/index.html", "--no-fail")
```

## Human Gates

Publishing requires founder-owned PyPI credentials. Live CI execution requires
the target repository's tox/nox environment and any private CI secrets. Local
served/file fixture evidence is complete.
