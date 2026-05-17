// SPDX-License-Identifier: EUPL-1.2
/**
 * Swedish DOS-lagen (Lag 2018:1937 om tillgänglighet till digital offentlig
 * service) accessibility-statement JSON emitter.
 *
 * Targets the statement format mandated by DIGG (Myndigheten för digital
 * förvaltning) under Directive 2016/2102 and its Swedish transposition.
 * Output JSON renders to the legally required statement page.
 *
 * @see https://www.digg.se/digital-tillganglighet
 * @see https://www.riksdagen.se/sv/dokument-lagar/dokument/svensk-forfattningssamling/lag-20181937-om-tillganglighet-till-digital_sfs-2018-1937
 */

import type { Violation, ReportMeta, DosLagenReport, DosLagenStatus } from './types.js';

const TILLSYN_URL_DEFAULT = 'https://www.digg.se/tillgangligheten-till-digital-offentlig-service';

const IMPACT_RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 } as const;

function aggregateStatus(violations: Violation[]): DosLagenStatus {
  if (violations.length === 0) return 'helt-forenlig';
  let maxRank = 0;
  for (const v of violations) maxRank = Math.max(maxRank, IMPACT_RANK[v.impact]);
  if (maxRank >= 3) return 'ej-forenlig';
  return 'delvis-forenlig';
}

function motiveringText(status: DosLagenStatus, violations: Violation[]): string {
  switch (status) {
    case 'helt-forenlig':
      return 'Webbplatsen är helt förenlig med WCAG 2.2 nivå AA samt EN 301 549 v3.2.1 kapitel 11. Inga kända brister har identifierats vid den senaste utvärderingen.';
    case 'delvis-forenlig':
      return `Webbplatsen är delvis förenlig med WCAG 2.2 nivå AA på grund av ${violations.length} kända brister som listas nedan. Bristerna har måttlig påverkan och kan kringgås av flertalet användare.`;
    case 'ej-forenlig':
      return `Webbplatsen är inte förenlig med WCAG 2.2 nivå AA. Det finns ${violations.length} kända brister, varav minst en med allvarlig påverkan som kan blockera användning för personer med funktionsvariation. Åtgärdsplan finns nedan.`;
  }
}

function paverkadAnvandareText(v: Violation): string {
  // Heuristic mapping by impact + WCAG SC area
  const sc = v.wcag[0] ?? '';
  if (sc.startsWith('1.4')) {
    return 'Personer med nedsatt syn eller färgseende.';
  }
  if (sc.startsWith('2.1') || sc.startsWith('2.4')) {
    return 'Personer som navigerar med tangentbord eller hjälpmedel.';
  }
  if (sc.startsWith('1.1') || sc.startsWith('1.2')) {
    return 'Personer som använder skärmläsare eller andra hjälpmedel för textinnehåll.';
  }
  if (sc.startsWith('3.3')) {
    return 'Personer med kognitiva funktionsvariationer som behöver tydliga felmeddelanden.';
  }
  return 'Personer som använder hjälpmedel som skärmläsare eller talsyntes.';
}

/**
 *
 */
export interface DosLagenOptions {
  /** Contact details (required by DOS-lagen art. 7). */
  kontakt: {
    epost: string;
    organisation: string;
    url?: string;
    telefon?: string;
  };
  /** Override default DIGG enforcement URL. */
  tillsynUrl?: string;
  /** Override publication date (defaults to meta.evaluationDate). */
  publiceringsdatum?: string;
  /** Override last revision date (defaults to meta.evaluationDate). */
  senasteRevision?: string;
  /** Methodology summary override (Swedish). */
  utvarderingsmetod?: string;
  /** Custom Swedish header per violation; default derives from description. */
  rubrikFn?: (v: Violation) => string;
}

/**
 * Emit a DOS-lagen accessibility statement JSON.
 */
export function emitDosLagen(
  violations: Violation[],
  meta: ReportMeta,
  options: DosLagenOptions,
): DosLagenReport {
  const status = aggregateStatus(violations);
  const rubrikFn = options.rubrikFn ?? ((v) => v.description);

  const ickeForenligaInnehall: DosLagenReport['ickeForenligaInnehall'] = violations.map((v) => {
    const item: DosLagenReport['ickeForenligaInnehall'][number] = {
      rubrik: rubrikFn(v),
      beskrivning: v.help,
      wcag: v.wcag,
      paverkadAnvandare: paverkadAnvandareText(v),
    };
    if (v.en301549) item.en301549 = v.en301549;
    return item;
  });

  const kontakt: DosLagenReport['kontakt'] = {
    epost: options.kontakt.epost,
    organisation: options.kontakt.organisation,
  };
  if (options.kontakt.url !== undefined) kontakt.url = options.kontakt.url;
  if (options.kontakt.telefon !== undefined) kontakt.telefon = options.kontakt.telefon;

  return {
    $schema: 'https://schemas.ariada.org/dos-lagen/2025.json',
    schemaVersion: '2025',
    meta,
    efterlevnadsstatus: status,
    efterlevnadsstatusMotivering: motiveringText(status, violations),
    ickeForenligaInnehall,
    kontakt,
    tillsynUrl: options.tillsynUrl ?? TILLSYN_URL_DEFAULT,
    publiceringsdatum: options.publiceringsdatum ?? meta.evaluationDate,
    senasteRevision: options.senasteRevision ?? meta.evaluationDate,
    utvarderingsmetod:
      options.utvarderingsmetod ??
      meta.methodology ??
      'Automatisk utvärdering med Ariada-skannern.',
  };
}