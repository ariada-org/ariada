# Ariada PostCSS Plugin

PostCSS 8 adapter for Ariada CSS-domain accessibility checks. It emits findings
through `result.warn()` so existing CSS pipelines and CI logs show the same
diagnostics as other PostCSS plugins.

```js
import { ariadaPostcss } from '@ariada-org/postcss-plugin';

export default {
  plugins: [ariadaPostcss({ scanner: ariadaCssScanner })],
};
```

The plugin does not implement CSS accessibility rules locally. The `scanner`
option is where the shared Ariada CSS scanner is connected.
