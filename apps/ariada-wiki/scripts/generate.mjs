#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import locales from '@agonist/localization/wiki-locales.json';
import messages from '@agonist/localization/wiki-messages.json';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_SOURCE = path.resolve(APP_ROOT, 'data/channel-matrix.json');
const OUTPUT_ROOT = path.resolve(APP_ROOT, 'dist');
const SITE_URL = 'https://wiki.ariada.org';
const EXPECTED_MODULES = 236;
const LOCALE_CODES = Object.freeze(locales.map((locale) => locale.code));

const CSS = String.raw`
:root {
  --ink: #13213c;
  --muted: #53627a;
  --paper: #fffdf8;
  --surface: #ffffff;
  --line: #d7deeb;
  --blue: #0b3b8f;
  --blue-deep: #082862;
  --blue-soft: #e8f0ff;
  --gold: #e4ab36;
  --focus-ring-dark: #765000;
  --focus-ring-light: #ffffff;
  --good: #176b46;
  --radius: 14px;
  --shadow: 0 16px 45px rgba(14, 35, 75, 0.09);
  --shell: min(1120px, calc(100vw - 2rem));
  color-scheme: light;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  color: var(--ink);
  background:
    radial-gradient(circle at 8% 8%, rgba(228, 171, 54, 0.12), transparent 28rem),
    linear-gradient(180deg, #f5f8ff 0, var(--paper) 25rem);
  font-family: "Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif;
  font-size: 1rem;
  line-height: 1.65;
}
a { color: #0b4ba6; text-underline-offset: 0.16em; }
a:hover { color: #082d68; }
a:focus-visible, input:focus-visible {
  outline: 3px solid var(--focus-ring-light);
  outline-offset: 2px;
  box-shadow: 0 0 0 5px var(--focus-ring-dark) !important;
}
.skip-link {
  position: fixed;
  inset-inline-start: 1rem;
  top: -5rem;
  z-index: 2000;
  padding: 0.7rem 1rem;
  color: #071b42;
  background: #fff;
  border-radius: 0 0 8px 8px;
}
.skip-link:focus { top: 0; }
.site-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  color: #fff;
  background: linear-gradient(110deg, var(--blue-deep), var(--blue));
  box-shadow: 0 8px 28px rgba(4, 23, 63, 0.22);
}
.header-row {
  width: var(--shell);
  min-height: 3.5rem;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.brand, .main-site {
  color: #fff;
  text-decoration: none;
}
.brand {
  font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  font-size: 1.28rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.brand-mark { color: #ffd579; }
.main-site { font-size: 0.84rem; opacity: 0.88; }
.locale-switcher {
  direction: ltr;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: thin;
  background: rgba(2, 22, 63, 0.35);
  border-top: 1px solid rgba(255,255,255,0.16);
}
.locale-track {
  width: max-content;
  min-width: 100%;
  min-height: 3rem;
  padding: 0.42rem max(1rem, calc((100vw - 1120px) / 2));
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}
.flag-link {
  width: 2.18rem;
  height: 2.18rem;
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  color: #fff;
  text-decoration: none;
  font-size: 1.2rem;
  line-height: 1;
}
.flag-link:hover { background: rgba(255,255,255,0.14); }
.flag-link[aria-current="page"] {
  color: #071b42;
  background: #fff;
  border-color: #fff;
  box-shadow: 0 0 0 3px rgba(228,171,54,0.72);
}
.shell { width: var(--shell); margin: 0 auto; }
main { min-height: 62vh; padding: clamp(2rem, 5vw, 5.4rem) 0 4rem; }
.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(1.5rem, 4vw, 3.3rem);
  border: 1px solid rgba(11,59,143,0.18);
  border-radius: calc(var(--radius) + 8px);
  background: rgba(255,255,255,0.88);
  box-shadow: var(--shadow);
}
.hero::after {
  content: "";
  position: absolute;
  width: 14rem;
  height: 14rem;
  inset-inline-end: -6rem;
  top: -7rem;
  border: 2rem solid rgba(11,59,143,0.06);
  border-radius: 50%;
  pointer-events: none;
}
.eyebrow {
  margin: 0 0 0.45rem;
  color: var(--blue);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
h1, h2, h3 {
  font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  line-height: 1.15;
  text-wrap: balance;
}
h1 { margin: 0; font-size: clamp(2.1rem, 6vw, 4.5rem); letter-spacing: -0.035em; }
h2 { margin: 0 0 0.9rem; font-size: clamp(1.45rem, 3vw, 2.15rem); }
h3 { margin: 0; font-size: 1.16rem; }
.lead { max-width: 52rem; margin: 1rem 0 0; color: var(--muted); font-size: 1.08rem; }
.fallback-note {
  margin: 1rem 0 0;
  padding: 0.7rem 0.9rem;
  border-inline-start: 4px solid var(--gold);
  color: #4b432c;
  background: #fff8e7;
}
.stats {
  margin: 1.5rem 0 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;
}
.stat {
  padding: 0.85rem 1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}
.stat strong { display: block; font-size: 1.35rem; }
.stat span { color: var(--muted); font-size: 0.83rem; }
.catalog-tools { margin: 2rem 0 1rem; }
.search {
  width: min(100%, 38rem);
  padding: 0.85rem 1rem;
  border: 1px solid #aebbd1;
  border-radius: 10px;
  color: var(--ink);
  background: #fff;
  font: inherit;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}
.module-card {
  min-width: 0;
  padding: 1.15rem;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: rgba(255,255,255,0.91);
  box-shadow: 0 8px 22px rgba(14,35,75,0.05);
}
.module-card[hidden] { display: none; }
.module-card a { color: var(--ink); text-decoration-thickness: 0.08em; }
.module-card p { margin: 0.7rem 0 0; color: var(--muted); }
.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}
.module-id, .badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 1.65rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}
.module-id { color: #fff; background: var(--blue); }
.badge { color: #174b34; background: #e6f4ec; border: 1px solid #b8dfc9; }
.back { display: inline-flex; margin-bottom: 1rem; font-weight: 700; }
.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18rem;
  gap: 1.5rem;
  align-items: start;
  margin-top: 1.5rem;
}
.detail-content, .evidence-panel {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: rgba(255,255,255,0.92);
  box-shadow: 0 8px 24px rgba(14,35,75,0.05);
}
.detail-content { padding: clamp(1.2rem, 3vw, 2.2rem); }
.detail-section + .detail-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--line);
}
.evidence-panel { position: sticky; top: 8rem; padding: 1rem; }
.evidence-list { margin: 0; display: grid; gap: 0.85rem; }
.evidence-list div { min-width: 0; }
.evidence-list dt { color: var(--muted); font-size: 0.76rem; font-weight: 800; text-transform: uppercase; }
.evidence-list dd { margin: 0.18rem 0 0; overflow-wrap: anywhere; }
code {
  padding: 0.12rem 0.34rem;
  border: 1px solid #d9deea;
  border-radius: 5px;
  color: #27364e;
  background: #f2f4f8;
  overflow-wrap: anywhere;
}
.link-list { padding-inline-start: 1.2rem; }
.site-footer {
  border-top: 1px solid var(--line);
  color: var(--muted);
  background: rgba(255,255,255,0.74);
}
.footer-inner {
  width: var(--shell);
  margin: 0 auto;
  padding: 1.7rem 0 2.1rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.88rem;
}
.footer-inner p { margin: 0; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
[dir="rtl"] .hero::after { inset-inline-end: auto; inset-inline-start: -6rem; }
@media (max-width: 760px) {
  :root { --shell: min(100% - 1.1rem, 1120px); }
  .header-row { min-height: 3.2rem; }
  .main-site { display: none; }
  .locale-track { justify-content: flex-start; padding-inline: 0.6rem; }
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .module-grid, .detail-layout { grid-template-columns: 1fr; }
  .evidence-panel { position: static; }
  main { padding-top: 1.3rem; }
  .footer-inner { padding-inline: 0.2rem; }
}
@media (max-width: 380px) {
  .hero { padding: 1.15rem; }
  .stats { grid-template-columns: 1fr; }
  .card-top { display: grid; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
}
`;

