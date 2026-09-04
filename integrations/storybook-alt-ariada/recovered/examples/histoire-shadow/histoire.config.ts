import { HstVue } from '@histoire/plugin-vue';
import { defineConfig } from 'histoire';

export default defineConfig({
  outDir: 'build',
  routerMode: 'hash',
  setupFile: '/src/histoire-setup.ts',
  plugins: [HstVue()],
});
