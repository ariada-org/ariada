// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Recognising what a page is, from its address and the words that lead to it.
 *
 * The monitoring methodology names pages by role — home, login, sitemap,
 * contact, help, legal, the accessibility statement, the feedback mechanism.
 * A crawler only has a URL and a link label, and those are written in the
 * language of the country being monitored. A German municipality has no page
 * called "contact"; it has "Kontakt". So the vocabulary is the substance here,
 * not an afterthought, and it covers the same languages the statement generator
 * writes in.
 *
 * Matching is deliberately conservative. A false positive puts the wrong page in
 * an audit sample and the report then claims to have checked something it did
 * not; a false negative is reported as an unsatisfied clause, which is visible
 * and can be corrected by hand. Between the two, we prefer the visible failure.
 */

import type { DiscoveredPage, PageRole } from './types.js';

/**
 * Terms per role, across the languages the accessibility statement is written
 * in: English, Swedish, Norwegian, Danish, Finnish, German, French, Dutch,
 * Spanish, Italian, Polish, Portuguese. Terms are lower-cased and matched
 * without diacritics, because URLs routinely strip them.
 */
const ROLE_TERMS: Record<Exclude<PageRole, 'home' | 'document'>, readonly string[]> = {
  login: [
    'login', 'log-in', 'signin', 'sign-in', 'logga-in', 'logg-inn', 'log-ind',
    'kirjaudu', 'anmelden', 'anmeldung', 'connexion', 'se-connecter', 'inloggen',
    'aanmelden', 'iniciar-sesion', 'acceso', 'accedi', 'login-utente',
    'logowanie', 'zaloguj', 'entrar', 'iniciar-sessao',
  ],
  sitemap: [
    'sitemap', 'site-map', 'webbkarta', 'nettstedskart', 'sitekort', 'sivukartta',
    'sitemap-xml', 'inhaltsverzeichnis', 'seitenubersicht', 'plan-du-site',
    'sitemap-nl', 'mapa-del-sitio', 'mappa-del-sito', 'mapa-strony',
    'mapa-do-site', 'mapa-do-sitio',
  ],
  contact: [
    'contact', 'contacts', 'kontakt', 'kontakta-oss', 'kontakt-oss', 'yhteystiedot',
    'ota-yhteytta', 'kontakta', 'contactez-nous', 'nous-contacter', 'contacto',
    'contactar', 'contatti', 'contattaci', 'contacten', 'neem-contact-op',
    'kontakty', 'napisz-do-nas', 'contactos', 'fale-connosco',
  ],
  help: [
    'help', 'support', 'hjalp', 'hjelp', 'hjaelp', 'apua', 'tuki', 'hilfe',
    'unterstutzung', 'aide', 'assistance', 'hulp', 'ondersteuning', 'ayuda',
    'soporte', 'aiuto', 'assistenza', 'pomoc', 'ajuda', 'suporte', 'faq',
  ],
  legal: [
    'legal', 'legal-notice', 'terms', 'terms-of-use', 'privacy', 'imprint',
    'impressum', 'rechtliches', 'datenschutz', 'mentions-legales',
    'juridisk-information', 'villkor', 'personvern', 'juridisk', 'betingelser',
    'kayttoehdot', 'tietosuoja', 'juridisch', 'voorwaarden', 'privacyverklaring',
    'aviso-legal', 'terminos', 'privacidad', 'note-legali', 'termini',
    'informativa-privacy', 'nota-prawna', 'regulamin', 'polityka-prywatnosci',
    'aviso-legal-pt', 'termos', 'privacidade',
  ],
  'accessibility-statement': [
    'accessibility', 'accessibility-statement', 'tillganglighet',
    'tillganglighetsredogorelse', 'tilgjengelighet', 'tilgjengelighetserklaring',
    'tilgaengelighed', 'tilgaengelighedserklaring', 'saavutettavuus',
    'saavutettavuusseloste', 'barrierefreiheit', 'erklarung-zur-barrierefreiheit',
    'accessibilite', 'declaration-d-accessibilite', 'toegankelijkheid',
    'toegankelijkheidsverklaring', 'accesibilidad', 'declaracion-de-accesibilidad',
    'accessibilita', 'dichiarazione-di-accessibilita', 'dostepnosc',
    'deklaracja-dostepnosci', 'acessibilidade', 'declaracao-de-acessibilidade',
  ],
  feedback: [
    'feedback', 'synpunkter', 'tilbakemelding', 'tilbagemelding', 'palaute',
    'ruckmeldung', 'kontaktformular', 'retour', 'signaler', 'terugkoppeling',
    'meldpunt', 'comentarios', 'sugerencias', 'segnalazione', 'riscontri',
    'zglos', 'uwagi', 'comentarios-pt', 'reclamacoes',
  ],
  search: [
    'search', 'sok', 'soek', 'haku', 'suche', 'recherche', 'zoeken', 'buscar',
    'busqueda', 'cerca', 'ricerca', 'szukaj', 'wyszukiwarka', 'pesquisa', 'procurar',
  ],
};

/** Extensions the methodology's clause (e) is about: downloadable documents. */
const DOCUMENT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.odt', '.xls', '.xlsx', '.ods', '.ppt', '.pptx', '.odp', '.rtf', '.epub',
];

const DOCUMENT_CONTENT_TYPES = [
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats',
  'application/vnd.oasis.opendocument', 'application/epub',
];

/** Lower-case and strip diacritics, so `Tillgänglighet` matches `tillganglighet`. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_\s]+/g, '-');
}

/** Is this page the site's home page? */
function isHome(page: DiscoveredPage): boolean {
  if (page.depth === 0) return true;
  try {
    const u = new URL(page.url);
    return u.pathname === '/' || u.pathname === '';
  } catch {
    return false;
  }
}

/** Does the page look like a downloadable document rather than a web page? */
export function isDocument(page: DiscoveredPage): boolean {
  const type = (page.contentType ?? '').toLowerCase();
  if (DOCUMENT_CONTENT_TYPES.some((t) => type.startsWith(t))) return true;
  let path = '';
  try {
    path = new URL(page.url).pathname.toLowerCase();
  } catch {
    path = page.url.toLowerCase();
  }
  return DOCUMENT_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Work out which role, if any, a discovered page plays. Returns `undefined`
 * when nothing matches — which is the common case and not a failure: most pages
 * of a site are ordinary content pages, and those belong to clauses (b) and (d),
 * not (a).
 */
export function classifyRole(page: DiscoveredPage): PageRole | undefined {
  if (isHome(page)) return 'home';
  if (isDocument(page)) return 'document';

  let haystack = '';
  try {
    const u = new URL(page.url);
    haystack = fold(`${u.pathname} ${u.search}`);
  } catch {
    haystack = fold(page.url);
  }
  const label = fold(`${page.linkText ?? ''} ${page.title ?? ''}`);

  // The accessibility statement is checked first: several of its terms contain a
  // legal-page term as a substring, and putting the statement in the legal bucket
  // would silently drop clause (c) — the one clause an accessibility audit can
  // least afford to miss.
  const ordered: Array<Exclude<PageRole, 'home' | 'document'>> = [
    'accessibility-statement', 'feedback', 'login', 'sitemap', 'contact', 'help', 'search', 'legal',
  ];

  for (const role of ordered) {
    const terms = ROLE_TERMS[role];
    if (terms.some((t) => haystack.includes(t) || label.includes(t))) return role;
  }
  return undefined;
}

/** Exposed so a caller can show which vocabulary a decision came from. */
export const ROLE_VOCABULARY = ROLE_TERMS;
