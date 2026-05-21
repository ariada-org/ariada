// SPDX-License-Identifier: EUPL-1.2
/**
 * EAA / national-law penalty exposure estimator.
 *
 * Estimates the financial penalty exposure for an accessibility violation
 * set under a given jurisdiction's transposition of Directive (EU) 2019/882
 * (European Accessibility Act) and adjacent consumer-protection laws.
 *
 * NOT LEGAL ADVICE — this is an empirical risk-modelling tool to inform
 * remediation prioritisation. Penalty levels are statutory maxima per
 * cited law; actual enforcement varies widely. Always consult counsel
 * before relying on figures for budgeting.
 *
 * Sources per jurisdiction (see {@link JURISDICTION_PROFILES}):
 *   - SE: Lag 2018:1937 (DOS-lagen) + Marknadsföringslagen
 *   - NO: Likestillings- og diskrimineringsloven §17 + tilgjengelighetsforskriften
 *   - DK: Lov om tilgængelighed (LBK 692/2020)
 *   - FI: Saavutettavuuslaki 306/2019
 *   - DE: Barrierefreiheitsstärkungsgesetz (BFSG, 2021) + UWG
 *   - FR: Loi 2005-102 art.47 + Décret 2019-768
 *   - NL: Tijdelijk besluit digitale toegankelijkheid overheid
 *         (consumer Wbtw transposition pending — Q4 2025)
 *   - AT: WZG 2020 + Konsumentenschutzgesetz
 *   - CH: BehiG (not EU member; included for completeness)
 *   - UK: Equality Act 2010 + EHRC enforcement
 *   - EU: aggregate ceiling per DSA art. 35 + UCPD 2005/29
 *
 * @see https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882
 * @see https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32005L0029
 */

import type { Violation } from '@ariada-org/evidence-emitter';

/**
 *
 */
export type Jurisdiction = 'SE' | 'NO' | 'DK' | 'FI' | 'DE' | 'FR' | 'NL' | 'AT' | 'CH' | 'UK' | 'EU';

/**
 *
 */
export interface JurisdictionProfile {
  /** ISO 3166-1 alpha-2 code (or 'EU' for the aggregate). */
  code: Jurisdiction;
  /** Display name. */
  name: string;
  /** Statutory maximum penalty per single infringement, EUR. */
  maxPenaltyEur: number;
  /** Per-violation base fine, EUR. */
  baseFineEur: number;
  /** Multiplier for serious / critical impact. */
  seriousMultiplier: number;
  /** Multiplier for banking-sector (EAA Annex I §I.4). */
  bankingMultiplier: number;
  /** Multiplier for e-commerce (EAA Annex I §I.3). */
  ecommerceMultiplier: number;
  /** Cited law references. */
  lawReferences: string[];
  /** Enforcement authority. */
  authority: string;
  /** % of statutory max actually enforced (empirical, 0..1). */
  enforcementFactor: number;
}

