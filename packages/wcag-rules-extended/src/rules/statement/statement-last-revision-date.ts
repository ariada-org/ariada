// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Rule: ariada/statement/last-revision-date
 *
 * The accessibility statement MUST declare a "last revised" date in addition
 * to the publication date. This proves the statement is maintained rather
 * than abandoned at first publication.
 *
 * The check accepts any of the multi-language tokens:
 *   "last updated" / "last revised" / "last reviewed" /
 *   "senast uppdaterad" / "senest oppdatert" / "senest opdateret" /
 *   "viimeksi päivitetty" / "päivitetty viimeksi" /
 *   "revidiert" / "mis à jour"
 * followed by a `<time datetime="YYYY-MM-DD">` or text date.
 *
 * EN 301 549 v3.2.1: 12.1.1.
 * Directive 2016/2102 implementation guidance (CE Decision (EU) 2018/1523).
 */

import type { CheckEvaluate, RuleDefinition, RuleMetadata } from '../../types.js';

import { isStatementPage, statementText } from './_shared.js';

const HELP_URL =
  'https://github.com/ariada-org/ariada/blob/main/packages/wcag-rules-extended/docs/rules/statement-last-revision-date.md';

export const metadata: RuleMetadata = {
  description: 'Accessibility statement must declare last-revision date.',
  help: 'Add "Last updated: <time datetime=YYYY-MM-DD>" or localised equivalent.',
  helpUrl: HELP_URL,
  wcag: ['3.2.6'],
  en301549: ['12.1.1'],
  eaaAnnexI: ['I.1'],
  impact: 'minor',
};

// Word-boundary only at the start of the alternation. JS regex `\b` does not
// recognise non-ASCII word chars (ä, å, ö, é), so trailing `\b` fails after
// e.g. `päivit` if the next char is part of the same morpheme.
//
// English idiom coverage: `last updated`, `updated`, `last revised`, `revised`,
// `last reviewed`, `reviewed`. The "last" prefix is optional — many statements
// say "Revised 2026-05-01" or "Reviewed Q2 2026" without the "last" qualifier.
// The bare `revis` stem catches both `revised` and `revision`.
// Nordic locale coverage: Swedish `senast uppdaterad` / `uppdaterad`, Norwegian
// `sist oppdatert` / `oppdatert`, Danish `senest opdateret` / `opdateret`,
// Finnish `viimeksi päivitetty` / `päivitetty viimeksi` / bare `päivit`.
const REVISION_TOKEN_RE =
  /\b((last\s+)?updated|(last\s+)?revis|(last\s+)?reviewed|(senast\s+)?uppdater|(sist\s+)?oppdat|(senest\s+)?opdater|viimeksi\s+päivit|päivitetty\s+viimeksi|päivit|revidiert|mis\s+à\s+jour)/i;

const NEAR_DATE_RE = /\b\d{1,2}\s+\w+\s+\d{4}|\b\d{4}-\d{2}-\d{2}\b/;

export const check: CheckEvaluate = (node) => {
  const document = node.ownerDocument;
  if (!isStatementPage(document)) return true;
  const text = statementText(document);
  // Find every revision-token occurrence; pass if any has a date within 80
  // chars. Earlier first-match-only logic falsed when a page also quoted
  // the phrase (e.g. inside a `<q>Last reviewed</q>` disclosure block) far
  // from the actual revision date in the Provenance section.
  const matches = Array.from(text.matchAll(new RegExp(REVISION_TOKEN_RE.source, 'gi')));
  if (matches.length === 0) return false;
  return matches.some((m) => {
    const index = m.index ?? 0;
    const window = text.substring(index, Math.min(index + 80, text.length));
    return NEAR_DATE_RE.test(window);
  });
};

export const rule: RuleDefinition = {
  id: 'ariada/statement/last-revision-date',
  selector: 'html',
  any: ['ariada/statement/has-revision-date'],
  all: [],
  none: [],
  tags: ['cat.semantics', 'wcag22a', 'wcag326', 'EAA', 'EAA-I1'],
  metadata,
};

export const checkDefinition = {
  id: 'ariada/statement/has-revision-date',
  evaluate: check,
  metadata: {
    impact: metadata.impact,
    messages: {
      pass: 'Statement declares last-revised date.',
      fail: 'Statement is missing a "last revised" / "senast uppdaterad" date marker.',
    },
  },
};
