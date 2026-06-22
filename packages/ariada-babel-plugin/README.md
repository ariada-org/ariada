# Ariada Babel Plugin

Babel adapter for source-visible JSX accessibility checks. It extracts a simple
static JSX tag stream and passes it to a shared Ariada scanner, then exposes
findings on Babel metadata or fails the transform when configured.

```js
plugins: [['@ariada-org/babel-plugin', { scanner: ariadaJsxScanner, failOn: 'serious' }]]
```

This package is not a rendered-DOM scanner. Use the esbuild, Webpack, Rollup, or
Vite output-stage plugins for built HTML scans.