export const JURISDICTION_PROFILES: Record<Jurisdiction, JurisdictionProfile> = {
  // Nordic — EAA transposed via national law; relatively low fines but
  // DPA-style enforcement (DIGG, Difi, Digst, Avi). Names cap.
  SE: {
    code: 'SE',
    name: 'Sweden',
    maxPenaltyEur: 1_000_000, // sectoral cap via Marknadsföringslagen (sanktionsavgift)
    baseFineEur: 25_000,
    seriousMultiplier: 3,
    bankingMultiplier: 1.5,
    ecommerceMultiplier: 1.2,
    lawReferences: [
      'Lag 2018:1937 (DOS-lagen) art. 7',
      'Marknadsföringslagen (2008:486) §26 sanktionsavgift',
      'Patent- och marknadsdomstolen rulings 2021-2024',
    ],
    authority: 'DIGG (Myndigheten för digital förvaltning)',
    enforcementFactor: 0.3,
  },
  NO: {
    code: 'NO',
    name: 'Norway',
    maxPenaltyEur: 500_000,
    baseFineEur: 15_000,
    seriousMultiplier: 3,
    bankingMultiplier: 1.5,
    ecommerceMultiplier: 1.2,
    lawReferences: [
      'Likestillings- og diskrimineringsloven §17',
      'Forskrift om universell utforming av IKT-løsninger',
      'Difi/Diftek tilsynsbeslutninger',
    ],
    authority: 'Digitaliseringsdirektoratet (Digdir)',
    enforcementFactor: 0.25,
  },
  DK: {
    code: 'DK',
    name: 'Denmark',
    maxPenaltyEur: 800_000,
    baseFineEur: 20_000,
    seriousMultiplier: 3,
    bankingMultiplier: 1.5,
    ecommerceMultiplier: 1.2,
    lawReferences: [
      'LBK 692/2020 (lov om tilgængelighed)',
      'BEK 1377/2019 om webtilgængelighed',
    ],
    authority: 'Digitaliseringsstyrelsen (Digst)',
    enforcementFactor: 0.3,
  },
  FI: {
    code: 'FI',
    name: 'Finland',
    maxPenaltyEur: 1_000_000,
    baseFineEur: 30_000,
    seriousMultiplier: 3,
    bankingMultiplier: 1.5,
    ecommerceMultiplier: 1.2,
    lawReferences: [
      'Saavutettavuuslaki 306/2019',
      'Hallintolaki 434/2003 §43–44 (uhkasakko)',
    ],
    authority: 'Etelä-Suomen aluehallintovirasto (Avi)',
    enforcementFactor: 0.4,
  },

  // Continental EU — larger markets, UCPD-based enforcement.
  DE: {
    code: 'DE',
    name: 'Germany',
    maxPenaltyEur: 100_000, // BFSG §37 — €100k per infringement
    baseFineEur: 50_000,
    seriousMultiplier: 5, // BfIT enforcement track-record
    bankingMultiplier: 2.0, // BaFin overlap
    ecommerceMultiplier: 1.5,
    lawReferences: [
      'Barrierefreiheitsstärkungsgesetz (BFSG, BGBl. 2021 I 970) §37',
      'Gesetz gegen den unlauteren Wettbewerb (UWG) §3a',
      'BIK / BfIT enforcement decisions 2022-2025',
    ],
    authority: 'Marktüberwachungsbehörden der Länder + BfIT',
    enforcementFactor: 0.5,
  },
  FR: {
    code: 'FR',
    name: 'France',
    maxPenaltyEur: 75_000, // Décret 2019-768 art.10 (after PCAJ 2023 amendment)
    baseFineEur: 20_000,
    seriousMultiplier: 4,
    bankingMultiplier: 2.0,
    ecommerceMultiplier: 1.5,
    lawReferences: [
      'Loi 2005-102 art. 47 (modifié 2023)',
      'Décret 2019-768 (RGAA) art. 10',
      'DGCCRF enforcement reports',
    ],
    authority: 'DINUM + DGCCRF',
    enforcementFactor: 0.4,
  },
  NL: {
    code: 'NL',
    name: 'Netherlands',
    maxPenaltyEur: 90_000,
    baseFineEur: 25_000,
    seriousMultiplier: 4,
    bankingMultiplier: 2.0,
    ecommerceMultiplier: 1.5,
    lawReferences: [
      'Tijdelijk besluit digitale toegankelijkheid overheid (Stb. 2018, 141)',
      'Wbtw EAA transposition (pending — Q4 2025 expected)',
      'College voor de Rechten van de Mens rulings',
    ],
    authority: 'Logius + College voor de Rechten van de Mens',
    enforcementFactor: 0.35,
  },
  AT: {
    code: 'AT',
    name: 'Austria',
    maxPenaltyEur: 80_000,
    baseFineEur: 20_000,
    seriousMultiplier: 4,
    bankingMultiplier: 2.0,
    ecommerceMultiplier: 1.5,
    lawReferences: [
      'Bundes-Behindertengleichstellungsgesetz (BGStG)',
      'Web-Zugänglichkeits-Gesetz (WZG, BGBl. 2018/I/82)',
      'Konsumentenschutzgesetz (KSchG) §28a',
    ],
    authority: 'Bundeskanzleramt + Volksanwaltschaft',
    enforcementFactor: 0.3,
  },
  CH: {
    code: 'CH',
    name: 'Switzerland',
    maxPenaltyEur: 50_000, // BehiG penalty levels via federal court precedent
    baseFineEur: 10_000,
    seriousMultiplier: 3,
    bankingMultiplier: 1.5,
    ecommerceMultiplier: 1.2,
    lawReferences: [
      'Behindertengleichstellungsgesetz (BehiG, SR 151.3)',
      'Eidgenössisches Büro für die Gleichstellung von Menschen mit Behinderungen (EBGB)',
    ],
    authority: 'EBGB',
    enforcementFactor: 0.2,
  },
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    maxPenaltyEur: 0, // see notes below — uncapped under Equality Act
    baseFineEur: 35_000, // EHRC settlement average
    seriousMultiplier: 5,
    bankingMultiplier: 2.0,
    ecommerceMultiplier: 1.5,
    lawReferences: [
      'Equality Act 2010 §29 (services to public)',
      'Public Sector Bodies (Websites and Mobile Applications) Accessibility Regulations 2018/952',
      'EHRC enforcement statement 2022',
    ],
    authority: 'Equality and Human Rights Commission (EHRC)',
    enforcementFactor: 0.4,
  },
  EU: {
    code: 'EU',
    name: 'EU at-large (aggregate)',
    maxPenaltyEur: 35_000_000, // DSA art. 35 — 6% of global turnover or €35M (whichever higher)
    baseFineEur: 100_000,
    seriousMultiplier: 6,
    bankingMultiplier: 2.5,
    ecommerceMultiplier: 2.0,
    lawReferences: [
      'Directive (EU) 2019/882 art. 30 (penalties)',
      'Directive 2005/29/EC (UCPD) art. 13',
      'Regulation (EU) 2022/2065 (DSA) art. 35',
    ],
    authority: 'European Commission + national authorities',
    enforcementFactor: 0.1, // headline cases only
  },
};

