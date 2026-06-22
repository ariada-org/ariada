import type { Rule } from 'eslint';

import {
  containsElement,
  hasNonEmptyStaticAttribute,
  isJsxElement,
  openingElementName,
} from '../ast.js';

const LABELABLE_ELEMENTS = new Set(['button', 'input', 'meter', 'output', 'progress', 'select', 'textarea']);

export const labelHasAssociatedControlRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require labels to reference or wrap a form control.',
    },
    messages: {
      missingControl: 'Label elements must use htmlFor or wrap a labelable control.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    return {
      JSXElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isJsxElement(candidate) || openingElementName(candidate.openingElement) !== 'label') return;
        if (hasNonEmptyStaticAttribute(candidate.openingElement, 'htmlFor')) return;
        if (containsElement(candidate, LABELABLE_ELEMENTS)) return;
        context.report({ node, messageId: 'missingControl' });
      },
    } as Rule.RuleListener;
  },
};
