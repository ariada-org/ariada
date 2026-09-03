import { fileURLToPath } from 'node:url';

import { stencilAriada } from '../../dist/index.js';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const threshold = process.env.ARIADA_STENCIL_FAIL_ON ?? 'serious';

export const config = {
  namespace: 'shadowbad',
  rootDir,
  srcDir: 'src',
  outputTargets: [
    { type: 'www', dir: 'www', serviceWorker: null, empty: true },
    stencilAriada({
      reportDir: '.ariada/stencil',
      failOn: threshold === 'false' ? false : threshold,
      timeoutMs: 30_000,
    }),
  ],
};