const CATALOG_JS = String.raw`
(() => {
  const input = document.querySelector('[data-module-search]');
  const cards = [...document.querySelectorAll('[data-module-card]')];
  if (!input || cards.length === 0) return;
  const normalize = (value) => value.toLocaleLowerCase().normalize('NFKD');
  input.addEventListener('input', () => {
    const query = normalize(input.value.trim());
    for (const card of cards) {
      card.hidden = query.length > 0 && !normalize(card.dataset.search || '').includes(query);
    }
  });
})();
`;

function assetDigest(content) {
  return createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
}

const CSS_BYTES = `${CSS.trim()}\n`;
const CATALOG_JS_BYTES = `${CATALOG_JS.trim()}\n`;
const ASSET_PATHS = Object.freeze({
  css: `/assets/wiki.${assetDigest(CSS_BYTES)}.css`,
  catalog: `/assets/catalog.${assetDigest(CATALOG_JS_BYTES)}.js`
});

function parseArgs(argv) {
  let check = false;
  for (const arg of argv) {
    if (arg === '--check') check = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/generate.mjs [--check]');
      process.exit(0);
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }
  return { check };
}

function readJson(file) {
  if (!existsSync(file)) throw new Error(`Required file is missing: ${file}`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function safeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

function isForbiddenAuthority(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function publicUrl(value) {
  if (!value) return null;
  const url = new URL(String(value));
  assert(url.protocol === 'https:' && !url.username && !url.password, `Unsafe public URL: ${value}`);
  assert(!isForbiddenAuthority(url.hostname), 'URL uses a non-public authority.');
  return url.href;
}

function validateContracts(matrix, locales, messages) {
  assert(Array.isArray(locales), 'Wiki locale registry must be an array.');
  assert(
    locales.length > 0 && new Set(LOCALE_CODES).size === locales.length,
    'Wiki locale registry must contain unique locale codes.'
  );
  const referenceMessageKeys = Object.keys(messages.en || {}).sort();
  assert(referenceMessageKeys.length > 0, 'Wiki message catalog must include the default locale.');
  const localeSet = new Set();
  for (const locale of locales) {
    assert(!localeSet.has(locale.code), `Duplicate Wiki locale: ${locale.code}`);
    localeSet.add(locale.code);
    assert(locale.label && locale.nativeName && locale.icon, `${locale.code} is missing accessible locale metadata.`);
    assert(locale.wikiPrefix === `/${locale.code}`, `${locale.code} has an invalid wikiPrefix.`);
    assert(locale.dir === ((locale.code === 'ar' || locale.code === 'he') ? 'rtl' : 'ltr'), `${locale.code} has invalid text direction.`);
    const bundle = messages[locale.code];
    assert(bundle && typeof bundle === 'object', `${locale.code} is missing Wiki messages.`);
    const keys = Object.keys(bundle).sort();
    assert(JSON.stringify(keys) === JSON.stringify(referenceMessageKeys), `${locale.code} has an invalid Wiki message key set.`);
    for (const key of referenceMessageKeys) assert(typeof bundle[key] === 'string' && bundle[key].trim(), `${locale.code}.${key} is empty.`);
  }

  assert(matrix?.wiki?.defaultLocale === 'en', 'Channel matrix default Wiki locale must be en.');
  assert(JSON.stringify(matrix?.wiki?.locales) === JSON.stringify(LOCALE_CODES), 'Channel matrix locales drift from the localization package.');
  publicUrl(matrix?.source?.repository);
  publicUrl(matrix?.source?.registry);
  assert(matrix?.source?.packCount === 24, 'Channel matrix pack count is invalid.');
  assert(Array.isArray(matrix.channels) && matrix.channels.length === EXPECTED_MODULES, `Expected ${EXPECTED_MODULES} channels.`);
  assert(
    JSON.stringify(Object.keys(matrix.counts || {}).sort()) ===
      JSON.stringify(['delivered', 'inDevelopment', 'planned', 'production', 'total']),
    'Channel matrix must expose only the declared public count fields.'
  );
  assert(matrix.counts.total === EXPECTED_MODULES, 'Channel matrix total count is invalid.');

  const ids = new Set();
  const stateCounts = { Planned: 0, 'In development': 0, Delivered: 0, Production: 0 };
  for (const channel of matrix.channels) {
    assert(/^S(?:[1-9]|[1-9]\d|1\d\d|2[0-2]\d|23[0-6])$/.test(channel.id), `Invalid channel id: ${channel.id}`);
    assert(!ids.has(channel.id), `Duplicate channel id: ${channel.id}`);
    ids.add(channel.id);
    assert(Number.isInteger(channel.number), `${channel.id}.number must be an integer.`);
    assert(channel.name && channel.description, `${channel.id} is missing public copy.`);
    assert(Array.isArray(channel.roles) && channel.roles.length, `${channel.id} is missing roles.`);
    assert(Array.isArray(channel.useCases) && channel.useCases.length, `${channel.id} is missing use cases.`);
    assert(Object.hasOwn(stateCounts, channel.state), channel.id + ' has invalid state casing: ' + channel.state);
    stateCounts[channel.state] += 1;
    assert(
      typeof channel.installation === 'string' && channel.installation.trim(),
      `${channel.id}.installation must be a non-empty string.`
    );
    assert(channel.wikiUrl === `${SITE_URL}/en/modules/${channel.id.toLowerCase()}/`, `${channel.id} has an invalid Wiki URL.`);
    publicUrl(channel.ariadaModuleUrl);
    if (channel.publicCodeUrl) publicUrl(channel.publicCodeUrl);
    if (channel.githubModuleUrl) publicUrl(channel.githubModuleUrl);
    if (channel.publicationUrl) publicUrl(channel.publicationUrl);
    if (channel.evidenceUrl) publicUrl(channel.evidenceUrl);
    if (channel.developmentEvidenceUrl) publicUrl(channel.developmentEvidenceUrl);
    assert(Array.isArray(channel.deliveryEvidenceUrls), `${channel.id}.deliveryEvidenceUrls must be an array.`);
    for (const evidenceUrl of channel.deliveryEvidenceUrls) publicUrl(evidenceUrl);
    assert(
      channel.updatedAt === null ||
        (typeof channel.updatedAt === 'string' && !Number.isNaN(Date.parse(channel.updatedAt))),
      `${channel.id}.updatedAt must be null or a valid timestamp.`
    );
  }
  for (let number = 1; number <= EXPECTED_MODULES; number += 1) {
    assert(ids.has(`S${number}`), `Missing channel S${number}.`);
  }
  assert(matrix.counts.planned === stateCounts.Planned, 'Planned count does not match channel states.');
  assert(matrix.counts.inDevelopment === stateCounts['In development'], 'In-development count does not match channel states.');
  assert(matrix.counts.delivered === stateCounts.Delivered, 'Delivered count does not match channel states.');
  assert(matrix.counts.production === stateCounts.Production, 'Production count does not match channel states.');
}

function routeFor(locale, slug = null) {
  return slug ? `/${locale}/modules/${slug}/` : `/${locale}/modules/`;
}

function absolute(pathname) {
  return `${SITE_URL}${pathname}`;
}

function alternateLinks(locales, slug = null, root = false) {
  if (slug) return '';
  const links = locales.map((locale) => {
    const pathname = root ? routeFor(locale.code) : routeFor(locale.code, slug);
    return `<link rel="alternate" hreflang="${escapeHtml(locale.code)}" href="${escapeHtml(absolute(pathname))}">`;
  });
  const defaultHref = root || !slug ? `${SITE_URL}/` : absolute(routeFor('en', slug));
  links.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(defaultHref)}">`);
  return links.join('\n');
}

function localeSwitcher(locales, currentLocale, slug = null) {
  const links = locales.map((locale) => {
    const current = locale.code === currentLocale ? ' aria-current="page"' : '';
    const href = routeFor(locale.code, slug);
    const label = `View in ${locale.nativeName}`;
    const hreflang = slug ? '' : ` hreflang="${escapeHtml(locale.code)}"`;
    return `<a class="flag-link" data-locale-link href="${escapeHtml(href)}"${hreflang} lang="${escapeHtml(locale.code)}" title="${escapeHtml(locale.nativeName)}" aria-label="${escapeHtml(label)}"${current}><span aria-hidden="true">${escapeHtml(locale.icon)}</span></a>`;
  }).join('');
  return `<nav class="locale-switcher" aria-label="Language"><div class="locale-track">${links}</div></nav>`;
}

function stateLabel(state, messages) {
  const labels = {
    Planned: messages.planned,
    'In development': messages.development,
    Delivered: messages.delivered,
    Production: messages.production
  };
  return labels[state] || state;
}

function formatDate(value, locale) {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value.slice(0, 10);
  }
}

function pageShell({ locale, locales, messages, title, description, canonicalPath, slug, main, jsonLd, contentLanguage = null, root = false }) {
  const lang = locale.code;
  const canonical = absolute(canonicalPath);
  const brandHref = root ? '/' : routeFor(lang);
  const contentLang = contentLanguage ? ` lang="${escapeHtml(contentLanguage)}"` : '';
  return `<!doctype html>
<html lang="${escapeHtml(lang)}" dir="${locale.dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
  <meta name="description"${contentLang} content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Ariada Wiki">
  <meta property="og:title"${contentLang} content="${escapeHtml(title)}">
  <meta property="og:description"${contentLang} content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <title${contentLang}>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(canonical)}">
  ${alternateLinks(locales, slug, root)}
  <link rel="stylesheet" href="${ASSET_PATHS.css}">
  <script type="application/ld+json">${safeJson(jsonLd)}</script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="header-row">
      <a class="brand" href="${escapeHtml(brandHref)}"><span class="brand-mark">A</span>riada Wiki</a>
      <a class="main-site" href="https://ariada.org/modules/">Ariada.org</a>
    </div>
    ${localeSwitcher(locales, root ? null : lang, slug)}
  </header>
  <main id="main" class="shell">${main}</main>
  <footer class="site-footer">
    <div class="footer-inner">
      <p>© 2026 Alexander Brichkin · Agonist Development AB</p>
      <p><a href="https://github.com/ariada-org/ariada">ariada-org/ariada</a> · <a href="https://ariada.org/accessibility/">Accessibility</a> · EUPL-1.2</p>
    </div>
  </footer>
</body>
</html>
`;
}

function statsHtml(matrix, messages) {
  const values = [
    [matrix.counts.planned, messages.planned],
    [matrix.counts.inDevelopment, messages.development],
    [matrix.counts.delivered, messages.delivered],
    [matrix.counts.production, messages.production]
  ];
  return `<div class="stats">${values.map(([count, label]) =>
    `<div class="stat"><strong>${escapeHtml(count)}</strong><span>${escapeHtml(label)}</span></div>`
  ).join('')}</div>`;
}

function sourceFallback(locale, messages) {
  return locale.code === 'en' ? '' : `<p class="fallback-note" data-source-fallback lang="${escapeHtml(locale.code)}">${escapeHtml(messages.sourceFallback)}</p>`;
}

function collectionJsonLd(matrix, locale, modules) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${absolute(routeFor(locale.code))}#page`,
    url: absolute(routeFor(locale.code)),
    name: `Ariada · ${locale.messages.modules}`,
    description: locale.messages.intro,
    inLanguage: locale.code,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Ariada Wiki',
      availableLanguage: LOCALE_CODES
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: modules.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: modules.map((module, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absolute(routeFor(locale.code, module.id.toLowerCase())),
        name: module.name
      }))
    },
    dateModified: matrix.generatedAt
  };
}

