# Ariada for Bazel

`bazel_ariada` wires the existing Ariada CLI into a declared Bazel action. The
rule serves one declared static web build output on a loopback socket, invokes the
vendored `@ariada-org/cli@0.1.0`, and emits result and status files. It does not
implement accessibility analysis.

## Module setup

The module is not yet listed in the Bazel Central Registry. Until the maintainer
publishes the release archive, use a source archive or a `local_path_override`:

```starlark
bazel_dep(name = "bazel_ariada", version = "0.1.0")
local_path_override(module_name = "bazel_ariada", path = "third_party/bazel-ariada")
```

Registry submission and signing require maintainer-controlled release credentials.
No registry publication is claimed by this source tree.

## Rule

```starlark
load("@bazel_ariada//ariada:defs.bzl", "ariada_scan")

ariada_scan(
    name = "scan",
    src = ":built_site",
    browser_cache_marker = ":playwright_cache_marker",
    browser_files = [":playwright_browser_files"],
    severity_threshold = "serious",
)
```

`src` must yield exactly one HTML file or one directory artifact. Directory inputs
use `index.html` unless `entry_path` is set. The scan action accepts only declared
inputs and writes these declared outputs:

- `scan.result.json`: the canonical Ariada multi-domain report.
- `scan.status.json`: semantic exit, action exit, finding count, rule IDs, domains,
  and threshold using `bazel-ariada-status.v1`.

The default report-only behavior maps Ariada findings exit `1` to Bazel action exit
`0` after preserving `semanticExitCode: 1` in `scan.status.json`. Set
`fail_on_findings = True` for a strict CI target. Invalid input and runtime failures
remain exits `2` and `3`.

## Attributes

| Attribute | Meaning |
|---|---|
| `src` | One declared HTML file or directory artifact. |
| `entry_path` | Relative entry inside a directory artifact. |
| `domains` | Ariada domains; default is `accessibility`. |
| `severity_threshold` | `minor`, `moderate`, `serious`, or `critical`. |
| `timeout_ms` | Navigation timeout from 1 through 300000 ms. |
| `fail_on_findings` | Preserve exit `1` at the Bazel action boundary. |
| `browser_files` | Declared Playwright browser files included in the cache key. |
| `browser_cache_marker` | File at the declared browser cache root. |
| `cli` | Ariada CLI entry point; defaults to the bundled exact version. |
| `cli_runtime` | Offline runtime closure; defaults to `//vendor:runtime`. |

## Hermeticity and caching

The runner uses the Node executable from the `rules_js` toolchain. It never invokes
a command shell. The CLI entry point, JavaScript dependency closure, site output,
browser cache marker, and every browser runtime file are action inputs. The result
and status are action outputs, so an unchanged target is served from Bazel's action
cache. Browser binaries are intentionally absent from the module archive; consumers
must provide them as declared files.

The action binds only to `127.0.0.1`, disables Playwright browser downloads, and
removes Ariada event-bus environment variables before starting the CLI. The fixture
contains no external assets.

## Local gates

```sh
npm ci --ignore-scripts
npm run check
npm run package
npm run test:offline

export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export PLAYWRIGHT_BROWSERS_PATH=/path/to/provisioned/playwright-cache
npm run test:bazel
```

`npm run test:bazel` builds the minimal `rules_js` fixture, checks a real known
finding, proves a second build reuses the cached action outputs, and checks strict
semantic exit behavior. It performs a Bazel fetch first and then runs builds with
`--nofetch`; npm and Playwright downloads are not used.

## Release artifacts

`npm run package` creates deterministic `.tar` and `.tar.gz` module archives,
`SHA256SUMS`, and a file inventory under `artifacts/`. `MANIFEST.json` inside the
archive records every shipped file and a canonical content digest. No credentials,
browser executables, npm lifecycle hooks, or local repository paths are included.

Source repository: https://github.com/ariada-org/ariada/tree/main/integrations/bazel-ariada

Module page: https://ariada.org/modules/s231/
