# Minimal rules_js fixture

The fixture copies `src/index.html` into a declared build output, then passes that
output to `ariada_scan`. The scan runner itself is a `rules_js` `js_binary`. The
checked-in tree contains no browser binary.
`tools/bazel-integration.mjs` copies a provisioned Playwright cache into a temporary
fixture so every browser file is a declared action input.

The `scan` target writes results and succeeds while recording semantic exit `1`.
The `scan_strict` target writes the same declared outputs and then fails with exit
`1`, making it suitable for a CI gate.
