# Ariada Rollup Plugin

Scans Rollup HTML assets during `writeBundle` and emits Ariada findings through
Rollup warnings, or errors when `failOn` is configured.

```js
import { ariadaRollup } from '@ariada-org/rollup-plugin';

export default {
  plugins: [ariadaRollup({ failOn: 'serious' })],
};
```

This package is only the Rollup adapter. Keep the scanner implementation in the
shared Ariada engine or CLI layer and pass it through the `scanner` option.
