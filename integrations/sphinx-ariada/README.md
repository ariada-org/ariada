# Ariada Sphinx

Sphinx extension that scans generated HTML documentation with the shared Ariada CLI.

The extension does not implement accessibility scanning. It hooks Sphinx's `build-finished` event, serves the generated HTML on localhost, and delegates scanning to `@ariada-org/cli`.

## Usage

```python
extensions = ["ariada_sphinx"]

ariada_cli_command = "ariada"
ariada_output_dir = "_build/ariada-output"
ariada_fail_on_violation = True
```

Then build docs as usual:

```bash
sphinx-build -b html docs _build/html
```

## Human Gates

Publishing requires founder-owned PyPI credentials. Local fixture evidence covers the Sphinx build hook, generated HTML surface, shared CLI scan, and embedded screenshot report.
