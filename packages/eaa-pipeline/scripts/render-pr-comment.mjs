#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * render-pr-comment.mjs
 *
 * Renders the PR-comment markdown body per PRD §3.5 from `report.json`.
 *
 * Layout (per PRD §3.5 Wave-1 enhancements):
 *
 *   ## ✅ PASS / ❌ FAIL — EAA audit
 *
 *   Scanned **N** page(s) of `<site-url>` using `<pack>@<version>`.
 *
 *   | Impact            | Count |
 *   |-------------------|------:|
 *   | 🔴 critical       | N     |
 *   | 🟠 serious        | N     |
 *   | 🟡 moderate       | N     |
 *   | ⚪ minor          | N     |
 *
 *   Total violations: **N** · fail-on: `serious,critical`
 *
 *   <details><summary>Top-5 violations</summary>
 *   ... per-violation rows ...
 *   </details>
 *
 *   Artefact: `eaa-audit-<run_id>` (report.json + ...).
 *   Run: [#<run_id>](<run-url>)
 *
 *   _Posted by [@ariada/eaa-pipeline](...). Powered by axe-core ..._
 *
 * Accessibility: every emoji is paired with a text label per project
 * a11y rule §4.3.  No colour-only severity.
 *
 * Length safety: GitHub caps PR-comment bodies at 65 536 characters.
 * We render with the top-5 expanded; if the total length exceeds the
 * cap, the «Top-5 violations» block is replaced with a one-line
 * pointer to the artefact.  In practice the cap never fires for a
 * top-5-only render — it exists for forward compatibility with
 * Wave-2 per-page detail blocks.
 *
 * Pure stdlib (Node ≥ 18).
 *
 * Usage (CLI):
 *   node render-pr-comment.mjs <report.json> [--run-id N] [--run-url URL]
 *
 * Library:
 *   import { renderPrComment } from './render-pr-comment.mjs';
 *   const body = renderPrComment(report, { runId, runUrl });
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const GITHUB_COMMENT_CAP = 65_536;

const IMPACT_LABEL = {
  critical: '🔴 critical',
  serious: '🟠 serious',
  moderate: '🟡 moderate',
  minor: '⚪ minor',
};

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

/**
 * @param {string} verdict
 * @returns {string} headline with emoji + text label
 */
export function renderVerdict(verdict) {
  switch (verdict?.toUpperCase()) {
    case 'PASS':
      return '✅ PASS';
    case 'FAIL':
      return '❌ FAIL';
    default:
      return `❓ ${(verdict || 'unknown').toUpperCase()}`;
  }
}

/**
 * Collect top-N violations ordered by impact priority then by node count.
 * @param {object} report
 * @param {number} limit
 * @returns {Array<{id: string, impact: string, url: string, nodeCount: number, description: string, helpUrl: string}>}
 */
export function collectTopViolations(report, limit = 5) {
  const out = [];
  const perPage = Array.isArray(report?.perPage) ? report.perPage : [];
  for (const page of perPage) {
    const url = typeof page.url === 'string' ? page.url : '';
    const violations = Array.isArray(page.violations) ? page.violations : [];
    for (const v of violations) {
      out.push({
        id: typeof v.id === 'string' ? v.id : 'unknown',
        impact: typeof v.impact === 'string' ? v.impact : 'minor',
        url,
        nodeCount:
          typeof v.nodeCount === 'number' && Number.isFinite(v.nodeCount)
            ? v.nodeCount
            : 0,
        description: typeof v.description === 'string' ? v.description : '',
        helpUrl: typeof v.helpUrl === 'string' ? v.helpUrl : '',
      });
    }
  }
  out.sort((a, b) => {
    const pa = IMPACT_ORDER.indexOf(a.impact);
    const pb = IMPACT_ORDER.indexOf(b.impact);
    if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return b.nodeCount - a.nodeCount;
  });
  return out.slice(0, limit);
}

/**
 * @param {object} report parsed report.json
 * @param {{runId?: string|number, runUrl?: string}} ctx
 * @returns {string} markdown body
 */
export function renderPrComment(report, ctx = {}) {
  const totals = report?.totalsByImpact || {};
  const verdict = renderVerdict(report?.verdict);
  const pages = report?.pagesScanned ?? 0;
  const siteUrl = report?.siteUrl ?? '(unknown)';
  const pack = report?.scannerPack ?? '@ariada/wcag-rules-extended';
  const packVersion = report?.scannerPackVersion ?? 'unknown';
  const totalViolations = report?.totalViolations ?? 0;
  const failOn = Array.isArray(report?.failOn)
    ? report.failOn.join(',')
    : 'serious,critical';
  const runId = ctx.runId ?? '';
  const runUrl = ctx.runUrl ?? '';

  /** @type {string[]} */
  const lines = [];
  lines.push(`## ${verdict} — EAA audit`);
  lines.push('');
  lines.push(
    `Scanned **${pages}** page(s) of \`${siteUrl}\` using \`${pack}@${packVersion}\`.`,
  );
  lines.push('');
  lines.push('| Impact         | Count |');
  lines.push('|----------------|------:|');
  for (const impact of IMPACT_ORDER) {
    lines.push(`| ${IMPACT_LABEL[impact]} | ${totals[impact] ?? 0} |`);
  }
  lines.push('');
  lines.push(
    `Total violations: **${totalViolations}** · fail-on: \`${failOn}\``,
  );
  lines.push('');

  // Top-5 violations block.
  const top = collectTopViolations(report, 5);
  let topBlock = '';
  if (top.length > 0) {
    const tb = [];
    tb.push('<details><summary>Top-5 violations</summary>');
    tb.push('');
    tb.push('| Impact         | Rule | Page | Nodes |');
    tb.push('|----------------|------|------|------:|');
    for (const v of top) {
      const rule = v.helpUrl ? `[${v.id}](${v.helpUrl})` : v.id;
      tb.push(`| ${IMPACT_LABEL[v.impact] ?? v.impact} | ${rule} | \`${v.url}\` | ${v.nodeCount} |`);
    }
    tb.push('');
    tb.push('</details>');
    tb.push('');
    topBlock = tb.join('\n');
  }
  lines.push(topBlock);

  // Artefact + run reference.
  lines.push(
    `Artefact: \`eaa-audit-${runId}\` (report.json + report.sarif + statement + evidence).`,
  );
  if (runUrl) {
    lines.push(`Run: [#${runId}](${runUrl})`);
  }
  lines.push('');
  lines.push(
    '_Posted by [@ariada/eaa-pipeline](https://github.com/ariada-org/ariada/tree/main/packages/eaa-pipeline). Powered by axe-core (MPL-2.0) + @ariada/wcag-rules-extended (EUPL-1.2)._',
  );

  let body = lines.join('\n');
  if (body.length > GITHUB_COMMENT_CAP) {
    // Drop the top-5 block and re-render with a pointer to the artefact.
    const collapsedLines = lines.map((ln) => (ln === topBlock ? '' : ln));
    // Insert pointer instead of the block.
    const idx = collapsedLines.findIndex((ln) => ln.startsWith('Artefact:'));
    if (idx !== -1) {
      collapsedLines.splice(
        idx,
        0,
        '_Comment body would exceed GitHub\'s 65 536-character cap — see the artefact for the full violation list._',
        '',
      );
    }
    body = collapsedLines.join('\n');
  }
  return body;
}

// CLI entry point.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  const reportArg = args[0];
  if (!reportArg) {
    console.error('usage: node render-pr-comment.mjs <report.json> [--run-id N] [--run-url URL]');
    process.exit(2);
  }
  let runId = '';
  let runUrl = '';
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === '--run-id') {
      runId = args[i + 1] ?? '';
      i += 1;
    } else if (args[i] === '--run-url') {
      runUrl = args[i + 1] ?? '';
      i += 1;
    }
  }
  const reportPath = resolve(process.cwd(), reportArg);
  if (!existsSync(reportPath)) {
    console.error(`::error::report.json not found: ${reportPath}`);
    process.exit(2);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const body = renderPrComment(report, { runId, runUrl });
  process.stdout.write(body);
}
