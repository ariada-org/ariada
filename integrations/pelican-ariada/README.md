# pelican-ariada

Pelican plugin that scans the generated `output/` directory with the shared
`@ariada-org/cli` after Pelican finishes writing the static site.

The integration is intentionally thin. It does not parse HTML, implement rules, or
own scanner logic. It only decides when to invoke Ariada in a Pelican build and how to
turn the shared CLI exit code into a Pelican gate.

## Why `signals.finalized`

Pelican's official plugin documentation says plugins define a `register` callable
and subscribe to Pelican signals. It also documents the `finalized` signal as running
after generators execute and just before Pelican exits, which is the right point for
post-processing generated output:

- https://docs.getpelican.com/en/4.8.0/plugins.html#how-to-create-plugins
- https://docs.getpelican.com/en/4.8.0/plugins.html#list-of-signals

Pelican also documents the namespace package structure under `pelican.plugins`, so
this package installs as `pelican.plugins.ariada`:

- https://docs.getpelican.com/en/4.8.0/plugins.html#namespace-plugin-structure

## Install

```sh
python -m pip install pelican-ariada
npm install --save-dev @ariada-org/cli
```

During local development from this repository:

```sh
python -m pip install -e integrations/pelican-ariada[dev]
pnpm --filter @ariada-org/cli... build
```

## Configure Pelican

If `PLUGINS` is unset, namespace plugins may be auto-discovered by Pelican. When a
site sets `PLUGINS`, list this plugin explicitly.

```python
PLUGINS = ["pelican.plugins.ariada"]

ARIADA = {
    "enabled": True,
    "gate": True,
    "target": "output",
    "output_dir": "scan-evidence/ariada-output",
    "cli_command": "npx @ariada-org/cli",
    "browser": "chromium",
    "severity_threshold": "moderate",
    "timeout_ms": 30000,
    "domains": ["accessibility"],
}
```

Environment overrides:

- `ARIADA_CLI`: replaces `ARIADA["cli_command"]`
- `ARIADA_OUTPUT_DIR`: replaces `ARIADA["output_dir"]`

## Behavior

`pelican-ariada` runs after Pelican writes the static site. If `target` is a local
directory, the plugin serves that directory on `127.0.0.1` and scans the local URL,
because the shared Ariada CLI scans browser-visible pages. If `target` is already an
HTTP(S) URL, the plugin scans it directly.

When `gate` is true, any non-zero Ariada exit code raises a Pelican build error.
When `gate` is false, findings are logged but the Pelican build continues.

## Evidence

This channel includes a local fixture under `fixtures/pelican-site/`, a fallback
static fixture under `fixtures/static-site/`, unit tests, and report generation under
`scan-evidence/`.
