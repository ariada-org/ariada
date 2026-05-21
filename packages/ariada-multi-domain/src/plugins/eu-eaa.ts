// SPDX-License-Identifier: EUPL-1.2
/**
 * Reference jurisdiction plugin — EU European Accessibility Act
 * umbrella (Directive (EU) 2019/882) with EN 301 549 v3.2.1 + WCAG 2.2
 * Level AA as the technical baseline.
 *
 * This is a minimal reference example. Production-grade plugins ship
 * a per-jurisdiction rule pack, VPAT subsection emitter, and locale-
 * specific accessibility-statement renderer — all of which are out of
 * scope for the single-jurisdiction reference orchestrator.
 *
 * Statute + standard citations are deliberately included so the plugin
 * doubles as living documentation for plugin authors.
 *
 * @see https://eur-lex.europa.eu/eli/dir/2019/882/oj
 * @see https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf
 * @see https://www.w3.org/TR/WCAG22/
 */

import type { JurisdictionPlugin } from '../plugin.js';
import { computePassRate } from '../plugin.js';
import type { JurisdictionSubset, PartialScanContext } from '../types.js';

export const EU_EAA_TOTAL_CRITERIA = 50; // WCAG 2.2 Level A + AA combined.

export const euEaaPlugin: JurisdictionPlugin = {
  jurisdictionCode: 'EU-EAA',
  jurisdictionLabel: 'European Accessibility Act (Directive (EU) 2019/882)',
  governingRegulation: 'Directive (EU) 2019/882',
  technicalStandard: 'EN 301 549 v3.2.1 clause 9 + WCAG 2.2 Level AA',
  supervisoryAuthority: 'EU-level via Member-State authorities (per Art. 14)',

  tldHints: ['eu'],
  metaHints: ['legal:eu-eaa'],
  langAttrHints: [],

  rulePackId: '@ariada-org/wcag-rules-extended',
  rulePackVersion: '0.1.0',

  emitJurisdictionSubset(context: PartialScanContext): JurisdictionSubset {
    const findings = context.findings.filter((f) =>
      f.jurisdictionTags.includes('EU-EAA'),
    );
    return {
      jurisdictionCode: 'EU-EAA',
      jurisdictionLabel: 'European Accessibility Act (Directive (EU) 2019/882)',
      governingRegulation: 'Directive (EU) 2019/882',
      technicalStandard: 'EN 301 549 v3.2.1 clause 9 + WCAG 2.2 Level AA',
      findings: findings.map((f) => f.findingId),
      passRate: computePassRate(findings, EU_EAA_TOTAL_CRITERIA),
      pendingManualReview: 0,
      evidence: {
        statementJurisdiction:
          'Accessibility statement under Article 13 + Annex V of Directive (EU) 2019/882.',
        vpatSection: 'EN 301 549 / WCAG 2.2 AA',
      },
    };
  },
};
