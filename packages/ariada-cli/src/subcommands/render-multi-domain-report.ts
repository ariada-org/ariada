// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { MultiDomainReport } from '@ariada-org/core-engine';

/**
 * Render a multi-domain report as plain text for the terminal: a site-by-domain
 * grid of finding counts, the cross-domain interactions, and the cross-site axis
 * (problems that repeat across sites, and problems where sites diverge).
 *
 * Pure and deterministic — given a report it returns the same string, with no I/O
 * — so it is straightforward to snapshot-test and to drive from any capture path.
 */
export function renderMultiDomainReport(report: MultiDomainReport): string {
  const lines: string[] = [];
  lines.push('ariada multi-domain scan');
  lines.push('');
  lines.push(renderGrid(report));

  const interactions = renderInteractions(report);
  if (interactions) {
    lines.push('');
    lines.push(interactions);
  }

  const crossSite = renderCrossSite(report);
  if (crossSite) {
    lines.push('');
    lines.push(crossSite);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

/**
 * What one cell says: what was found, and what nobody could decide.
 *
 * @param findings - the findings for one site and one domain
 * @returns the cell text
 */
function cellLabel(findings: readonly { needsReview?: boolean }[]): string {
  const decided = findings.filter((f) => f.needsReview !== true).length;
  const undecided = findings.length - decided;
  if (decided === 0 && undecided === 0) return 'pass';
  if (decided === 0) return `${undecided} to review`;
  if (undecided === 0) return `${decided} found`;
  return `${decided} found, ${undecided} to review`;
}

/**
 * The grid: one row per site, one column per domain, each cell the count of
 * findings for that site-and-domain pair. A zero-finding cell reads as a pass.
 *
 * Decided findings and undecided ones are counted apart. An analyser marks a
 * finding `needsReview` when it could not determine the answer — contrast
 * against a background it cannot resolve, say — and printing "11 found" over
 * eleven of those tells a reader their page has eleven problems when what it
 * has is eleven places nobody could measure.
 *
 * That happened on this project's own site, and the two status chips that came
 * back at 4.88:1 are the reason the distinction is kept rather than the
 * undecided ones simply dropped: they are close enough to the threshold that a
 * person should look.
 */
function renderGrid(report: MultiDomainReport): string {
  const domainHeaders = report.domains;
  const siteColWidth = Math.max(4, ...report.sites.map((s) => s.length));
  // The widest cell, not the widest header: a cell reading "3 found, 11 to
  // review" is longer than any domain name and would push the row past its
  // column, which is the table looking broken in the one place it is saying
  // something unusual.
  const labels = report.sites.flatMap((site) =>
    domainHeaders.map((domain) => cellLabel(report.grid[site]?.[domain] ?? [])),
  );
  const cellWidth = Math.max(8, ...domainHeaders.map((d) => d.length), ...labels.map((l) => l.length));

  const header = [
    pad('site', siteColWidth),
    ...domainHeaders.map((d) => pad(d, cellWidth)),
  ].join('  ');
  const divider = '-'.repeat(header.length);

  const rows = report.sites.map((site) => {
    const cells = domainHeaders.map((domain) => {
      return pad(cellLabel(report.grid[site]?.[domain] ?? []), cellWidth);
    });
    return [pad(site, siteColWidth), ...cells].join('  ');
  });

  return [header, divider, ...rows].join('\n');
}

/**
 * The cross-domain interactions: each predicted conflict or synergy between two
 * domains on a shared element, with the effect of remediating one on the other.
 */
function renderInteractions(report: MultiDomainReport): string | undefined {
  if (report.interactions.length === 0) return undefined;
  const lines = ['Cross-domain interactions:'];
  for (const interaction of report.interactions) {
    const pair = interaction.domains.join(' <-> ');
    lines.push(`  [${interaction.type}] ${pair} on ${interaction.elementKey}`);
    lines.push(`      ${interaction.predictedEffect}`);
  }
  return lines.join('\n');
}

/**
 * The cross-site axis: problems systemic across the brand (failing on several
 * sites) and divergences (failing on some sites while passing on others).
 */
function renderCrossSite(report: MultiDomainReport): string | undefined {
  const { systemic, divergence } = report.crossSite;
  if (systemic.length === 0 && divergence.length === 0) return undefined;

  const lines = ['Cross-site:'];
  for (const issue of systemic) {
    lines.push(
      `  systemic — ${issue.domain}/${issue.ruleId} on all ${issue.affectedSites.length} sites`,
    );
  }
  for (const d of divergence) {
    lines.push(
      `  divergence — ${d.domain}/${d.ruleId}: fails on ${d.failingSites.join(', ')}; ` +
        `passes on ${d.passingSites.join(', ')}`,
    );
  }
  return lines.join('\n');
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}
