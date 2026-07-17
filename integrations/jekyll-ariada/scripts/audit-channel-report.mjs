#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function usage() {
  console.error('Usage: node scripts/audit-channel-report.mjs --baseline <dash-result.html> --report <result.html> [--strict]');
  process.exit(2);
}

const args = process.argv.slice(2);
let baselinePath = '';
let reportPath = '';
let strict = false;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--baseline') {
    baselinePath = args[++i] ?? '';
  } else if (args[i] === '--report') {
    reportPath = args[++i] ?? '';
  } else if (args[i] === '--strict') {
    strict = true;
  } else {
    usage();
  }
}
if (!baselinePath || !reportPath) usage();

function readHtml(path) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) throw new Error(`Missing report: ${absolute}`);
  return readFileSync(absolute, 'utf8');
}

function stripEmbeddedImages(html) {
  return html.replace(/data:image\/[^"')\s]+/g, 'data:image/omitted');
}

function visibleText(html) {
  return stripEmbeddedImages(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const groups = [
  ['channel_context', [/what .*channel/i, /что такое/i, /why .*separate/i, /почему .*канал/i]],
  ['channel_culture_fit', [/channel culture fit/i, /ecosystem fit/i, /fast local/i, /dev loop/i]],
  ['channel_packaging_solution', [/recommended product solution/i, /product solution/i, /primary .*entrypoint/i, /native .*path/i]],
  ['role_payer_hooks', [/roles?.*payers?.*hooks?/i, /кому что продаем/i, /кто платит/i, /buying moment/i]],
  ['implemented_not_implemented', [/implemented.*not implemented/i, /not implemented/i, /blocked/i]],
  ['ariada_core_used', [/ariada core/i, /shared .*cli/i, /@ariada-org\/cli/i]],
  ['tested_surface', [/tested surface/i, /representative surface/i]],
  ['domain_roadmap', [/domain roadmap/i, /домен/i]],
  ['narrow_competitors', [/narrow competitors/i, /competitors .*channel/i, /конкуренты/i]],
  ['monetization_sales', [/monetization/i, /sales model/i, /монетиза/i]],
  ['sources_documents', [/sources/i, /источники/i, /documents/i]],
  ['community_review_sources', [/community review sources/i, /signal count/i, /no-signal searches/i, /reddit/i, /stack overflow/i, /github issues/i, /community forum/i]],
  ['pain_mining', [/pain mining/i, /search quer/i, /signals to collect/i]],
  ['evidence_artifacts', [/evidence artifacts/i, /raw .*json/i, /command log/i, /screenshot/i]],
  ['test_adequacy', [/test adequacy/i, /verification and test adequacy/i]],
  ['handoff_next_steps', [/agent next/i, /human next/i]],
  ['distribution_publishing', [/distribution/i, /publishing/i, /дистрибуция/i]],
  ['self_critique_limits', [/does not prove/i, /limitation/i, /blocker/i]],
  ['visual_review', [/visual evidence/i, /screenshot shows/i, /visual review/i, /visual_evidence_gap/i]],
];

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function isRelativeFileReference(href) {
  return !href.startsWith('#') && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('//');
}

function metrics(html, sourcePath) {
  const stripped = stripEmbeddedImages(html);
  const text = visibleText(html);
  const linkMatches = [...stripped.matchAll(/<a\s+[^>]*href=["']([^"']+)["']/gi)].map((match) => match[1]);
  const externalLinks = linkMatches.filter((href) => /^https?:\/\//i.test(href));
  const localLinks = linkMatches.filter((href) => !/^https?:\/\//i.test(href) && !href.startsWith('#'));
  const reportDir = dirname(resolve(sourcePath));
  const relativeScreenshotLinks = linkMatches.filter(
    (href) => /\.(png|jpe?g|webp)(?:[?#].*)?$/i.test(href) && isRelativeFileReference(href),
  );
  const existingRelativeScreenshotLinks = relativeScreenshotLinks.filter((href) => {
    const cleanHref = href.split('#')[0].split('?')[0];
    return existsSync(resolve(reportDir, cleanHref));
  });
  const coverage = Object.fromEntries(groups.map(([name, patterns]) => [name, hasAny(text, patterns)]));
  const covered = Object.values(coverage).filter(Boolean).length;
  return {
    textChars: text.length,
    h2: (stripped.match(/<h2[\s>]/gi) ?? []).length,
    tables: (stripped.match(/<table[\s>]/gi) ?? []).length,
    links: linkMatches.length,
    externalLinks: externalLinks.length,
    localLinks: localLinks.length,
    embeddedScreenshot: /data:image\//i.test(html),
    standaloneScreenshotLink: existingRelativeScreenshotLinks.length > 0,
    relativeScreenshotLinks: relativeScreenshotLinks.length,
    existingRelativeScreenshotLinks: existingRelativeScreenshotLinks.length,
    groups: coverage,
    covered,
  };
}

const baselineHtml = readHtml(baselinePath);
const reportHtml = readHtml(reportPath);
const baseline = metrics(baselineHtml, baselinePath);
const report = metrics(reportHtml, reportPath);
const minTextCharMargin = Math.max(1500, Math.ceil(baseline.textChars * 0.025));
const missingGroups = Object.entries(report.groups).filter(([, ok]) => !ok).map(([name]) => name);
const failures = [];

if (missingGroups.length > 0) failures.push(`missing groups: ${missingGroups.join(', ')}`);
if (!visibleText(reportHtml).includes('Кому что продаем: роли, hooks, кто платит и что уже готово')) {
  failures.push('missing mandatory role/payer table title');
}
if (!report.embeddedScreenshot) failures.push('missing embedded screenshot');
if (!report.standaloneScreenshotLink) failures.push('missing standalone screenshot link');
if (/<pre[^>]*>\s*<code/i.test(stripEmbeddedImages(reportHtml)) && /code\s*\{[^}]*background\s*:/i.test(stripEmbeddedImages(reportHtml))) {
  failures.push('possible unreadable pre/code styling: inline code background inside dark pre');
}
if (report.covered < baseline.covered) failures.push(`covered groups ${report.covered} < baseline ${baseline.covered}`);
if (report.h2 < baseline.h2) failures.push(`h2 ${report.h2} < baseline ${baseline.h2}`);
if (report.tables < baseline.tables) failures.push(`tables ${report.tables} < baseline ${baseline.tables}`);
if (report.links < baseline.links) failures.push(`links ${report.links} < baseline ${baseline.links}`);
if (report.externalLinks < baseline.externalLinks) failures.push(`external source links ${report.externalLinks} < baseline ${baseline.externalLinks}`);
if (report.textChars < baseline.textChars) failures.push(`text chars ${report.textChars} < baseline ${baseline.textChars}`);
if (report.textChars - baseline.textChars < minTextCharMargin) {
  failures.push(`text chars margin ${report.textChars - baseline.textChars} < required ${minTextCharMargin}`);
}

const output = {
  status: failures.length === 0 ? 'PASS' : 'REGENERATE',
  minTextCharMargin,
  baseline: { path: resolve(baselinePath), ...baseline },
  report: { path: resolve(reportPath), ...report },
  failures,
};

console.log(JSON.stringify(output, null, 2));
if (strict && failures.length > 0) process.exit(1);