function renderIndex(matrix, locale, locales, modules) {
  const messages = locale.messages;
  const cards = modules.map((module) => {
    const slug = module.id.toLowerCase();
    const search = `${module.id} ${module.name} ${module.description}`;
    return `<article class="module-card" data-module-card data-search="${escapeHtml(search)}">
  <div class="card-top">
    <h2><a href="${escapeHtml(routeFor(locale.code, slug))}" lang="en">${escapeHtml(module.name)}</a></h2>
    <span class="module-id">${escapeHtml(module.id)}</span>
  </div>
  <span class="badge">${escapeHtml(stateLabel(module.state, messages))}</span>
  <p lang="en">${escapeHtml(module.description)}</p>
</article>`;
  }).join('\n');

  const main = `<section class="hero">
  <p class="eyebrow">Ariada · ${escapeHtml(messages.modules)}</p>
  <h1>${escapeHtml(messages.modules)}</h1>
  <p class="lead">${escapeHtml(messages.intro)}</p>
  ${sourceFallback(locale, messages)}
  ${statsHtml(matrix, messages)}
</section>
<section aria-labelledby="catalog-heading">
  <h2 id="catalog-heading" class="visually-hidden">${escapeHtml(messages.modules)}</h2>
  <div class="catalog-tools">
    <label class="visually-hidden" for="module-search">${escapeHtml(messages.search)}</label>
    <input class="search" id="module-search" data-module-search type="search" placeholder="${escapeHtml(messages.search)}" autocomplete="off">
  </div>
  <div class="module-grid">${cards}</div>
</section>
<script src="${ASSET_PATHS.catalog}" defer></script>`;

  const localeWithMessages = { ...locale, messages };
  return pageShell({
    locale,
    locales,
    messages,
    title: `${messages.modules} · Ariada Wiki`,
    description: messages.intro,
    canonicalPath: routeFor(locale.code),
    slug: null,
    main,
    jsonLd: collectionJsonLd(matrix, localeWithMessages, modules)
  });
}

