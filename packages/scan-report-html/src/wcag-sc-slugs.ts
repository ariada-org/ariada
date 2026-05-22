// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * WCAG 2.2 success-criterion → W3C Understanding-doc slug table.
 *
 * Source: https://www.w3.org/WAI/WCAG22/quickref/ (reviewed 2026-05-19).
 *
 * The table covers all 50 Level-A and Level-AA criteria in WCAG 2.2.
 * Level-AAA criteria are not included by default — the renderer reports
 * against AA conformance (compliance officers under the EAA (European
 * Accessibility Act, Directive 2019/882/EU) / DOS-lagen both anchor on AA).
 *
 * When a finding maps to multiple SCs the renderer links the first one
 * (`finding.wcag[0]`). Future: render all mapped SCs as a chip group.
 */

export const WCAG_22_SC_SLUG: Readonly<Record<string, string>> = {
  // Principle 1: Perceivable
  '1.1.1': 'non-text-content',
  '1.2.1': 'audio-only-and-video-only-prerecorded',
  '1.2.2': 'captions-prerecorded',
  '1.2.3': 'audio-description-or-media-alternative-prerecorded',
  '1.2.4': 'captions-live',
  '1.2.5': 'audio-description-prerecorded',
  '1.3.1': 'info-and-relationships',
  '1.3.2': 'meaningful-sequence',
  '1.3.3': 'sensory-characteristics',
  '1.3.4': 'orientation',
  '1.3.5': 'identify-input-purpose',
  '1.4.1': 'use-of-color',
  '1.4.2': 'audio-control',
  '1.4.3': 'contrast-minimum',
  '1.4.4': 'resize-text',
  '1.4.5': 'images-of-text',
  '1.4.10': 'reflow',
  '1.4.11': 'non-text-contrast',
  '1.4.12': 'text-spacing',
  '1.4.13': 'content-on-hover-or-focus',
  // Principle 2: Operable
  '2.1.1': 'keyboard',
  '2.1.2': 'no-keyboard-trap',
  '2.1.4': 'character-key-shortcuts',
  '2.2.1': 'timing-adjustable',
  '2.2.2': 'pause-stop-hide',
  '2.3.1': 'three-flashes-or-below-threshold',
  '2.4.1': 'bypass-blocks',
  '2.4.2': 'page-titled',
  '2.4.3': 'focus-order',
  '2.4.4': 'link-purpose-in-context',
  '2.4.5': 'multiple-ways',
  '2.4.6': 'headings-and-labels',
  '2.4.7': 'focus-visible',
  '2.4.11': 'focus-not-obscured-minimum',
  '2.5.1': 'pointer-gestures',
  '2.5.2': 'pointer-cancellation',
  '2.5.3': 'label-in-name',
  '2.5.4': 'motion-actuation',
  '2.5.7': 'dragging-movements',
  '2.5.8': 'target-size-minimum',
  // Principle 3: Understandable
  '3.1.1': 'language-of-page',
  '3.1.2': 'language-of-parts',
  '3.2.1': 'on-focus',
  '3.2.2': 'on-input',
  '3.2.3': 'consistent-navigation',
  '3.2.4': 'consistent-identification',
  '3.2.6': 'consistent-help',
  '3.3.1': 'error-identification',
  '3.3.2': 'labels-or-instructions',
  '3.3.3': 'error-suggestion',
  '3.3.4': 'error-prevention-legal-financial-data',
  '3.3.7': 'redundant-entry',
  '3.3.8': 'accessible-authentication-minimum',
  // Principle 4: Robust
  '4.1.2': 'name-role-value',
  '4.1.3': 'status-messages',
};

/**
 * Resolve a WCAG SC number to its canonical W3C Understanding-doc URL.
 *
 * Returns the WCAG 2.2 quickref hash anchor as a graceful fallback when
 * the SC is not in our static table — this keeps the link usable even if
 * a new SC slips through review.
 */
export function wcagSCUrl(sc: string): string {
  const slug = WCAG_22_SC_SLUG[sc];
  if (slug === undefined) {
    return `https://www.w3.org/WAI/WCAG22/quickref/#${sc}`;
  }
  return `https://www.w3.org/WAI/WCAG22/Understanding/${slug}.html`;
}
