# @ariada-org/ariada-precommit

pre-commit and Husky wrapper for running the ariada accessibility gate before
code leaves a developer machine. The wrapper does not implement scanning. It
filters staged HTML and template files, then invokes the `ariada` CLI.

## pre-commit

```yaml
repos:
  - repo: https://github.com/ariada-org/ariada
    rev: v0.1.0
    hooks:
      - id: ariada-a11y
```

Run it locally against a checkout:

```sh
pre-commit try-repo . ariada-a11y --files tests/fixtures/bad.html
```

## Husky

```sh
pnpm add -D @ariada-org/ariada-precommit @ariada-org/cli husky lint-staged
```

```json
{
  "lint-staged": {
    "*.{html,htm,xhtml,astro,vue,svelte,jsx,tsx,twig,liquid,hbs,handlebars,php,erb}": "ariada-precommit"
  }
}
```

## Options

- `ARIADA_BIN`: override the scanner binary. Defaults to `ariada`.
- `ARIADA_PRECOMMIT_URL_BASE`: map each selected file to a URL under a running
  preview server. For example, `http://127.0.0.1:4173`.
- `ARIADA_PRECOMMIT_SEVERITY`: pass `--severity-threshold`. Defaults to `serious`.
- `ARIADA_PRECOMMIT_FORMAT`: pass `--format`. Defaults to `json`.

If no URL base is set, filenames are passed directly to the CLI. That keeps this
package thin while allowing the scanner CLI to own file and template handling.
