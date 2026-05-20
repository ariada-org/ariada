// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Action-items section — top-10 prioritised remediation tasks.
 *
 * One `<li>` per item, anchor-linked to the matching violation card. Persona
 * US-C4 (stakeholder, shallow read) is the primary audience.
 */

import { escapeHtml } from '../escape.js';
import { topActionItems } from '../score.js';
import type { ScanFinding, Severity } from '../types.js';

import { findingAnchorId, sortFindings } from './violation-card.js';

const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
};

const MAX_ITEMS = 10;

/**
 * Render the action-items list. Returns the empty string when there are no
 * findings — caller suppresses the surrounding section.
 */
export function renderActionItems(findings: readonly ScanFinding[]): string {
  if (findings.length === 0) {
    return '';
  }
  const top = topActionItems(findings, MAX_ITEMS);
  // Anchor IDs are computed from the SORTED-order index (matches violation
  // cards), so resolve each finding's sorted index up front.
  const sorted = sortFindings(findings);
  const indexOf = new Map<ScanFinding, number>();
  for (const [index, finding] of sorted.entries()) indexOf.set(finding, index);

  const items = top
    .map((finding) => {
      const index = indexOf.get(finding) ?? 0;
      const anchor = findingAnchorId(finding, index);
      const nodeCount = finding.nodes.length === 0 ? 1 : finding.nodes.length;
      const instancesText = `${nodeCount} ${nodeCount === 1 ? 'instance' : 'instances'}`;
      return `<li class="action-items__item">
      <a href="#${escapeHtml(anchor)}" class="action-items__link">
        <span class="action-items__badge action-items__badge--${finding.impact}" aria-label="Severity: ${escapeHtml(SEVERITY_LABEL[finding.impact])}">${escapeHtml(SEVERITY_LABEL[finding.impact])}</span>
        <span class="action-items__text">Fix ${escapeHtml(instancesText)} of <em>${escapeHtml(finding.description)}</em></span>
      </a>
    </li>`;
    })
    .join('\n    ');

  return `<section class="action-items" aria-labelledby="action-items-heading">
  <h2 id="action-items-heading">Top ${Math.min(MAX_ITEMS, top.length)} action items</h2>
  <ol class="action-items__list">
    ${items}
  </ol>
</section>`;
}
