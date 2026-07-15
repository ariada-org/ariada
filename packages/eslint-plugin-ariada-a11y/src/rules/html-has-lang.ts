import type { Rule } from 'eslint';

import { hasNonEmptyStaticAttribute, isJsxOpeningElement, openingElementName } from '../ast.js';

export const htmlHasLangRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a non-empty lang attribute on html elements.',
    },
    messages: {
      missingLang: 'The html element must declare a non-empty lang attribute.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      JSXOpeningElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isJsxOpeningElement(candidate) || openingElementName(candidate) !== 'html') return;
        if (!hasNonEmptyStaticAttribute(candidate, 'lang')) {
          context.report({ node, messageId: 'missingLang' });
        }
      },
    } as Rule.RuleListener;
  },
};
