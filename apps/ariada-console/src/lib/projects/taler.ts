// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// The first dogfood PROJECT: the GNU Taler / GNUnet ("никс") ecosystem. One
// selectable entity grouping every resource — core surfaces, the two pilot
// banks, partners, and the grant-funded module landings (see
// grants/TALER_ECOSYSTEM_CATALOG_2026-07-30.md). Rows feed AUDITS_BOARD.
// Metrics (score/findings/…) are populated from the scan API at load; the
// catalog only fixes identity + scan target + group, never fabricated numbers.

export interface AuditRow {
  id: string;
  label: string;
  url: string;
  group: 'core' | 'bank' | 'partner' | 'grantee-module';
  owner: string;
  scanStatus: 'scanned' | 'to-scan';
  score: number | null;
  critical: number | null;
  serious: number | null;
  findings: number | null;
  blastRadius: number | null;
  gate: 'pass' | 'blocked' | 'unknown';
  reverter: 'none' | 'recommended' | 'remediated';
}

export interface Project {
  id: string;
  name: string;
  kind: 'dogfood' | 'customer';
  resources: AuditRow[];
}

const pending = { score: null, critical: null, serious: null, findings: null, blastRadius: null, gate: 'unknown', reverter: 'none' } as const;

export const TALER_PROJECT: Project = {
  id: 'taler',
  name: 'GNU Taler ecosystem',
  kind: 'dogfood',
  resources: [
    // A. core — already scanned (real counts from the ui-audit run, 2026-07-27)
    { id: 'taler-site', label: 'Taler — project site', url: 'https://www.taler.net/en/index.html', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 9, critical: 0, serious: 3, findings: 5, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    { id: 'taler-docs', label: 'Taler — documentation', url: 'https://docs.taler.net', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 8, critical: 0, serious: 13, findings: 14, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    { id: 'taler-demo', label: 'Taler — demo showcase', url: 'https://demo.taler.net', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 10, critical: 0, serious: 2, findings: 4, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    { id: 'taler-shop', label: 'Taler — demo shop', url: 'https://shop.demo.taler.net', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 10, critical: 0, serious: 2, findings: 4, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    { id: 'taler-bank', label: 'Taler — demo bank', url: 'https://bank.demo.taler.net', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 9, critical: 0, serious: 6, findings: 8, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    { id: 'taler-backend', label: 'Taler — merchant backend (login)', url: 'https://backend.demo.taler.net', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 1, critical: 6, serious: 5, findings: 17, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    { id: 'taler-wallet', label: 'Taler wallet — full UI', url: 'https://addons.mozilla.org/firefox/addon/taler-wallet/', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 9, critical: 0, serious: 4, findings: 8, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    { id: 'taler-popup', label: 'Taler wallet — confirm popup', url: 'https://addons.mozilla.org/firefox/addon/taler-wallet/', group: 'core', owner: 'GNU Taler', scanStatus: 'scanned', score: 9, critical: 0, serious: 4, findings: 8, blastRadius: null, gate: 'blocked', reverter: 'recommended' },
    // B. pilot banks — to scan (EAA-obligated adopters)
    { id: 'gls-bank', label: 'GLS Bank — Taler', url: 'https://www.gls.de/privatkunden/taler', group: 'bank', owner: 'GLS Bank', scanStatus: 'to-scan', ...pending },
    { id: 'magnet-bank', label: 'MagNet Bank', url: 'https://www.magnetbank.hu', group: 'bank', owner: 'MagNet Bank', scanStatus: 'to-scan', ...pending },
    // C. partners — to scan
    { id: 'taler-systems', label: 'Taler Systems SA', url: 'https://www.taler-systems.com', group: 'partner', owner: 'Taler Systems SA', scanStatus: 'to-scan', ...pending },
    { id: 'gnunet', label: 'GNUnet e.V.', url: 'https://gnunet.org/en/', group: 'partner', owner: 'GNUnet e.V.', scanStatus: 'to-scan', ...pending },
    { id: 'bfh', label: 'BFH (Bern UAS)', url: 'https://ti.bfh.ch', group: 'partner', owner: 'BFH', scanStatus: 'to-scan', ...pending },
    { id: 'tue', label: 'TU Eindhoven', url: 'https://www.tue.nl', group: 'partner', owner: 'TU/e', scanStatus: 'to-scan', ...pending },
    { id: 'codeblau', label: 'Code Blau GmbH', url: 'https://www.codeblau.de', group: 'partner', owner: 'Code Blau', scanStatus: 'to-scan', ...pending },
    { id: 'visualvest', label: 'VisualVest', url: 'https://www.visualvest.de', group: 'partner', owner: 'VisualVest', scanStatus: 'to-scan', ...pending },
    { id: 'ps-taler', label: 'petites singularités — Taler', url: 'https://ps.lesoiseaux.io/taler', group: 'partner', owner: 'petites singularités', scanStatus: 'to-scan', ...pending },
    { id: 'eseniors', label: 'E-Seniors', url: 'https://www.eseniors.eu', group: 'partner', owner: 'E-Seniors', scanStatus: 'to-scan', ...pending },
    { id: 'homodigitalis', label: 'Homo Digitalis', url: 'https://www.homodigitalis.gr', group: 'partner', owner: 'Homo Digitalis', scanStatus: 'to-scan', ...pending },
    // D. NGI TALER grant-funded module landings ("никс" grantees) — to scan
    { id: 'g-lookup', label: 'Wallet ID Lookup Service', url: 'https://nlnet.nl/project/TALER-LookupService', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-oim', label: 'Road Signs for Digital Payments', url: 'https://nlnet.nl/project/TALER-OIM', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-bullion', label: 'TALER Bullion', url: 'https://nlnet.nl/project/TALER-Bullion', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-mte', label: 'MTE (MirageOS Taler Exchange)', url: 'https://nlnet.nl/project/MTE', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-odoo', label: 'Taler-Odoo module', url: 'https://nlnet.nl/project/TALER-Odoo-module', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-tryton', label: 'Tryton / GNUHealth integration', url: 'https://nlnet.nl/project/TALER-Tryton', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-interledger', label: 'Interledger interoperability study', url: 'https://nlnet.nl/project/TALER-Interledger-study', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-obg', label: 'Open Banking Gateway', url: 'https://nlnet.nl/project/TALER-OpenBankingGateway', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-flohmarkt', label: 'Flohmarkt', url: 'https://nlnet.nl/project/TALER-flohmarkt', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-nuxt', label: 'Nuxt/Vue.js payment module', url: 'https://nlnet.nl/project/TALER-integration-Nuxt', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-dolibarr', label: 'Taler-Dolibarr', url: 'https://nlnet.nl/project/Taler-Dolibarr', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-contributron', label: 'Contributron', url: 'https://nlnet.nl/project/Contributron', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-xbsd', label: 'xBSD (Taler on BSD)', url: 'https://nlnet.nl/project/Taler-on-BSD', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-php', label: 'TalerPHP', url: 'https://nlnet.nl/project/TalerPHP', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-ruby', label: 'Libre Payments in Ruby (OFN)', url: 'https://nlnet.nl/project/TALER-Ruby-OFN', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-liberapay', label: 'Taler in Liberapay', url: 'https://nlnet.nl/project/TALER-Liberapay', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
    { id: 'g-openapi', label: 'Taler OpenAPI Specification', url: 'https://nlnet.nl/project/TALER-APIs', group: 'grantee-module', owner: 'NGI TALER', scanStatus: 'to-scan', ...pending },
  ],
};

export const PROJECTS: Project[] = [TALER_PROJECT];
