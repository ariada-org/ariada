// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type * as LH from 'lighthouse/types/lh.js';
import {
    ARIADA_SEVERITIES,
    type AriadaFinding,
    type AriadaReport,
    type AriadaSeverity,
} from './types.js';
const SCORE_BY_SEVERITY: Readonly<Record<AriadaSeverity, number>> = {
    critical: 0,
    serious: 0.25,
    moderate: 0.5,
    minor: 0.75,
};
const SEVERITY_ORDER = new Map(ARIADA_SEVERITIES.map((severity, index) => [severity, index]));
export const ARIADA_DETAIL_HEADINGS: LH.Audit.Details.Table['headings'] = [
    { key: 'severity', valueType: 'text', label: 'Severity' },
    { key: 'ruleId', valueType: 'code', label: 'Rule' },
    { key: 'domain', valueType: 'text', label: 'Domain' },
    { key: 'selector', valueType: 'code', label: 'Element' },
    { key: 'message', valueType: 'text', label: 'Finding' },
    { key: 'references', valueType: 'text', label: 'References' },
];
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isSeverity(value: unknown): value is AriadaSeverity {
    return typeof value === 'string' && ARIADA_SEVERITIES.includes(value as AriadaSeverity);
}
function assertFinding(value: unknown, index: number): asserts value is AriadaFinding {
    if (!isRecord(value)) {
        throw new TypeError(`Ariada finding at index ${index} is not an object.`);
    }
    if (typeof value['domain'] !== 'string' || value['domain'].length === 0) {
        throw new TypeError(`Ariada finding at index ${index} has no domain.`);
    }
    if (typeof value['ruleId'] !== 'string' || value['ruleId'].length === 0) {
        throw new TypeError(`Ariada finding at index ${index} has no ruleId.`);
    }
    if (!isSeverity(value['severity'])) {
        throw new TypeError(`Ariada finding at index ${index} has an invalid severity.`);
    }
    if (typeof value['message'] !== 'string') {
        throw new TypeError(`Ariada finding at index ${index} has no message.`);
    }
}
function validateFinding(value: unknown, index: number): AriadaFinding {
    assertFinding(value, index);
    return value;
}
function validateFindings(source: unknown): AriadaReport['findings'] {
    if (Array.isArray(source)) {
        return source.map((finding, index) => validateFinding(finding, index));
    }
    if (isRecord(source)) {
        const findingsByDomain: Record<string, AriadaFinding[]> = {};
        let findingIndex = 0;
        for (const domain of Object.keys(source).sort(compareText)) {
            const domainFindings = source[domain];
            if (!Array.isArray(domainFindings)) {
                throw new TypeError(`Ariada findings for domain ${domain} are not an array.`);
            }
            findingsByDomain[domain] = domainFindings.map((finding) => validateFinding(finding, findingIndex++));
        }
        return findingsByDomain;
    }
    throw new TypeError('Ariada report findings must be an array or a domain map.');
}
function isFindingArray(
    findings: AriadaReport['findings'],
): findings is readonly AriadaFinding[] {
    return Array.isArray(findings);
}
function compareText(left: string, right: string): number {
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
function compareFindings(left: AriadaFinding, right: AriadaFinding): number {
    const severityDifference = (SEVERITY_ORDER.get(left.severity) ?? Number.MAX_SAFE_INTEGER) -
        (SEVERITY_ORDER.get(right.severity) ?? Number.MAX_SAFE_INTEGER);
    if (severityDifference !== 0)
        return severityDifference;
    return (compareText(left.ruleId, right.ruleId) ||
        compareText(left.domain, right.domain) ||
        compareText(left.element?.selector ?? '', right.element?.selector ?? '') ||
        compareText(left.message, right.message));
}
export function extractAriadaReport(output: unknown): AriadaReport {
    const candidate = isRecord(output) && 'report' in output ? output['report'] : output;
    if (!isRecord(candidate)) {
        throw new TypeError('Ariada scan output must contain a report object.');
    }
    if (!('findings' in candidate)) {
        throw new TypeError('Ariada report must contain findings.');
    }
    const scanId = candidate['scanId'];
    const url = candidate['url'];
    return {
        findings: validateFindings(candidate['findings']),
        ...(typeof scanId === 'string' ? { scanId } : {}),
        ...(typeof url === 'string' ? { url } : {}),
    };
}
export function flattenAriadaFindings(output: unknown): AriadaFinding[] {
    const report = extractAriadaReport(output);
    const source = report.findings;
    let findings: AriadaFinding[];
    if (isFindingArray(source)) {
        findings = [...source];
    }
    else {
        findings = Object.keys(source)
            .sort(compareText)
            .flatMap((domain) => source[domain] ?? []);
    }
    return findings.sort(compareFindings);
}
export function scoreAriadaFindings(findings: readonly AriadaFinding[]): number {
    return findings.reduce((score, finding) => Math.min(score, SCORE_BY_SEVERITY[finding.severity]), 1);
}
function countBySeverity(findings: readonly AriadaFinding[]): Record<AriadaSeverity, number> {
    const counts: Record<AriadaSeverity, number> = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
    };
    for (const finding of findings) {
        counts[finding.severity] += 1;
    }
    return counts;
}
function severityBreakdown(findings: readonly AriadaFinding[]): string {
    const counts = countBySeverity(findings);
    return ARIADA_SEVERITIES.filter((severity) => counts[severity] > 0)
        .map((severity) => `${counts[severity]} ${severity}`)
        .join(', ');
}
function referencesForFinding(finding: AriadaFinding): string {
    const references = [
        finding.criterion,
        ...(finding.wcagMapping ?? []),
        ...(finding.regulatoryMapping ?? []).map((reference) => `${reference.framework} ${reference.code}`),
    ].filter((reference) => Boolean(reference));
    return [...new Set(references)].join(', ');
}
function detailsForFindings(findings: readonly AriadaFinding[]): LH.Audit.Details.Table {
    return {
        type: 'table',
        headings: ARIADA_DETAIL_HEADINGS,
        items: findings.map((finding) => ({
            severity: finding.severity,
            ruleId: finding.ruleId,
            domain: finding.domain,
            selector: finding.element?.selector ?? '',
            message: finding.message,
            references: referencesForFinding(finding),
        })),
    };
}
export function toAriadaConformanceProduct(output: unknown): LH.Audit.Product {
    const findings = flattenAriadaFindings(output);
    const displayValue = findings.length === 0
        ? 'No Ariada findings'
        : `${findings.length} Ariada finding${findings.length === 1 ? '' : 's'} (${severityBreakdown(findings)})`;
    return {
        score: scoreAriadaFindings(findings),
        numericValue: findings.length,
        numericUnit: 'unitless',
        displayValue,
        details: detailsForFindings(findings),
    };
}
export function toAriadaHighImpactProduct(output: unknown): LH.Audit.Product {
    const highImpactFindings = flattenAriadaFindings(output).filter((finding) => finding.severity === 'critical' || finding.severity === 'serious');
    const displayValue = highImpactFindings.length === 0
        ? 'No critical or serious Ariada findings'
        : `${highImpactFindings.length} high-impact Ariada finding${highImpactFindings.length === 1 ? '' : 's'} (${severityBreakdown(highImpactFindings)})`;
    return {
        score: highImpactFindings.length === 0 ? 1 : 0,
        numericValue: highImpactFindings.length,
        numericUnit: 'unitless',
        displayValue,
        details: detailsForFindings(highImpactFindings),
    };
}
