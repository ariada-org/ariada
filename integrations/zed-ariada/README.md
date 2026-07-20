# Ariada Zed Extension

Zed extension scaffold for surfacing Ariada accessibility findings as editor
diagnostics.

## Scope

This package is intentionally thin. It launches a language-server process and
expects that process to translate Zed/LSP document events into calls to the
existing Ariada scanner. The extension does not parse documents, run WCAG rules,
or duplicate scanner behavior.

## Runtime Boundary

Default lookup order:

1. Zed `lsp.ariada-lsp.binary` setting, when configured by the user.
2. `ariada-zed-lsp` on `PATH`.
3. `ariada lsp --stdio` on `PATH`, once that CLI subcommand exists.

The external process owns diagnostics. A compliant adapter should:

- speak Language Server Protocol over stdio;
- invoke `ariada scan <url-or-file> --format json` or an equivalent Ariada CLI
  entry point;
- publish diagnostics back to Zed without implementing scanner rules locally.

Example Zed setting for an explicit adapter path:

```json
{
  "lsp": {
    "ariada-lsp": {
      "binary": {
        "path": "/usr/local/bin/ariada-zed-lsp",
        "arguments": []
      }
    }
  }
}
```

## Development

```sh
cargo check
cargo build --target wasm32-wasip1
```

Install locally from Zed with `zed: install dev extension` and select this
directory. If loading fails, open `Zed.log` with `zed: open log` or launch Zed
with `zed --foreground`.

## Sources

- Zed extension manifests, local dev install, and Rust/WASM shape:
  https://zed.dev/docs/extensions/developing-extensions
- Zed language-server extension contract:
  https://zed.dev/docs/extensions/languages#language-servers
- Zed extension API command and worktree lookup:
  https://docs.rs/zed_extension_api/latest/zed_extension_api/
