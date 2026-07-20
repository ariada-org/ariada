import type { Linter, Rule } from 'eslint';

interface JsxIdentifier {
  type: 'JSXIdentifier';
  name: string;
}

interface JsxOpeningElement {
  type: 'JSXOpeningElement';
  name: JsxIdentifier;
  attributes: unknown[];
}

interface JsxElement {
  type: 'JSXElement';
  openingElement: JsxOpeningElement;
  children: unknown[];
}

interface JsxAttribute {
  type: 'JSXAttribute';
  name: JsxIdentifier;
  value?: { type: 'Literal'; value: string | number | boolean | null } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOpening(node: unknown): node is JsxOpeningElement {
  return isRecord(node) && node['type'] === 'JSXOpeningElement' && Array.isArray(node['attributes']);
}

function isElement(node: unknown): node is JsxElement {
  return isRecord(node) && node['type'] === 'JSXElement' && isOpening(node['openingElement']);
}

function attribute(node: JsxOpeningElement, name: string): JsxAttribute | undefined {
  for (const item of node.attributes) {
    if (!isRecord(item) || item['type'] !== 'JSXAttribute' || !isRecord(item['name'])) continue;
    if (item['name']['type'] === 'JSXIdentifier' && item['name']['name'] === name) {
      return item as unknown as JsxAttribute;
    }
  }
  return undefined;
}

function staticText(item: JsxAttribute | undefined): string | undefined {
  if (!item) return undefined;
  if (!item.value) return '';
  if (item.value.type === 'Literal' && typeof item.value.value === 'string') return item.value.value;
  return undefined;
}

function hasNonEmptyAttribute(node: JsxOpeningElement, name: string): boolean {
  const value = staticText(attribute(node, name));
  return value !== undefined && value.trim().length > 0;
}

function containsControl(node: JsxElement): boolean {
  const names = new Set(['button', 'input', 'meter', 'output', 'progress', 'select', 'textarea']);
  const stack: unknown[] = [...node.children];
  while (stack.length > 0) {
    const current = stack.pop();
    if (isElement(current)) {
      if (names.has(current.openingElement.name.name)) return true;
      stack.push(...current.children);
    }
  }
  return false;
}

const imgAltRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require a non-empty alt attribute on img elements.' },
    messages: { missingAlt: 'Image elements must have a non-empty alt attribute.' },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      JSXOpeningElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isOpening(candidate) || candidate.name.name !== 'img') return;
        const alt = staticText(attribute(candidate, 'alt'));
        if (alt === undefined || alt.trim().length === 0) {
          context.report({ node, messageId: 'missingAlt' });
        }
      },
    } as Rule.RuleListener;
  },
};

const labelRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require labels to reference or wrap a form control.' },
    messages: { missingControl: 'Label elements must use htmlFor or wrap a labelable control.' },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      JSXElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isElement(candidate) || candidate.openingElement.name.name !== 'label') return;
        if (hasNonEmptyAttribute(candidate.openingElement, 'htmlFor')) return;
        if (containsControl(candidate)) return;
        context.report({ node, messageId: 'missingControl' });
      },
    } as Rule.RuleListener;
  },
};

const headingRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow skipped heading levels in source order.' },
    messages: { skippedHeading: 'Heading level h{{current}} skips after h{{previous}}.' },
    schema: [],
  },
  create(context): Rule.RuleListener {
    let previous = 0;
    return {
      Program(): void {
        previous = 0;
      },
      JSXOpeningElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isOpening(candidate) || !/^h[1-6]$/.test(candidate.name.name)) return;
        const current = Number(candidate.name.name.slice(1));
        if (previous > 0 && current > previous + 1) {
          context.report({
            node,
            messageId: 'skippedHeading',
            data: { current: String(current), previous: String(previous) },
          });
        }
        previous = current;
      },
    } as Rule.RuleListener;
  },
};

const langRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require a non-empty lang attribute on html elements.' },
    messages: { missingLang: 'The html element must declare a non-empty lang attribute.' },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      JSXOpeningElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isOpening(candidate) || candidate.name.name !== 'html') return;
        if (!hasNonEmptyAttribute(candidate, 'lang')) {
          context.report({ node, messageId: 'missingLang' });
        }
      },
    } as Rule.RuleListener;
  },
};

const rules: Record<string, Rule.RuleModule> = {
  'heading-order': headingRule,
  'html-has-lang': langRule,
  'img-alt': imgAltRule,
  'label-has-associated-control': labelRule,
};

interface CommonJsPlugin {
  meta: { name: string; version: string };
  rules: Record<string, Rule.RuleModule>;
  configs: { recommended: Linter.Config };
}

type FlatPlugin = NonNullable<Linter.Config['plugins']>[string];

const plugin = {
  meta: { name: '@ariada-org/eslint-plugin-a11y', version: '0.1.0' },
  rules,
  configs: { recommended: {} },
} as CommonJsPlugin;

plugin.configs.recommended = {
  name: '@ariada-org/a11y/recommended',
  files: ['**/*.{js,jsx,ts,tsx}'],
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { '@ariada-org/a11y': plugin as FlatPlugin },
  rules: {
    '@ariada-org/a11y/heading-order': 'error',
    '@ariada-org/a11y/html-has-lang': 'error',
    '@ariada-org/a11y/img-alt': 'error',
    '@ariada-org/a11y/label-has-associated-control': 'error',
  },
};

export = plugin;