function installationHtml(module) {
  return `<p lang="en">${escapeHtml(module.installation)}</p>`;
}

function detailJsonLd(matrix, locale, module) {
  const canonicalPath = routeFor('en', module.id.toLowerCase());
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${absolute(canonicalPath)}#article`,
    url: absolute(canonicalPath),
    headline: `${module.id} · ${module.name}`,
    description: module.description,
    inLanguage: 'en',
    dateModified: module.updatedAt ?? matrix.generatedAt,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Ariada Wiki',
      availableLanguage: LOCALE_CODES
    },
    about: {
      '@type': 'SoftwareApplication',
      name: module.name,
      applicationCategory: 'DeveloperApplication',
      url: module.ariadaModuleUrl
    },
    publisher: {
      '@type': 'Organization',
      name: 'Agonist Development AB',
      url: 'https://ariada.org/'
    },
    sourceOrganization: {
      '@type': 'Organization',
      name: 'Ariada',
      url: 'https://ariada.org/'
    },
    identifier: module.id,
    mainEntityOfPage: absolute(canonicalPath),
    isBasedOn: module.ariadaModuleUrl,
    sameAs: [
      module.publicCodeUrl,
      module.developmentEvidenceUrl,
      ...module.deliveryEvidenceUrls,
      module.evidenceUrl,
      module.wikiUrl
    ].filter(Boolean)
  };
}

