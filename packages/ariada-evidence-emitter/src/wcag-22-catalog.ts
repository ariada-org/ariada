// SPDX-License-Identifier: EUPL-1.2
/**
 * WCAG 2.2 Success Criteria catalogue.
 *
 * Authoritative source: https://www.w3.org/TR/WCAG22/
 *
 * Includes all A / AA / AAA criteria as of the 2026-10-05 W3C Recommendation
 * snapshot. Used by the VPAT / EN 301 549 emitters to seed an empty
 * conformance table before applying violations.
 */

/**
 *
 */
export interface WcagCriterion {
  sc: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
}

export const WCAG_22_CRITERIA: readonly WcagCriterion[] = [
  // Principle 1 — Perceivable
  { sc: '1.1.1', name: 'Non-text Content', level: 'A' },
  { sc: '1.2.1', name: 'Audio-only and Video-only (Prerecorded)', level: 'A' },
  { sc: '1.2.2', name: 'Captions (Prerecorded)', level: 'A' },
  { sc: '1.2.3', name: 'Audio Description or Media Alternative (Prerecorded)', level: 'A' },
  { sc: '1.2.4', name: 'Captions (Live)', level: 'AA' },
  { sc: '1.2.5', name: 'Audio Description (Prerecorded)', level: 'AA' },
  { sc: '1.2.6', name: 'Sign Language (Prerecorded)', level: 'AAA' },
  { sc: '1.2.7', name: 'Extended Audio Description (Prerecorded)', level: 'AAA' },
  { sc: '1.2.8', name: 'Media Alternative (Prerecorded)', level: 'AAA' },
  { sc: '1.2.9', name: 'Audio-only (Live)', level: 'AAA' },
  { sc: '1.3.1', name: 'Info and Relationships', level: 'A' },
  { sc: '1.3.2', name: 'Meaningful Sequence', level: 'A' },
  { sc: '1.3.3', name: 'Sensory Characteristics', level: 'A' },
  { sc: '1.3.4', name: 'Orientation', level: 'AA' },
  { sc: '1.3.5', name: 'Identify Input Purpose', level: 'AA' },
  { sc: '1.3.6', name: 'Identify Purpose', level: 'AAA' },
  { sc: '1.4.1', name: 'Use of Color', level: 'A' },
  { sc: '1.4.2', name: 'Audio Control', level: 'A' },
  { sc: '1.4.3', name: 'Contrast (Minimum)', level: 'AA' },
  { sc: '1.4.4', name: 'Resize Text', level: 'AA' },
  { sc: '1.4.5', name: 'Images of Text', level: 'AA' },
  { sc: '1.4.6', name: 'Contrast (Enhanced)', level: 'AAA' },
  { sc: '1.4.7', name: 'Low or No Background Audio', level: 'AAA' },
  { sc: '1.4.8', name: 'Visual Presentation', level: 'AAA' },
  { sc: '1.4.9', name: 'Images of Text (No Exception)', level: 'AAA' },
  { sc: '1.4.10', name: 'Reflow', level: 'AA' },
  { sc: '1.4.11', name: 'Non-text Contrast', level: 'AA' },
  { sc: '1.4.12', name: 'Text Spacing', level: 'AA' },
  { sc: '1.4.13', name: 'Content on Hover or Focus', level: 'AA' },
  // Principle 2 — Operable
  { sc: '2.1.1', name: 'Keyboard', level: 'A' },
  { sc: '2.1.2', name: 'No Keyboard Trap', level: 'A' },
  { sc: '2.1.3', name: 'Keyboard (No Exception)', level: 'AAA' },
  { sc: '2.1.4', name: 'Character Key Shortcuts', level: 'A' },
  { sc: '2.2.1', name: 'Timing Adjustable', level: 'A' },
  { sc: '2.2.2', name: 'Pause, Stop, Hide', level: 'A' },
  { sc: '2.2.3', name: 'No Timing', level: 'AAA' },
  { sc: '2.2.4', name: 'Interruptions', level: 'AAA' },
  { sc: '2.2.5', name: 'Re-authenticating', level: 'AAA' },
  { sc: '2.2.6', name: 'Timeouts', level: 'AAA' },
  { sc: '2.3.1', name: 'Three Flashes or Below Threshold', level: 'A' },
  { sc: '2.3.2', name: 'Three Flashes', level: 'AAA' },
  { sc: '2.3.3', name: 'Animation from Interactions', level: 'AAA' },
  { sc: '2.4.1', name: 'Bypass Blocks', level: 'A' },
  { sc: '2.4.2', name: 'Page Titled', level: 'A' },
  { sc: '2.4.3', name: 'Focus Order', level: 'A' },
  { sc: '2.4.4', name: 'Link Purpose (In Context)', level: 'A' },
  { sc: '2.4.5', name: 'Multiple Ways', level: 'AA' },
  { sc: '2.4.6', name: 'Headings and Labels', level: 'AA' },
  { sc: '2.4.7', name: 'Focus Visible', level: 'AA' },
  { sc: '2.4.8', name: 'Location', level: 'AAA' },
  { sc: '2.4.9', name: 'Link Purpose (Link Only)', level: 'AAA' },
  { sc: '2.4.10', name: 'Section Headings', level: 'AAA' },
  { sc: '2.4.11', name: 'Focus Not Obscured (Minimum)', level: 'AA' },
  { sc: '2.4.12', name: 'Focus Not Obscured (Enhanced)', level: 'AAA' },
  { sc: '2.4.13', name: 'Focus Appearance', level: 'AAA' },
  { sc: '2.5.1', name: 'Pointer Gestures', level: 'A' },
  { sc: '2.5.2', name: 'Pointer Cancellation', level: 'A' },
  { sc: '2.5.3', name: 'Label in Name', level: 'A' },
  { sc: '2.5.4', name: 'Motion Actuation', level: 'A' },
  { sc: '2.5.5', name: 'Target Size (Enhanced)', level: 'AAA' },
  { sc: '2.5.6', name: 'Concurrent Input Mechanisms', level: 'AAA' },
  { sc: '2.5.7', name: 'Dragging Movements', level: 'AA' },
  { sc: '2.5.8', name: 'Target Size (Minimum)', level: 'AA' },
  // Principle 3 — Understandable
  { sc: '3.1.1', name: 'Language of Page', level: 'A' },
  { sc: '3.1.2', name: 'Language of Parts', level: 'AA' },
  { sc: '3.1.3', name: 'Unusual Words', level: 'AAA' },
  { sc: '3.1.4', name: 'Abbreviations', level: 'AAA' },
  { sc: '3.1.5', name: 'Reading Level', level: 'AAA' },
  { sc: '3.1.6', name: 'Pronunciation', level: 'AAA' },
  { sc: '3.2.1', name: 'On Focus', level: 'A' },
  { sc: '3.2.2', name: 'On Input', level: 'A' },
  { sc: '3.2.3', name: 'Consistent Navigation', level: 'AA' },
  { sc: '3.2.4', name: 'Consistent Identification', level: 'AA' },
  { sc: '3.2.5', name: 'Change on Request', level: 'AAA' },
  { sc: '3.2.6', name: 'Consistent Help', level: 'A' },
  { sc: '3.3.1', name: 'Error Identification', level: 'A' },
  { sc: '3.3.2', name: 'Labels or Instructions', level: 'A' },
  { sc: '3.3.3', name: 'Error Suggestion', level: 'AA' },
  { sc: '3.3.4', name: 'Error Prevention (Legal, Financial, Data)', level: 'AA' },
  { sc: '3.3.5', name: 'Help', level: 'AAA' },
  { sc: '3.3.6', name: 'Error Prevention (All)', level: 'AAA' },
  { sc: '3.3.7', name: 'Redundant Entry', level: 'A' },
  { sc: '3.3.8', name: 'Accessible Authentication (Minimum)', level: 'AA' },
  { sc: '3.3.9', name: 'Accessible Authentication (Enhanced)', level: 'AAA' },
  // Principle 4 — Robust
  { sc: '4.1.1', name: 'Parsing (obsolete in WCAG 2.2)', level: 'A' },
  { sc: '4.1.2', name: 'Name, Role, Value', level: 'A' },
  { sc: '4.1.3', name: 'Status Messages', level: 'AA' },
];

/** Lookup map: SC string → criterion. */
export const WCAG_BY_SC: ReadonlyMap<string, WcagCriterion> = new Map(
  WCAG_22_CRITERIA.map((c) => [c.sc, c]),
);