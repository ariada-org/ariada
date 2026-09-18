import { createHash } from 'node:crypto';

import type { AriadaFinding, AriadaReport, ClickUpCustomField, ClickUpTask, ClickUpTaskInput } from './types.js';
const severities: readonly string[] = ['minor', 'moderate', 'serious', 'critical'];
const text = (value: unknown, fallback: string): string => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const list = (value: unknown): string => Array.isArray(value) ? value.join(', ') : text(value, 'Not specified');
export function findingsFromReport(report: AriadaReport): AriadaFinding[] {
    return report.findings ?? report.violations ?? report.report?.findings ?? [];
}
// A stable name for a finding, so the same one twice does not become two tasks.
// It is a digest of what makes the finding what it is — rule, page, selector —
// and it goes into the task body and a tag, which is where the next run looks.
export function fingerprint(finding: AriadaFinding, reportUrl = ''): string {
    if (finding.fingerprint?.trim())
        return finding.fingerprint.trim();
    const stable = [finding.ruleId ?? finding.rule ?? finding.id ?? 'ariada/unknown', finding.page ?? finding.url ?? reportUrl, finding.selector ?? finding.target ?? 'document'].join('|');
    return createHash('sha256').update(stable).digest('hex').slice(0, 32);
}
export function toClickUpTask(
    finding: AriadaFinding,
    options: { reportUrl?: string; severityFieldId?: string; ruleIdFieldId?: string },
): ClickUpTaskInput {
    const ruleId = text(finding.ruleId ?? finding.rule ?? finding.id, 'ariada/unknown');
    const severity = severities.includes(finding.severity as string) ? (finding.severity as string) : 'moderate';
    const page = text(finding.page ?? finding.url, 'Unknown page');
    const sourceUrl = options.reportUrl ?? finding.url;
    const fp = fingerprint(finding, sourceUrl);
    const description = [
        `Ariada fingerprint: ${fp}`, '', `Rule: ${ruleId}`, `Severity: ${severity}`,
        `WCAG: ${list(finding.wcag)}`, `EN 301 549: ${list(finding.en301549)}`,
        `Page: ${page}`, `Selector: ${text(finding.selector ?? finding.target, 'document')}`,
        `Finding: ${text(finding.message ?? finding.description, 'Accessibility issue reported by Ariada.')}`,
        `Remediation: ${text(finding.remediation ?? finding.help, 'See the rule guidance in the Ariada report.')}`,
        sourceUrl ? `Report: ${sourceUrl}` : undefined,
    ].filter(Boolean).join('\n');
    const custom_fields: ClickUpCustomField[] = [
        options.severityFieldId ? { id: options.severityFieldId, value: severity } : undefined,
        options.ruleIdFieldId ? { id: options.ruleIdFieldId, value: ruleId } : undefined,
    ].filter((field): field is ClickUpCustomField => Boolean(field));
    return { name: `[${severity}] ${ruleId} - ${page}`, description, tags: ['ariada', `ariada-${severity}`, `ariada-${ruleId}`, `ariada-fp-${fp}`], custom_fields, fingerprint: fp, ...(sourceUrl ? { sourceUrl } : {}) };
}
export function hasFingerprint(task: ClickUpTask, fp: string): boolean {
    return task.description?.includes(`Ariada fingerprint: ${fp}`) === true || task.tags?.some((tag) => tag.name === `ariada-fp-${fp}`) === true;
}
