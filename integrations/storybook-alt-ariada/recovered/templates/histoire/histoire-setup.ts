import { defineSetupVue3 } from '@histoire/plugin-vue';
import installHistoireAriada from '@ariada-integrations/storybook-alt-ariada/histoire';

export const setupVue3 = defineSetupVue3(() => {
  installHistoireAriada();
});
