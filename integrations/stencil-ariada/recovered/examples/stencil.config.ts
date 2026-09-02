import type { Config } from '@stencil/core';
import { stencilAriada } from '@ariada-integrations/stencil-ariada';

export const config: Config = {
  namespace: 'componentLibrary',
  outputTargets: [
    { type: 'www', dir: 'www', serviceWorker: null },
    stencilAriada({
      reportDir: '.ariada/stencil',
      failOn: 'serious',
    }),
  ],
};
