// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
} from '../domain-contract.js';
import type { Finding } from '../types.js';

/** Feature key set when an image element has no alternative text. */
export const A11Y_MISSING_ALT = 'a11y:missing-alt';

/** Rule id emitted for an image missing alternative text. */
export const IMAGE_ALT_RULE_ID = 'image-alt';

/**
 * Built-in accessibility reference domain. It registers a per-element extractor
 * into the single shared pass that flags `<img>` elements without an `alt`
 * attribute, and a deterministic rule engine that turns those features into
 * findings. This is the reference domain proving the contract end-to-end; the
 * full rule set is bridged from the dedicated accessibility rules package.
 */
export const accessibilityDomain: DomainModule = {
  id: 'accessibility',
  title: 'Accessibility',
  version: '0.1.0',

  extractors: {
    perElement(el: ElementHandle, acc: FeatureSink): void {
      // Node names are compared case-insensitively so the rule works against both
      // the upper-case form (IMG) and the lower-case form a live capture records.
      if (el.nodeName.toLowerCase() === 'img' && !hasAltText(el)) {
        acc.set(el.selector, A11Y_MISSING_ALT, true);
      }
    },
  },

  evaluate(features: ExtractedFeatures): Finding[] {
    const findings: Finding[] = [];
    for (const [selector, data] of features.byElement) {
      const a11y = data.domainFeatures['accessibility'];
      if (a11y?.get(A11Y_MISSING_ALT)) {
        findings.push({
          id: `${IMAGE_ALT_RULE_ID}-${selector}`,
          scanId: '',
          domain: 'accessibility',
          ruleId: IMAGE_ALT_RULE_ID,
          severity: 'serious',
          element: { selector },
          message: 'Image is missing alternative text',
          wcagMapping: ['1.1.1'],
          regulatoryMapping: [{ framework: 'WCAG', code: 'SC 1.1.1' }],
        });
      }
    }
    return findings;
  },

  regulatory: [{ framework: 'WCAG', code: 'SC 1.1.1' }],
};

/**
 * Whether an element carries non-empty alternative text. The attribute key is
 * matched case-insensitively so the rule is robust to how a surface records it.
 */
function hasAltText(el: ElementHandle): boolean {
  const attributes = el.attributes;
  if (!attributes) return false;
  for (const [name, value] of Object.entries(attributes)) {
    if (name.toLowerCase() === 'alt') return value.trim().length > 0;
  }
  return false;
}
