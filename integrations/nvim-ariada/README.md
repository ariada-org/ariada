# Ariada for Neovim

Native Lua plugin that runs the `ariada` accessibility CLI and maps findings to
Neovim diagnostics plus the quickfix list.

## What It Does

- Adds the `:Ariada` command.
- Runs `ariada scan <url> --format json` asynchronously.
- Reads the generated `scan.json`.
- Maps finding severity to `vim.diagnostic`.
- Mirrors diagnostics into quickfix so reviewers can jump through findings.

## Install For Local Review

With a plugin manager, point Neovim at this directory. For manual review:

```vim
set runtimepath+=<repo>/integrations/nvim-ariada
lua require("ariada").setup()
```

Run a scan:

```vim
:Ariada https://example.com
```

For a local fixture, serve `fixtures/bad-button.html` with any local static server
and pass that URL to `:Ariada`. The current ariada CLI accepts `http` and `https`
targets, not `file://` paths, so this plugin does not pretend to scan raw files
directly.

## Configuration

```lua
require("ariada").setup({
  cli = "ariada",
  severity_threshold = "moderate",
  timeout_ms = 30000,
  output_dir = nil,
})
```

You can also set `vim.g.ariada_url` for repeated local scans:

```lua
vim.g.ariada_url = "http://127.0.0.1:8080/fixtures/bad-button.html"
```

## Validation

Syntax-only validation without Neovim:

```bash
luac -p lua/ariada/init.lua plugin/ariada.lua
```

Headless Neovim validation, when `nvim` is installed:

```bash
nvim --headless --clean \
  +"set rtp+=<repo>/integrations/nvim-ariada" \
  +"lua require('ariada').setup(); require('ariada').apply_scan_json(0, vim.fn.readfile('fixtures/sample-scan.json'))" \
  +q
```
