// SPDX-License-Identifier: EUPL-1.2
//
// PR-comment payload builder. Invoked via actions/github-script from a
// consumer workflow that has already granted `pull-requests: write`.
// This file is a self-contained ESM module — it does not require the
// Octokit instance at import time so it can be unit-tested locally.

/**
 * @param {{ result: string, counts: { new: number, pre_existing: number, resolved: number }, decision_id: string, report_url?: string, recommended_action: string }} decision
 * @returns {string}
 */
export function renderPrComment(decision) {
  const emoji =
    decision.result === 'pass' ? '✅' : decision.result === 'fail' ? '❌' : '⚠️';
  const lines = [
    `## ${emoji} Accessibility diff gate — \`${decision.result}\``,
    '',
    `- **New findings**: ${decision.counts.new}`,
    `- **Pre-existing**: ${decision.counts.pre_existing}`,
    `- **Resolved**: ${decision.counts.resolved}`,
    '',
    decision.recommended_action,
  ];
  if (decision.report_url) {
    lines.push('', `[Full report →](${decision.report_url})`);
  }
  lines.push('', `_Decision ID: \`${decision.decision_id}\`_`);
  return lines.join('\n');
}
