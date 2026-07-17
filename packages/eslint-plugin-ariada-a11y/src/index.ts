import type { Linter, Rule } from 'eslint';

import { headingOrderRule } from './rules/heading-order.js';
import { htmlHasLangRule } from './rules/html-has-lang.js';
import { imgAltRule } from './rules/img-alt.js';
import { labelHasAssociatedControlRule } from './rules/label-has-associated-control.js';

const rules: Record<string, Rule.RuleModule> = {
  'heading-order': headingOrderRule,
  'html-has-lang': htmlHasLangRule,
  'img-alt': imgAltRule,
  'label-has-associated-control': labelHasAssociatedControlRule,
};

type FlatPlugin = NonNullable<Linter.Config['plugins']>[string];

interface AriadaA11yPlugin {
  meta: {
    name: string;
    version: string;
  };
  rules: Record<string, Rule.RuleModule>;
  configs: {
    recommended: Linter.Config;
  };
}

const plugin = {
  meta: {
    name: '@ariada-org/eslint-plugin-a11y',
    version: '0.1.0',
  },
  rules,
  configs: {
    recommended: {},
  },
} as AriadaA11yPlugin;

const recommended: Linter.Config = {
  name: '@ariada-org/a11y/recommended',
  files: ['**/*.{js,jsx,ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  plugins: {
    '@ariada-org/a11y': plugin as FlatPlugin,
  },
  rules: {
    '@ariada-org/a11y/heading-order': 'error',
    '@ariada-org/a11y/html-has-lang': 'error',
    '@ariada-org/a11y/img-alt': 'error',
    '@ariada-org/a11y/label-has-associated-control': 'error',
  },
};

plugin.configs.recommended = recommended;

export default plugin;
export { rules };
