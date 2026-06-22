# Ariada esbuild Plugin

Runs Ariada after an esbuild build and reports findings through esbuild
warnings or errors. The plugin is a thin adapter: pass a scanner implementation
from the Ariada CLI or engine layer and the plugin handles esbuild lifecycle and
diagnostic formatting.

```ts
import { ariadaEsbuild } from '@ariada-org/esbuild-plugin';

export default {
  plugins: [ariadaEsbuild({ outdir: 'dist', failOn: 'serious' })],
};
```

The default scanner is intentionally empty for package-level tests. Production
configuration should inject the shared Ariada scanner or CLI runner rather than
copying rule logic into this package.
