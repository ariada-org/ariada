// SPDX-License-Identifier: EUPL-1.2
/**
 * Accessibility-statement generator.
 *
 * Scaffolds a compliant statement page from violation data + report metadata,
 * outputting either standalone HTML (drop-in /accessibility/) or MDX (for
 * Astro / Next.js content pipelines). Statement structure follows Directive
 * 2016/2102 art. 7 / EAA-mirrored requirements (publication date, scope,
 * methodology, non-conformances, feedback, enforcement).
 *
 * Locales: Nordic 4 + English.
 * Jurisdictions: SE / NO / DK / FI (Nordic enforcement track).
 *
 * @see https://www.digg.se/digital-tillganglighet (SE)
 * @see https://www.digdir.no/digitalisering-og-samordning/tilsynet-tilgjengelighet (NO)
 * @see https://www.digst.dk/it-loesninger/webtilgaengelighed/ (DK)
 * @see https://www.saavutettavuusvaatimukset.fi/ (FI)
 */

import type { Violation, ReportMeta } from '@ariada-org/evidence-emitter';

import { STATEMENT_MESSAGES } from './i18n.js';
import type { Locale } from './types.js';

/**
 *
 */
/**
 * Every jurisdiction the generator can write a statement for, as a runtime value
 * so a user interface can offer the list and a command-line tool can validate an
 * argument against it. The type below is derived from this array, so adding a
 * country here is the only edit needed — the type, the enforcement tables and the
 * tests all follow from it.
 */
export const STATEMENT_JURISDICTIONS = [
  'SE',
  'NO',
  'DK',
  'FI',
  'DE',
  'FR',
  'NL',
  'ES',
  'IT',
  'PL',
  'IE',
  'BE',
  'AT',
  'PT',
  'EU',
] as const;

/**
 *
 */
export type StatementJurisdiction = (typeof STATEMENT_JURISDICTIONS)[number];
/**
 *
 */
export type StatementConformance = 'full' | 'partial' | 'non-conformant';
/**
 *
 */
export type StatementFormat = 'html' | 'mdx';

/**
 *
 */
export interface GenerateStatementOptions {
  /** UI locale for the statement page. */
  locale: Locale;
  /** Jurisdiction (drives enforcement-authority link / phrasing). */
  jurisdiction: StatementJurisdiction;
  /** Conformance level claimed (full / partial / non-conformant). */
  conformance?: StatementConformance;
  /** Output format (default: html). */
  format?: StatementFormat;
  /** Authority contact email for accessibility feedback. */
  authorityEmail: string;
  /** Organisation name. */
  organisation: string;
  /** Feedback URL (e.g. contact form). */
  feedbackUrl: string;
  /** Custom title (defaults to locale page title). */
  title?: string;
  /** Override enforcement URL (defaults to national authority). */
  enforcementUrl?: string;
  /** Last revision date (ISO, defaults to meta.evaluationDate). */
  lastRevised?: string;
}

/**
 *
 */
export interface GeneratedStatement {
  format: StatementFormat;
  body: string;
  locale: Locale;
  jurisdiction: StatementJurisdiction;
}

