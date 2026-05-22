// SPDX-License-Identifier: EUPL-1.2
/**
 * Reference jurisdiction plugin — Sweden.
 *
 * Statute citations:
 *
 *   - Lag (2023:254) om vissa produkters och tjänsters tillgänglighet
 *     (Tillgänglighetslagen). Implements Directive (EU) 2019/882.
 *   - Lag (2018:1937) om tillgänglighet till digital offentlig service
 *     (DOS-lagen). Implements Directive (EU) 2016/2102.
 *
 * Supervisory authority: Myndigheten för digital förvaltning (DIGG).
 *
 * @see https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2023254-om-vissa-produkters-och-tjansters_sfs-2023-254/
 * @see https://www.digg.se/digital-tillganglighet
 */

import type { JurisdictionPlugin } from '../plugin.js';
import { computePassRate } from '../plugin.js';
import type { JurisdictionSubset, PartialScanContext } from '../types.js';

export const SE_TOTAL_CRITERIA = 50;

export const sePlugin: JurisdictionPlugin = {
  jurisdictionCode: 'SE',
  jurisdictionLabel: 'Sweden (Tillgänglighetslagen + DOS-lagen)',
  governingRegulation: 'Lag (2023:254) + Lag (2018:1937)',
  technicalStandard: 'EN 301 549 v3.2.1 + WCAG 2.2 Level AA',
  supervisoryAuthority: 'Myndigheten för digital förvaltning (DIGG)',

  tldHints: ['se'],
  metaHints: ['legal:se-tillganglighetslagen'],
  langAttrHints: ['sv', 'sv-se'],

  rulePackId: '@ariada-org/wcag-rules-extended',
  rulePackVersion: '0.1.0',

  emitJurisdictionSubset(context: PartialScanContext): JurisdictionSubset {
    const findings = context.findings.filter((f) => f.jurisdictionTags.includes('SE'));
    return {
      jurisdictionCode: 'SE',
      jurisdictionLabel: 'Sweden (Tillgänglighetslagen + DOS-lagen)',
      governingRegulation: 'Lag (2023:254) + Lag (2018:1937)',
      technicalStandard: 'EN 301 549 v3.2.1 + WCAG 2.2 Level AA',
      findings: findings.map((f) => f.findingId),
      passRate: computePassRate(findings, SE_TOTAL_CRITERIA),
      pendingManualReview: 0,
      evidence: {
        statementJurisdiction:
          'Tillgänglighetsredogörelse enligt DIGG-mallen (Lag 2018:1937 + Lag 2023:254).',
        vpatSection: 'EN 301 549 / WCAG 2.2 AA',
      },
    };
  },
};
