// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { MultiDomainReport } from '@ariada-org/core-engine';

import { escapeHtml } from './escape.js';

/**
 * Render the evaluator-facing static HTML view of a multi-domain report.
 *
 * Lives here (not in the CLI) so there is ONE rendering home for every report
 * shape — the CLI, the GitHub Action, and any future surface all render from
 * this package, sharing its escaping and styles. Divergent renderers are the
 * exact "CLI-vs-dashboard drift" anti-pattern a consistency product must avoid.
 */
export function renderMultiDomainReport(report: MultiDomainReport): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ariada multi-domain demo report</title>
  <style>${MULTI_DOMAIN_STYLES}</style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">Offline fixture scan</p>
      <h1>Ariada multi-domain demo report</h1>
      <p>One run compares several sites across several compliance areas, using the shared multi-domain report shape that downstream surfaces consume.</p>
    </header>
    <section aria-labelledby="grid-heading">
      <h2 id="grid-heading">Site x domain grid</h2>
      ${renderGrid(report)}
    </section>
    <section aria-labelledby="interaction-heading">
      <h2 id="interaction-heading">Cross-domain interaction</h2>
      ${renderInteractions(report)}
    </section>
    <section aria-labelledby="divergence-heading">
      <h2 id="divergence-heading">Cross-site divergence</h2>
      ${renderDivergence(report)}
    </section>
  </main>
</body>
</html>
`;
}

function renderGrid(report: MultiDomainReport): string {
  const header = report.domains.map((domain) => `<th scope="col">${escapeHtml(domain)}</th>`).join('');
  const rows = report.sites
    .map((site) => {
      const cells = report.domains
        .map((domain) => {
          const count = report.grid[site]?.[domain]?.length ?? 0;
          const label = count === 0 ? 'pass' : `${count} finding${count === 1 ? '' : 's'}`;
          return `<td class="${count === 0 ? 'pass' : 'fail'}">${escapeHtml(label)}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${escapeHtml(site)}</th>${cells}</tr>`;
    })
    .join('');
  return `<table><thead><tr><th scope="col">site</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderInteractions(report: MultiDomainReport): string {
  if (report.interactions.length === 0) return '<p>No cross-domain interactions detected.</p>';
  return `<ul>${report.interactions
    .map((i) => {
      const pair = i.domains.join(' <-> ');
      return `<li><strong>${escapeHtml(i.type)}</strong> ${escapeHtml(pair)} on <code>${escapeHtml(i.elementKey)}</code><br />${escapeHtml(i.predictedEffect)}</li>`;
    })
    .join('')}</ul>`;
}

function renderDivergence(report: MultiDomainReport): string {
  if (report.crossSite.divergence.length === 0) return '<p>No divergence detected.</p>';
  return `<ul>${report.crossSite.divergence
    .map((d) => `<li><strong>${escapeHtml(d.domain)}</strong>/${escapeHtml(d.ruleId)} fails on ${escapeHtml(d.failingSites.join(', '))}; passes on ${escapeHtml(d.passingSites.join(', '))}.</li>`)
    .join('')}</ul>`;
}

const MULTI_DOMAIN_STYLES = `
:root{color-scheme:light;--ink:#17202a;--muted:#53606d;--line:#d7dde4;--ok:#147a42;--bad:#a73737;--bg:#f7f9fb}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:32px 20px 48px}
header,section{background:#fff;border:1px solid var(--line);border-radius:8px;padding:22px;margin:0 0 18px}
.eyebrow{margin:0 0 8px;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:0}
h1,h2,p{margin-top:0} h1{font-size:32px;line-height:1.15} h2{font-size:20px}
table{width:100%;border-collapse:collapse;font-size:14px} th,td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top}
thead th{background:#eef3f8} td.pass{color:var(--ok);font-weight:700} td.fail{color:var(--bad);font-weight:700}
ul{margin:0;padding-left:20px} li+li{margin-top:10px} code{background:#eef3f8;border-radius:4px;padding:1px 5px}
`;
