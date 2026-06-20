// SPDX-License-Identifier: EUPL-1.2
//
// PR-comment payload builder. Invoked via actions/github-script from a
// consumer workflow that has already granted `pull-requests: write`.
// This file is a self-contained ESM module — it does not require the
// Octokit instance at import time so it can be unit-tested locally.

/**
 * @typedef {{ ruleId: string, severity: string, selector: string, wcagSc?: string, occurrences?: number }} Finding
 * @typedef {{ new: Finding[], pre_existing?: Finding[], resolved?: Finding[] }} Classification
 */

/**
 * Renders a rich Markdown PR-comment for the differential accessibility gate.
 * Follows the SonarCloud / Codecov PR-decoration pattern:
 *   - Summary table first (gate status, new, pre-existing, resolved)
 *   - Per-finding rows with direct severity, rule, and criterion
 *   - Report link if provided
 *   - Decision ID footer for audit trail
 *
 * @param {{
 *   result: string,
 *   counts: { new: number, pre_existing: number, resolved: number },
 *   decision_id: string,
 *   report_url?: string,
 *   recommended_action: string,
 *   classification?: Classification
 * }} decision
 * @returns {string}
 */
export function renderPrComment(decision) {
  const emoji =
    decision.result === 'pass' ? '✅' : decision.result === 'fail' ? '❌' : '⚠️';

  const { new: newCount, pre_existing: preCount, resolved: resolvedCount } =
    decision.counts;

  const lines = [
    `## ${emoji} Accessibility diff gate — \`${decision.result}\``,
    '',
    // Summary table — SonarCloud / Codecov pattern
    '| Metric | Value |',
    '|--------|-------|',
    `| Gate status | ${emoji} \`${decision.result}\` |`,
    `| New violations (this branch) | **${newCount}** |`,
    `| Pre-existing (not blocking) | ${preCount} |`,
    `| Resolved by this PR | ${resolvedCount} |`,
    '',
    decision.recommended_action,
  ];

  // Per-finding table — only when there are new findings with classification
  if (
    newCount > 0 &&
    decision.classification &&
    decision.classification.new &&
    decision.classification.new.length > 0
  ) {
    lines.push(
      '',
      '### New findings (must fix to merge)',
      '',
      '| Severity | Rule | WCAG criterion | Occurrences |',
      '|----------|------|----------------|-------------|',
    );
    for (const f of decision.classification.new) {
      const sev = f.severity ?? 'unknown';
      const rule = f.ruleId ?? '—';
      const criterion = f.wcagSc ? `SC ${f.wcagSc}` : '—';
      const occ = f.occurrences ?? 1;
      lines.push(`| ${sev} | \`${rule}\` | ${criterion} | ${occ} |`);
    }
  }

  if (decision.report_url) {
    lines.push('', `[Full report &#8594;](${decision.report_url})`);
  }

  lines.push('', `---`, `_Decision ID: \`${decision.decision_id}\` &middot; engine: stub (OSS equality classifier)_`);

  return lines.join('\n');
}