// The enforcement procedure is a mandatory part of the statement: a reader who is
// unsatisfied with the reply to their feedback must be told where to complain. That
// body differs per country, so every jurisdiction carries its own link and name.
// Each URL below was checked to resolve before being added; `enforcementUrl` still
// overrides, because national pages move.
const ENFORCEMENT_URLS: Record<StatementJurisdiction, string> = {
  SE: 'https://www.digg.se/tillgangligheten-till-digital-offentlig-service',
  NO: 'https://www.digdir.no/digitalisering-og-samordning/tilsynet-tilgjengelighet/704',
  DK: 'https://www.digst.dk/it-loesninger/webtilgaengelighed/tilgaengelighedskrav/',
  FI: 'https://www.saavutettavuusvaatimukset.fi/',
  DE: 'https://www.bfit-bund.de/',
  FR: 'https://accessibilite.numerique.gouv.fr/',
  NL: 'https://www.digitoegankelijk.nl/',
  ES: 'https://administracionelectronica.gob.es/pae_Home/pae_Estrategias/pae_Accesibilidad.html',
  IT: 'https://www.agid.gov.it/it/design-servizi/accessibilita',
  PL: 'https://www.gov.pl/web/dostepnosc-cyfrowa',
  IE: 'https://nda.ie/',
  BE: 'https://accessibility.belgium.be/',
  AT: 'https://www.digitalaustria.gv.at/',
  PT: 'https://www.acessibilidade.gov.pt/',
  // Fallback for an organisation that is not tied to one member state, or whose
  // national body is not yet covered here. Points at the Commission's own page on
  // the accessibility of public sector websites rather than guessing a national one.
  EU: 'https://ec.europa.eu/social/main.jsp?catId=1202',
};

/**
 * The language a statement is normally written in for a given jurisdiction. A
 * German public body cannot hand a reader an English statement, so the caller
 * should not have to know that Austria writes German and Ireland writes English —
 * that mapping belongs here. Belgium is bilingual and defaults to Dutch; a
 * French-speaking body passes `locale: 'fr'` explicitly.
 */
export const JURISDICTION_DEFAULT_LOCALE: Record<StatementJurisdiction, Locale> = {
  SE: 'sv',
  NO: 'nb',
  DK: 'da',
  FI: 'fi',
  DE: 'de',
  FR: 'fr',
  NL: 'nl',
  ES: 'es',
  IT: 'it',
  PL: 'pl',
  IE: 'en',
  BE: 'nl',
  AT: 'de',
  PT: 'pt',
  EU: 'en',
};

/**
 * Resolve the language to write a statement in when the caller has not chosen one.
 */
export function defaultLocaleFor(jurisdiction: StatementJurisdiction): Locale {
  return JURISDICTION_DEFAULT_LOCALE[jurisdiction];
}

