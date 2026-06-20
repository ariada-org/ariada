// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
import type { BlamedReport } from './types.js';

/** Base URL for rendered attribution report links. Set BLAMER_AUDIT_BASE_URL in the deployment environment. */
const AUDIT_BASE_URL = process.env['BLAMER_AUDIT_BASE_URL'] ?? '';

/**
 * Renders a BlamedReport as a GitHub PR comment in Markdown.
 * Accessibility: table columns are labelled; all percentages stated as numbers
 * (no colour-only encoding); impact labels included alongside criterion numbers.
 *
 * @param report - The attribution report to render.
 * @param auditBaseUrl - Optional base URL for the full-report link. When omitted,
 *   the value of the BLAMER_AUDIT_BASE_URL environment variable is used. When that
 *   is also absent, no full-report link is appended.
 */
export function renderGitHubComment(report: BlamedReport, auditBaseUrl?: string): string {
  const lines: string[] = [];

  lines.push('## Blamer attribution audit\n');

  if (report.thresholdViolated) {
    const pct = Math.round((report.triggeringFraction ?? 0) * 100);
    lines.push(`> **AI-authored fraction exceeds threshold (config: 60%, actual: ${pct}%)**\n`);
  }

  lines.push('### Attribution mix\n');
  lines.push('| Agent | Lines | % | Confidence |');
  lines.push('|-------|-------|---|------------|');

  const sorted = [...report.diffMix].sort((a, b) => b.fraction - a.fraction);
  for (const entry of sorted) {
    const pct = (entry.fraction * 100).toFixed(1);
    // Best-effort confidence from posterior — default to 'n/a' for aggregated diffMix
    lines.push(`| ${entry.agent} | ${entry.linesAttributed} | ${pct}% | n/a |`);
  }

  if (report.violations.length > 0) {
    lines.push('\n### Top violations attributed to AI\n');
    const top = report.violations.slice(0, 5);
    for (const v of top) {
      // AttributionPosterior.posterior is sorted descending by probability
      const topAgentEntry = v.attribution.posterior[0];
      const agentLabel = topAgentEntry
        ? `${topAgentEntry.agent} (${(topAgentEntry.probability * 100).toFixed(0)}%)`
        : 'unknown';
      lines.push(`- **WCAG ${v.wcagCriterion}** (${v.impact}): ${v.violationId} — attributed to ${agentLabel}`);
    }
  }

  const base = auditBaseUrl ?? AUDIT_BASE_URL;
  if (base) {
    lines.push(`\n[View full attribution report](${base}/audit/${report.repo}/${report.subjectId})`);
  }
  lines.push(`\n*Report generated at ${report.generatedAt} · Request ID: \`${report.apiRequestId}\`*`);

  return lines.join('\n');
}

/**
 * Renders a BlamedReport as a Vercel deploy comment in plain text.
 * Plain text only — no Markdown, no emoji-only status.
 * All percentages stated as numbers.
 *
 * @param report - The attribution report to render.
 * @param auditBaseUrl - Optional base URL for the full-report link. When omitted,
 *   the value of the BLAMER_AUDIT_BASE_URL environment variable is used. When that
 *   is also absent, no full-report link is appended.
 */
export function renderVercelComment(report: BlamedReport, auditBaseUrl?: string): string {
  const sorted = [...report.diffMix].sort((a, b) => b.fraction - a.fraction);
  const totalLines = sorted.reduce((sum, m) => sum + m.linesAttributed, 0);
  const agentSummary = sorted
    .map((m) => `${Math.round(m.fraction * 100)}% ${m.agent}`)
    .join(', ');

  const lines: string[] = [
    `Blamer attribution audit`,
    `Deployed diff: ${totalLines} lines — ${agentSummary}`,
  ];

  if (report.thresholdViolated) {
    const pct = Math.round((report.triggeringFraction ?? 0) * 100);
    lines.push(`Warning: AI-authored fraction ${pct}% exceeds configured threshold`);
  }

  const base = auditBaseUrl ?? AUDIT_BASE_URL;
  if (base) {
    lines.push(`Full attribution report: ${base}/audit/${report.repo}/${report.subjectId}`);
  }

  return lines.join('\n');
}

/**
 * Renders a degraded-mode message when the free-tier quota is exhausted.
 * No attribution data is included — attribution is unavailable when quota is exceeded.
 *
 * @param resetAt - ISO-8601 string for when the quota resets, or undefined.
 * @param upgradeUrl - Optional URL where users can upgrade their plan.
 */
export function renderQuotaExceededComment(resetAt: string | undefined, upgradeUrl?: string): string {
  const resetDisplay = resetAt ? new Date(resetAt).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'the start of the next billing period';

  const lines = [
    '## Blamer attribution audit',
    '',
    'Attribution unavailable: free-tier quota (100 commits/month) exhausted.',
    `Wait until ${resetDisplay} or upgrade your plan.`,
  ];

  if (upgradeUrl) {
    lines.push(`Upgrade: ${upgradeUrl}`);
  }

  return lines.join('\n');
}

/**
 * Renders an authentication-error message.
 * No partial attribution data is exposed to avoid leaking information on invalid requests.
 */
export function renderAuthErrorComment(): string {
  return [
    '## Blamer attribution audit',
    '',
    'Blamer: authentication failed. Please reinstall the GitHub App or contact your installation support.',
  ].join('\n');
}
