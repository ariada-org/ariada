# Ariada JupyterLab

JupyterLab server and front-end bridge for scanning rendered notebook HTML with the shared Ariada CLI.

The package does not implement accessibility scanning. It exports notebook output to HTML with `nbconvert`, serves that HTML on localhost, and delegates scanning to `@ariada-org/cli`.

## Usage

```bash
pip install jupyterlab-ariada
jupyter server extension enable jupyterlab_ariada
```

The labextension adds an Ariada command that posts the active notebook model to the server bridge. The bridge returns the CLI exit code, finding count, stdout, stderr, and report path.

CLI smoke scan for local evidence:

```bash
python -m jupyterlab_ariada examples/fixture-notebook.ipynb \
 --cli "node../../packages/ariada-cli/dist/bin.js" \
 --output-dir ariada-output \
 --no-fail
```

## Human Gates

Publishing requires founder-owned PyPI credentials and a JupyterLab extension npm package release. Loading the extension in a live JupyterLab instance is a demo gate; the local fixture evidence covers the export and scan bridge.