const IMPACT_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 } as const;

/**
 *
 */
export interface EstimateOptions {
  /** Annual turnover EUR (DSA-style scaling). */
  annualTurnoverEur?: number;
  /** Override enforcement factor (0..1) for sensitivity analysis. */
  enforcementFactor?: number;
}

/**
 *
 */
export interface EstimateResult {
  /** Jurisdiction code. */
  jurisdiction: Jurisdiction;
  /** Statutory maximum cap, EUR. */
  maxPenaltyEur: number;
  /** Modelled expected risk (capped at maxPenaltyEur), EUR. */
  expectedRiskEur: number;
  /** Cited law references. */
  lawReferences: string[];
  /** Enforcement authority. */
  authority: string;
  /** Per-violation breakdown lines (human-readable). */
  explanation: string[];
}

/**
 * Estimate penalty exposure for a violation set under a given jurisdiction.
 *
 * @param violations - Normalized violation list (axe-core-compatible).
 * @param jurisdiction - 2-letter country code or 'EU' for aggregate.
 * @param options - Optional overrides (turnover, enforcement factor).
 */
export function estimatePenalty(
  violations: Violation[],
  jurisdiction: Jurisdiction,
  options: EstimateOptions = {},
): EstimateResult {
  const profile = JURISDICTION_PROFILES[jurisdiction];
  if (!profile) {
    throw new Error(`Unknown jurisdiction: ${jurisdiction}. Supported: ${listJurisdictions().join(', ')}.`);
  }

  const ef = options.enforcementFactor ?? profile.enforcementFactor;

  let rawExposureEur = 0;
  const explanation: string[] = [];

  for (const v of violations) {
    const nodes = v.nodeCount ?? 1;
    let perViolation = profile.baseFineEur;
    let secMultiplier = 1;

    if (IMPACT_RANK[v.impact] >= IMPACT_RANK.serious) {
      perViolation *= profile.seriousMultiplier;
    }
    if (v.eaaAnnexI?.includes('I.4')) {
      secMultiplier = Math.max(secMultiplier, profile.bankingMultiplier);
    }
    if (v.eaaAnnexI?.includes('I.3')) {
      secMultiplier = Math.max(secMultiplier, profile.ecommerceMultiplier);
    }
    perViolation *= secMultiplier;
    perViolation *= Math.min(nodes, 10); // diminishing returns past 10 nodes

    const expected = perViolation * ef;
    rawExposureEur += expected;
    explanation.push(
      `Rule ${v.id} (${v.impact}, ${nodes} node(s)): base €${profile.baseFineEur.toLocaleString('en-GB')} × impact × sector ×${secMultiplier} × enforcement ${ef} = expected €${Math.round(expected).toLocaleString('en-GB')}`,
    );
  }

  // DSA-style scaling: at €100M turnover, multiply by 1.5; clamp [1, 5]
  if (options.annualTurnoverEur && options.annualTurnoverEur > 10_000_000) {
    const scale = Math.min(5, Math.max(1, options.annualTurnoverEur / 100_000_000 + 1));
    rawExposureEur *= scale;
    explanation.push(
      `Turnover scaling: ×${scale.toFixed(2)} applied (turnover €${options.annualTurnoverEur.toLocaleString('en-GB')})`,
    );
  }

  // Cap at statutory max (UK uncapped → use raw)
  const cap = profile.maxPenaltyEur > 0 ? profile.maxPenaltyEur : Number.MAX_SAFE_INTEGER;
  const expectedRiskEur = Math.round(Math.min(rawExposureEur, cap));

  return {
    jurisdiction,
    maxPenaltyEur: profile.maxPenaltyEur > 0 ? profile.maxPenaltyEur : rawExposureEur,
    expectedRiskEur,
    lawReferences: profile.lawReferences,
    authority: profile.authority,
    explanation,
  };
}

/**
 * Return the list of supported jurisdiction codes.
 */
export function listJurisdictions(): Jurisdiction[] {
  return Object.keys(JURISDICTION_PROFILES) as Jurisdiction[];
}