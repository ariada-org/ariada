// SPDX-License-Identifier: EUPL-1.2
/**
 * Reference jurisdiction plugin — Germany.
 *
 * Statute citation: Barrierefreiheitsstärkungsgesetz (BFSG), enacted
 * 2021-07-16, implementing Directive (EU) 2019/882. BFSGV implementing
 * regulation provides the technical detail.
 *
 * Supervisory authority: Marktüberwachungsbehörden der Länder
 * (16 federal-state market-surveillance authorities), with
 * cross-coordination through Bundesamt für Justiz.
 *
 * @see https://www.gesetze-im-internet.de/bfsg/
 * @see https://www.bafa.de/DE/Wirtschafts_Mittelstandsfoerderung/Barrierefreiheit/barrierefreiheit_node.html
 */

import type { JurisdictionPlugin } from '../plugin.js';
import { computePassRate } from '../plugin.js';
import type { JurisdictionSubset, PartialScanContext } from '../types.js';

export const DE_TOTAL_CRITERIA = 50;

export const dePlugin: JurisdictionPlugin = {
  jurisdictionCode: 'DE-BFSG',
  jurisdictionLabel: 'Germany (Barrierefreiheitsstärkungsgesetz)',
  governingRegulation: 'Barrierefreiheitsstärkungsgesetz (BFSG) 2021-07-16',
  technicalStandard: 'EN 301 549 v3.2.1 + BITV 2.0 + WCAG 2.2 Level AA',
  supervisoryAuthority: 'Marktüberwachungsbehörden der Länder',

  tldHints: ['de'],
  metaHints: ['legal:de-bfsg'],
  langAttrHints: ['de', 'de-de'],

  rulePackId: '@ariada/wcag-rules-extended',
  rulePackVersion: '0.1.0',

  emitJurisdictionSubset(context: PartialScanContext): JurisdictionSubset {
    const findings = context.findings.filter((f) =>
      f.jurisdictionTags.includes('DE-BFSG'),
    );
    return {
      jurisdictionCode: 'DE-BFSG',
      jurisdictionLabel: 'Germany (Barrierefreiheitsstärkungsgesetz)',
      governingRegulation: 'Barrierefreiheitsstärkungsgesetz (BFSG) 2021-07-16',
      technicalStandard: 'EN 301 549 v3.2.1 + BITV 2.0 + WCAG 2.2 Level AA',
      findings: findings.map((f) => f.findingId),
      passRate: computePassRate(findings, DE_TOTAL_CRITERIA),
      pendingManualReview: 0,
      evidence: {
        statementJurisdiction:
          'Erklärung zur Barrierefreiheit gemäß BFSG / BITV 2.0.',
        vpatSection: 'EN 301 549 / BITV 2.0 / WCAG 2.2 AA',
      },
    };
  },
};