function renderDetail(matrix, locale, locales, module) {
  const messages = locale.messages;
  const slug = module.id.toLowerCase();
  const uiLanguage = escapeHtml(locale.code);
  const codeUrls = module.publicCodeUrl ? [module.publicCodeUrl] : [];
  const links = [
    `<li><a href="${escapeHtml(publicUrl(module.ariadaModuleUrl))}" lang="${uiLanguage}">${escapeHtml(messages.moduleLanding)}</a></li>`,
    ...codeUrls.map((url) => `<li><a href="${escapeHtml(publicUrl(url))}" lang="${uiLanguage}">${escapeHtml(messages.publicCode)}</a></li>`),
    ...(module.developmentEvidenceUrl ? [`<li><a href="${escapeHtml(publicUrl(module.developmentEvidenceUrl))}" lang="en">Development evidence</a></li>`] : []),
    ...module.deliveryEvidenceUrls.map((url) => `<li><a href="${escapeHtml(publicUrl(url))}" lang="en">Delivery evidence</a></li>`),
    ...(module.evidenceUrl ? [`<li><a href="${escapeHtml(publicUrl(module.evidenceUrl))}">Evidence</a></li>`] : []),
    ...(module.publicationUrl ? [`<li><a href="${escapeHtml(publicUrl(module.publicationUrl))}" lang="${uiLanguage}">${escapeHtml(messages.distribution)}</a></li>`] : [])
  ];
  if (codeUrls.length === 0) links.push(`<li lang="${uiLanguage}">${escapeHtml(messages.publicCode)}: ${escapeHtml(messages.notAvailable)}</li>`);
  const updated = module.updatedAt
    ? `<time datetime="${escapeHtml(module.updatedAt)}">${escapeHtml(formatDate(module.updatedAt, locale.code))}</time>`
    : escapeHtml(messages.notAvailable);

  const main = `<a class="back" href="${escapeHtml(routeFor(locale.code))}" lang="${uiLanguage}">← ${escapeHtml(messages.back)}</a>
<article class="module-article" lang="en">
<section class="hero">
  <p class="eyebrow">${escapeHtml(module.id)} · <span lang="${uiLanguage}">${escapeHtml(stateLabel(module.state, messages))}</span></p>
  <h1>${escapeHtml(module.name)}</h1>
  <p class="lead">${escapeHtml(module.description)}</p>
  ${sourceFallback(locale, messages)}
</section>
<div class="detail-layout">
  <div class="detail-content">
    <section class="detail-section">
      <h2 lang="${uiLanguage}">${escapeHtml(messages.what)}</h2>
      <p>${escapeHtml(module.description)}</p>
    </section>
    <section class="detail-section">
      <h2 lang="${uiLanguage}">${escapeHtml(messages.roles)}</h2>
      <ul>${module.roles.map((role) => `<li>${escapeHtml(role)}</li>`).join('')}</ul>
    </section>
    <section class="detail-section">
      <h2 lang="${uiLanguage}">${escapeHtml(messages.useCases)}</h2>
      <ul>${module.useCases.map((useCase) => `<li>${escapeHtml(useCase)}</li>`).join('')}</ul>
    </section>
    <section class="detail-section">
      <h2 lang="${uiLanguage}">${escapeHtml(messages.installation)}</h2>
      ${installationHtml(module)}
    </section>
    <section class="detail-section">
      <h2 lang="${uiLanguage}">${escapeHtml(messages.links)}</h2>
      <ul class="link-list">${links.join('')}</ul>
    </section>
  </div>
  <aside class="evidence-panel" aria-label="${escapeHtml(messages.status)}" lang="${uiLanguage}">
    <dl class="evidence-list">
      <div><dt>${escapeHtml(messages.lifecycle)}</dt><dd>${escapeHtml(stateLabel(module.state, messages))}</dd></div>
      <div><dt>${escapeHtml(messages.deployment)}</dt><dd><code lang="en">${escapeHtml(module.deploymentStatus)}</code></dd></div>
      <div><dt>${escapeHtml(messages.distribution)}</dt><dd><code lang="en">${escapeHtml(module.distributionStatus)}</code></dd></div>
      <div><dt>${escapeHtml(messages.updated)}</dt><dd>${updated}</dd></div>
    </dl>
  </aside>
</div>
</article>`;

  return pageShell({
    locale,
    locales,
    messages,
    title: `${module.id} · ${module.name} · Ariada Wiki`,
    description: module.description,
    canonicalPath: routeFor('en', slug),
    slug,
    main,
    jsonLd: detailJsonLd(matrix, locale, module),
    contentLanguage: 'en'
  });
}

