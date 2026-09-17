# Ariada MkDocs

MkDocs plugin that scans generated site HTML with the shared Ariada CLI.

The plugin does not implement accessibility scanning. It hooks `on_post_build`, serves the generated `site/` directory on localhost, and delegates scanning to `@ariada-org/cli`.

## Usage

```yaml
plugins:
  - search
  - ariada:
      cli_command: ariada
      output_dir: ariada-output
      fail_on_violation: true
```

Build as usual:

```bash
mkdocs build
```

## Human Gates

Publishing requires founder-owned PyPI credentials. Local fixture evidence covers the MkDocs build hook, generated HTML surface, shared CLI scan, and embedded screenshot report.
