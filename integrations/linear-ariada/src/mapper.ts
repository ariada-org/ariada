import { createHash } from 'node:crypto';

import type { AriadaFinding, AriadaReport, LinearIssue, LinearIssueInput, Severity } from './types.js';
const severities: readonly Severity[] = ['minor', 'moderate', 'serious', 'critical'];
const text = (value: unknown, fallback: string): string => typeof value === 'string' && value.trim() ? value.trim() : fallback;
export function findingsFromReport(report: AriadaReport): AriadaFinding[] {
    return report.findings ?? report.violations ?? report.report?.findings ?? [];
}
// A stable name for a finding that arrived without one, so the same finding
// twice does not become two issues. It is a digest of what makes the finding
// what it is — rule, page, selector — and it goes into the issue body, which is
// where the next run looks for it.
export function fingerprint(finding: AriadaFinding, reportUrl = ''): string {
    if (finding.fingerprint?.trim())
        return finding.fingerprint.trim();
    const stable = [finding.ruleId ?? finding.rule ?? finding.id ?? 'ariada/unknown', finding.page ?? finding.url ?? reportUrl, finding.selector ?? finding.target ?? 'document'].join('|');
    return createHash('sha256').update(stable).digest('hex').slice(0, 32);
}
function list(value: unknown): string {
    return Array.isArray(value) ? value.join(', ') : text(value, 'Not specified');
}
export function toLinearIssue(
    finding: AriadaFinding,
    options: { teamId: string; reportUrl?: string },
): LinearIssueInput {
    const ruleId = text(finding.ruleId ?? finding.rule ?? finding.id, 'ariada/unknown');
    const severity: Severity = severities.includes(finding.severity as Severity)
        ? (finding.severity as Severity)
        : 'moderate';
    const page = text(finding.page ?? finding.url, 'Unknown page');
    const sourceUrl = options.reportUrl ?? finding.url;
    const fp = fingerprint(finding, sourceUrl);
    const description = [
        `Ariada accessibility finding (${fp})`,
        '',
        `Rule: ${ruleId}`,
        `Severity: ${severity}`,
        `WCAG: ${list(finding.wcag)}`,
        `EN 301 549: ${list(finding.en301549)}`,
        `Page: ${page}`,
        `Selector: ${text(finding.selector ?? finding.target, 'document')}`,
        `Finding: ${text(finding.message ?? finding.description, 'Accessibility issue reported by Ariada.')}`,
        `Remediation: ${text(finding.remediation ?? finding.help, 'See the rule guidance in the Ariada report.')}`,
        sourceUrl ? `Report: ${sourceUrl}` : undefined,
    ].filter(Boolean).join('\n');
    return { title: `[${severity}] ${ruleId} - ${page}`, description, teamId: options.teamId, labelNames: [`ariada:${severity}`, `ariada:${ruleId}`], fingerprint: fp, ...(sourceUrl ? { sourceUrl } : {}) };
}
export function hasFingerprint(issue: LinearIssue, fp: string): boolean {
    return issue.description?.includes(`(${fp})`) === true || issue.labels?.nodes?.some((label) => label.name === `ariada:fingerprint:${fp}`) === true;
}
