import type { Rule } from 'eslint';

import {
  attributeStaticText,
  isJsxOpeningElement,
  jsxAttribute,
  openingElementName,
} from '../ast.js';

export const imgAltRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a non-empty alt attribute on img elements.',
    },
    messages: {
      missingAlt: 'Image elements must have a non-empty alt attribute.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      JSXOpeningElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isJsxOpeningElement(candidate) || openingElementName(candidate) !== 'img') return;
        const alt = attributeStaticText(jsxAttribute(candidate, 'alt'));
        if (alt === undefined || alt.trim().length === 0) {
          context.report({ node, messageId: 'missingAlt' });
        }
      },
    } as Rule.RuleListener;
  },
};
