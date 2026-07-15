# Ariada Webpack Plugin

Runs Ariada over emitted Webpack HTML assets after emit and reports findings via
`compilation.warnings` or `compilation.errors`.

```js
import AriadaWebpackPlugin from '@ariada-org/webpack-plugin';

export default {
  plugins: [new AriadaWebpackPlugin({ failOn: 'serious' })],
};
```

This package is a lifecycle adapter. It does not contain scanner rules; inject
the shared Ariada scanner or CLI runner through `scanner`.