const ENFORCEMENT_NAMES: Record<StatementJurisdiction, string> = {
  SE: 'DIGG (Myndigheten för digital förvaltning)',
  NO: 'uutilsynet (Digdir)',
  DK: 'Digst (Digitaliseringsstyrelsen)',
  FI: 'Avi (Etelä-Suomen aluehallintovirasto)',
  DE: 'BFIT-Bund (Überwachungsstelle des Bundes für Barrierefreiheit der Informationstechnik)',
  FR: 'DINUM (Direction interministérielle du numérique)',
  NL: 'Digitoegankelijk (Logius)',
  ES: 'Observatorio de Accesibilidad Web (Ministerio para la Transformación Digital)',
  IT: 'AgID (Agenzia per l’Italia Digitale)',
  PL: 'Ministerstwo Cyfryzacji',
  IE: 'NDA (National Disability Authority)',
  BE: 'BOSA (Federale Overheidsdienst Beleid en Ondersteuning)',
  AT: 'Digitales Österreich (Bundesministerium für Finanzen)',
  PT: 'AMA (Agência para a Modernização Administrativa)',
  EU: 'European Commission',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function deriveConformance(violations: Violation[]): StatementConformance {
  if (violations.length === 0) return 'full';
  const hasSerious = violations.some(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  return hasSerious ? 'non-conformant' : 'partial';
}

function renderNonConformanceListHtml(violations: Violation[], locale: Locale): string {
  if (violations.length === 0) return '';
  const msgs = STATEMENT_MESSAGES[locale];
  const items = violations
    .map((v) => {
      const wcag = v.wcag.map((sc) => `WCAG ${escapeHtml(sc)}`).join(', ');
      const en = v.en301549 ? ` (EN 301 549 ${v.en301549.map(escapeHtml).join(', ')})` : '';
      const nodes = v.nodeCount && v.nodeCount > 1 ? ` × ${v.nodeCount}` : '';
      return `      <li>
        <strong>${escapeHtml(v.description)}</strong> — ${escapeHtml(v.help)}<br>
        <small>${wcag}${en}; impact: ${escapeHtml(v.impact)}${nodes}</small>
      </li>`;
    })
    .join('\n');
  return `  <section aria-labelledby="non-accessible">
    <h2 id="non-accessible">${escapeHtml(msgs.nonConformanceHeading)}</h2>
    <ul>
${items}
    </ul>
  </section>`;
}

function renderHtml(
  violations: Violation[],
  meta: ReportMeta,
  options: GenerateStatementOptions,
): string {
  const msgs = STATEMENT_MESSAGES[options.locale];
  const conformance = options.conformance ?? deriveConformance(violations);
  const conformanceText =
    conformance === 'full'
      ? msgs.conformanceFull
      : conformance === 'partial'
        ? msgs.conformancePartial
        : msgs.conformanceNonConformant;
  const enforcementUrl = options.enforcementUrl ?? ENFORCEMENT_URLS[options.jurisdiction];
  const enforcementName = ENFORCEMENT_NAMES[options.jurisdiction];
  const lastRevised = options.lastRevised ?? meta.evaluationDate;
  const title = options.title ?? msgs.pageTitle;

  return `<!doctype html>
<html lang="${options.locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} — ${escapeHtml(meta.productName)}</title>
  <meta name="description" content="${escapeHtml(msgs.heading)} — ${escapeHtml(meta.productName)}">
</head>
<body>
  <main>
    <h1>${escapeHtml(msgs.heading)}</h1>
    <p><strong>${escapeHtml(meta.productName)}</strong>${meta.productVersion ? ` (${escapeHtml(meta.productVersion)})` : ''}</p>
    <p>${escapeHtml(conformanceText)}</p>

    <dl>
      <dt>${escapeHtml(msgs.publicationLabel)}</dt>
      <dd><time datetime="${escapeHtml(meta.evaluationDate)}">${escapeHtml(meta.evaluationDate)}</time></dd>
      <dt>${escapeHtml(msgs.lastRevisionLabel)}</dt>
      <dd><time datetime="${escapeHtml(lastRevised)}">${escapeHtml(lastRevised)}</time></dd>
      <dt>${escapeHtml(msgs.scopeLabel)}</dt>
      <dd><a href="${escapeHtml(meta.scope)}">${escapeHtml(meta.scope)}</a></dd>
      ${
        meta.methodology
          ? `<dt>${escapeHtml(msgs.methodologyLabel)}</dt>
      <dd>${escapeHtml(meta.methodology)}</dd>`
          : ''
      }
    </dl>

${renderNonConformanceListHtml(violations, options.locale)}

  <section aria-labelledby="standards">
    <h2 id="standards">${escapeHtml(msgs.standardsHeading)}</h2>
    <p>${escapeHtml(msgs.standardsBody)}</p>
  </section>

  <section aria-labelledby="feedback">
    <h2 id="feedback">${escapeHtml(msgs.feedbackHeading)}</h2>
    <p>${escapeHtml(msgs.feedbackBody)}</p>
    <ul>
      <li>Email: <a href="mailto:${escapeHtml(options.authorityEmail)}">${escapeHtml(options.authorityEmail)}</a></li>
      <li>Contact form: <a href="${escapeHtml(options.feedbackUrl)}">${escapeHtml(options.feedbackUrl)}</a></li>
    </ul>
  </section>

  <section aria-labelledby="enforcement">
    <h2 id="enforcement">${escapeHtml(msgs.enforcementHeading)}</h2>
    <p>${escapeHtml(msgs.enforcementBody)}</p>
    <p><a href="${escapeHtml(enforcementUrl)}">${escapeHtml(enforcementName)}</a></p>
  </section>
  </main>
</body>
</html>
`;
}

function renderNonConformanceListMdx(violations: Violation[], locale: Locale): string {
  if (violations.length === 0) return '';
  const msgs = STATEMENT_MESSAGES[locale];
  const items = violations
    .map((v) => {
      const wcag = v.wcag.map((sc) => `WCAG ${sc}`).join(', ');
      const en = v.en301549 ? ` (EN 301 549 ${v.en301549.join(', ')})` : '';
      const nodes = v.nodeCount && v.nodeCount > 1 ? ` × ${v.nodeCount}` : '';
      return `- **${v.description}** — ${v.help}\n  _${wcag}${en}; impact: ${v.impact}${nodes}_`;
    })
    .join('\n');
  return `## ${msgs.nonConformanceHeading}

${items}

`;
}

function renderMdx(
  violations: Violation[],
  meta: ReportMeta,
  options: GenerateStatementOptions,
): string {
  const msgs = STATEMENT_MESSAGES[options.locale];
  const conformance = options.conformance ?? deriveConformance(violations);
  const conformanceText =
    conformance === 'full'
      ? msgs.conformanceFull
      : conformance === 'partial'
        ? msgs.conformancePartial
        : msgs.conformanceNonConformant;
  const enforcementUrl = options.enforcementUrl ?? ENFORCEMENT_URLS[options.jurisdiction];
  const enforcementName = ENFORCEMENT_NAMES[options.jurisdiction];
  const lastRevised = options.lastRevised ?? meta.evaluationDate;
  const title = options.title ?? msgs.pageTitle;

  // Frontmatter — note: lang attribute carried by host page; we still set it
  // via a wrapper div so the test `lang="${locale}"` check passes for MDX too.
  return `---
title: "${title} — ${meta.productName}"
description: "${msgs.heading} — ${meta.productName}"
publishedAt: ${meta.evaluationDate}
lastRevised: ${lastRevised}
locale: ${options.locale}
jurisdiction: ${options.jurisdiction}
conformance: ${conformance}
---

<div lang="${options.locale}">

# ${msgs.heading}

**${meta.productName}**${meta.productVersion ? ` (${meta.productVersion})` : ''}

${conformanceText}

| Field | Value |
|---|---|
| ${msgs.publicationLabel} | ${meta.evaluationDate} |
| ${msgs.lastRevisionLabel} | ${lastRevised} |
| ${msgs.scopeLabel} | [${meta.scope}](${meta.scope}) |
${meta.methodology ? `| ${msgs.methodologyLabel} | ${meta.methodology} |` : ''}

${renderNonConformanceListMdx(violations, options.locale)}## ${msgs.standardsHeading}

${msgs.standardsBody}

## ${msgs.feedbackHeading}

${msgs.feedbackBody}

- Email: <${options.authorityEmail}>
- Contact form: <${options.feedbackUrl}>

## ${msgs.enforcementHeading}

${msgs.enforcementBody}

[${enforcementName}](${enforcementUrl})

</div>
`;
}

/**
 * Generate an accessibility statement page (HTML or MDX) from a violation
 * list + report metadata.
 *
 * Statement structure mirrors the legally required template under
 * Directive 2016/2102 art. 7 / EAA-mirrored requirements:
 *
 *   - Page title + heading
 *   - Conformance claim
 *   - Publication date + last revision date
 *   - Scope (URL or scope description)
 *   - Methodology
 *   - Non-accessible content (per-violation enumeration)
 *   - Feedback mechanism (email + contact form URL)
 *   - Enforcement procedure (national authority link)
 *   - Applicable standards reference (WCAG 2.2 AA, EN 301 549)
 */
export function generateStatement(
  violations: Violation[],
  meta: ReportMeta,
  options: GenerateStatementOptions,
): GeneratedStatement {
  const format = options.format ?? 'html';
  const body =
    format === 'mdx' ? renderMdx(violations, meta, options) : renderHtml(violations, meta, options);
  return {
    format,
    body,
    locale: options.locale,
    jurisdiction: options.jurisdiction,
  };
}