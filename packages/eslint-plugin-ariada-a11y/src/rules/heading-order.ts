import type { Rule } from 'eslint';

import { isJsxOpeningElement, openingElementName } from '../ast.js';

function headingLevel(name: string): number | undefined {
  if (!/^h[1-6]$/.test(name)) return undefined;
  return Number(name.slice(1));
}

export const headingOrderRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow skipped heading levels in source order.',
    },
    messages: {
      skippedHeading: 'Heading level h{{current}} skips after h{{previous}}.',
    },
    schema: [],
  },
  create(context): Rule.RuleListener {
    let previousLevel = 0;
    return {
      Program(): void {
        previousLevel = 0;
      },
      JSXOpeningElement(node: Rule.Node): void {
        const candidate: unknown = node;
        if (!isJsxOpeningElement(candidate)) return;
        const currentLevel = headingLevel(openingElementName(candidate));
        if (!currentLevel) return;
        if (previousLevel > 0 && currentLevel > previousLevel + 1) {
          context.report({
            node,
            messageId: 'skippedHeading',
            data: {
              current: String(currentLevel),
              previous: String(previousLevel),
            },
          });
        }
        previousLevel = currentLevel;
      },
    } as Rule.RuleListener;
  },
};