function renderRoot(matrix, locale, locales) {
  const messages = locale.messages;
  const main = `<section class="hero">
  <p class="eyebrow">Ariada Wiki</p>
  <h1>Ariada Wiki</h1>
  <p class="lead">${escapeHtml(messages.intro)}</p>
  ${statsHtml(matrix, messages)}
</section>`;
  return pageShell({
    locale,
    locales,
    messages,
    title: 'Ariada Wiki',
    description: messages.intro,
    canonicalPath: '/',
    slug: null,
    root: true,
    main,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Ariada Wiki',
      description: messages.intro,
      inLanguage: 'en',
      availableLanguage: LOCALE_CODES,
      dateModified: matrix.generatedAt
    }
  });
}

function sitemapAlternates(locales, slug = null, root = false) {
  if (slug) return '';
  const links = locales.map((locale) => {
    const href = absolute(root ? routeFor(locale.code) : routeFor(locale.code, slug));
    return `<xhtml:link rel="alternate" hreflang="${escapeXml(locale.code)}" href="${escapeXml(href)}"/>`;
  });
  const defaultHref = root || !slug ? `${SITE_URL}/` : absolute(routeFor('en', slug));
  links.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(defaultHref)}"/>`);
  return links.join('');
}

function sitemapUrl(loc, alternates, lastmod) {
  return `<url><loc>${escapeXml(loc)}</loc>${alternates}<lastmod>${escapeXml(lastmod)}</lastmod></url>`;
}

