import { defineSetupVue3 } from '@histoire/plugin-vue';
import installHistoireAriada from '../../../dist/histoire.js';

export const setupVue3 = defineSetupVue3(() => {
  installHistoireAriada();
});
