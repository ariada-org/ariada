import { viteBundler } from '@vuepress/bundler-vite';
import { defaultTheme } from '@vuepress/theme-default';

import { ariadaVuePress } from '../../../../dist/src/index.js';

export default {
  lang: 'en-US',
  title: 'Ariada VuePress fixture',
  description: 'Minimal VuePress site with intentional accessibility defects.',
  bundler: viteBundler(),
  theme: defaultTheme({}),
  plugins: [
    ariadaVuePress({
      cliPath: process.env.ARIADA_CLI_PATH,
      failOnViolation: false,
      reportDir: '../../../scan-evidence',
    }),
  ],
};