function writeOutput(out, relative, content) {
  const target = path.resolve(out, relative);
  assert(target.startsWith(out + path.sep), 'Output path escapes the Wiki dist directory: ' + relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

function generate(matrix, locales, messages, modules, out) {
  assert(out === OUTPUT_ROOT, 'Wiki output must remain app-local.');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeOutput(out, ASSET_PATHS.css.slice(1), CSS_BYTES);
  writeOutput(out, ASSET_PATHS.catalog.slice(1), CATALOG_JS_BYTES);
  writeOutput(out, 'assets/wiki-locales.json', `${JSON.stringify(locales, null, 2)}\n`);

  const localized = locales.map((locale) => ({ ...locale, messages: messages[locale.code] }));
  const english = localized.find((locale) => locale.code === 'en');
  writeOutput(out, 'index.html', renderRoot(matrix, english, localized));

  for (const locale of localized) {
    writeOutput(out, path.join(locale.code, 'modules', 'index.html'), renderIndex(matrix, locale, localized, modules));
    for (const module of modules) {
      writeOutput(
        out,
        path.join(locale.code, 'modules', module.id.toLowerCase(), 'index.html'),
        renderDetail(matrix, locale, localized, module)
      );
    }
  }

  writeOutput(out, '404.html', pageShell({
    locale: english,
    locales: localized,
    messages: english.messages,
    title: 'Page not found · Ariada Wiki',
    description: english.messages.intro,
    canonicalPath: '/',
    slug: null,
    root: true,
    main: `<section class="hero"><p class="eyebrow">404</p><h1>Page not found</h1><p class="lead">${escapeHtml(english.messages.intro)}</p></section>`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: `${SITE_URL}/`,
      name: 'Page not found · Ariada Wiki',
      inLanguage: 'en'
    }
  }));

  const lastmod = String(matrix.generatedAt).slice(0, 10);
  const rootSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${sitemapUrl(`${SITE_URL}/`, sitemapAlternates(localized, null, true), lastmod)}</urlset>\n`;
  writeOutput(out, 'sitemap-root.xml', rootSitemap);

  for (const locale of localized) {
    const urls = [
      sitemapUrl(absolute(routeFor(locale.code)), sitemapAlternates(localized), lastmod),
      ...(locale.code === 'en' ? modules : []).map((module) => {
        const slug = module.id.toLowerCase();
        const moduleLastmod = String(module.updatedAt ?? matrix.generatedAt).slice(0, 10);
        return sitemapUrl(absolute(routeFor(locale.code, slug)), sitemapAlternates(localized, slug), moduleLastmod);
      })
    ];
    writeOutput(
      out,
      `sitemap-${locale.code}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>\n`
    );
  }

  const sitemapIndex = [
    `${SITE_URL}/sitemap-root.xml`,
    ...localized.map((locale) => `${SITE_URL}/sitemap-${locale.code}.xml`)
  ].map((url) => `<sitemap><loc>${escapeXml(url)}</loc><lastmod>${escapeXml(lastmod)}</lastmod></sitemap>`).join('');
  writeOutput(out, 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapIndex}</sitemapindex>\n`);
  writeOutput(out, 'robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  writeOutput(
    out,
    'llms.txt',
    `# Ariada Wiki\n\nProject-isolated public module documentation for Ariada.\n\n- ${SITE_URL}/\n${localized.map((locale) => `- ${absolute(routeFor(locale.code))}`).join('\n')}\n`
  );
  writeOutput(
    out,
    '_headers',
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n  Strict-Transport-Security: max-age=31536000; includeSubDomains\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'\n\n${ASSET_PATHS.css}\n  Cache-Control: public, max-age=31536000, immutable\n\n${ASSET_PATHS.catalog}\n  Cache-Control: public, max-age=31536000, immutable\n`
  );
}

function expectedPages(locales, modules) {
  const pages = [{ relative: 'index.html', canonical: `${SITE_URL}/`, locale: 'en', root: true, slug: null }];
  for (const locale of locales) {
    pages.push({
      relative: path.join(locale.code, 'modules', 'index.html'),
      canonical: absolute(routeFor(locale.code)),
      locale: locale.code,
      root: false,
      slug: null
    });
    for (const module of modules) {
      const slug = module.id.toLowerCase();
      pages.push({
        relative: path.join(locale.code, 'modules', slug, 'index.html'),
        canonical: absolute(routeFor('en', slug)),
        locale: locale.code,
        root: false,
        slug
      });
    }
  }
  return pages;
}

function listFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const absolutePath = path.join(root, entry);
    if (statSync(absolutePath).isDirectory()) {
      files.push(...listFiles(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }
  return files;
}

function validateOutput(out, locales, modules) {
  assert(existsSync(out), `Wiki output is missing: ${out}`);
  const pages = expectedPages(locales, modules);
  for (const page of pages) {
    const file = path.join(out, page.relative);
    assert(existsSync(file), `Missing generated page: ${page.relative}`);
    const html = readFileSync(file, 'utf8');
    assert(html.includes(`<html lang="${page.locale}" dir="${locales.find((locale) => locale.code === page.locale)?.dir || 'ltr'}">`), `${page.relative} has invalid lang/dir.`);
    assert(html.includes(`<link rel="canonical" href="${page.canonical}">`), `${page.relative} has invalid canonical.`);
    if (page.slug) {
      assert(!html.includes('hreflang='), `${page.relative} falsely declares a translated article alternate.`);
      assert(html.includes('<article class="module-article" lang="en">'), `${page.relative} does not mark its English article.`);
      assert(html.includes('<meta name="description" lang="en"'), `${page.relative} does not mark its English metadata.`);
    } else {
      for (const locale of locales) {
        assert(html.includes(`hreflang="${locale.code}"`), `${page.relative} is missing hreflang ${locale.code}.`);
      }
      assert(html.includes('hreflang="x-default"'), `${page.relative} is missing x-default.`);
    }
    assert((html.match(/data-locale-link/g) || []).length === locales.length, `${page.relative} has an invalid flag switcher.`);
    assert((html.match(/class="locale-switcher"/g) || []).length === 1, `${page.relative} must have exactly one locale switcher.`);
    const navEnd = html.indexOf('</nav>');
    assert(navEnd > 0 && !html.slice(navEnd + 6).includes('data-locale-link'), `${page.relative} has locale links outside the top switcher.`);
    if (page.slug) {
      assert(html.includes(`/${page.locale}/modules/${page.slug}/`), `${page.relative} does not preserve its module route.`);
      assert(!new RegExp(`href="#${page.slug}"`, 'i').test(html), `${page.relative} uses a legacy module anchor.`);
    }
  }

  assert(pages.length === 1 + locales.length * (1 + modules.length), 'Unexpected public content page count.');
  assert(existsSync(path.join(out, '404.html')), 'Missing 404 page.');
  assert(existsSync(path.join(out, 'robots.txt')), 'Missing robots.txt.');
  assert(existsSync(path.join(out, 'sitemap.xml')), 'Missing sitemap index.');
  assert(existsSync(path.join(out, 'sitemap-root.xml')), 'Missing root sitemap.');
  for (const locale of locales) assert(existsSync(path.join(out, `sitemap-${locale.code}.xml`)), `Missing sitemap for ${locale.code}.`);

  const allFiles = listFiles(out);
  const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));
  assert(htmlFiles.length === pages.length + 1, `Expected ${pages.length + 1} HTML files, found ${htmlFiles.length}.`);


  return {
    locales: locales.length,
    modules: modules.length,
    modulePages: locales.length * modules.length,
    localeIndexes: locales.length,
    contentPages: pages.length,
    htmlFiles: htmlFiles.length,
    files: allFiles.length
  };
}

const options = parseArgs(process.argv.slice(2));
const matrix = readJson(CATALOG_SOURCE);
validateContracts(matrix, locales, messages);
const modules = [...matrix.channels].sort((left, right) =>
  left.name.localeCompare(right.name, 'en', { numeric: true, sensitivity: 'base' }) ||
  left.number - right.number
);

if (!options.check) {
  generate(matrix, locales, messages, modules, OUTPUT_ROOT);
}

const report = validateOutput(OUTPUT_ROOT, locales, modules);
console.log(JSON.stringify({ status: 'pass', host: SITE_URL, ...report }, null, 2));
