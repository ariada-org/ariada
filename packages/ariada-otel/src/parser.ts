// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { URL } from 'node:url';
import {
    ARIADA_CLI_SCAN_SCHEMA,
    ARIADA_IMPACTS,
    type AriadaCliFinding,
    type AriadaCliSummary,
    type AriadaImpact,
    type AriadaImpactCounts,
    type ParsedAriadaScanResult,
} from './types.js';
const IMPACTS = new Set<string>(ARIADA_IMPACTS);
const SCORE_BY_IMPACT: Readonly<Record<AriadaImpact, number>> = {
    critical: 0,
    serious: 0.25,
    moderate: 0.5,
    minor: 0.75,
};
export class AriadaScanParseError extends TypeError {
    readonly path: string;
    constructor(path: string, detail: string) {
        super(`Invalid Ariada CLI scan at ${path}: ${detail}`);
        this.name = 'AriadaScanParseError';
        this.path = path;
    }
}
function invalid(path: string, detail: string): never {
    throw new AriadaScanParseError(path, detail);
}
function decodeInput(input: unknown): unknown {
    if (typeof input !== 'string') {
        return input;
    }
    if (input.trim().length === 0) {
        return invalid('$', 'JSON text must not be empty');
    }
    try {
        return JSON.parse(input);
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown JSON parser error';
        return invalid('$', `must be valid JSON (${detail})`);
    }
}
function readRecord(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return invalid(path, 'must be an object');
    }
    return value as Record<string, unknown>;
}
function readString(value: unknown, path: string): string {
    if (typeof value !== 'string') {
        return invalid(path, 'must be a string');
    }
    return value;
}
function readNonEmptyString(value: unknown, path: string): string {
    const text = readString(value, path);
    if (text.length === 0 || text.trim() !== text) {
        return invalid(path, 'must be a non-empty, unpadded string');
    }
    return text;
}
function readOptionalNonEmptyString(source: Record<string, unknown>, key: string, path: string): string | undefined {
    const value = source[key];
    return value === undefined ? undefined : readNonEmptyString(value, path);
}
function readNonNegativeInteger(value: unknown, path: string): number {
    if (typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0) {
        return invalid(path, 'must be a non-negative safe integer');
    }
    return value;
}
function readOptionalNonNegativeInteger(source: Record<string, unknown>, key: string, path: string): number | undefined {
    const value = source[key];
    return value === undefined ? undefined : readNonNegativeInteger(value, path);
}
function readHttpUrl(value: unknown, path: string): string {
    const text = readNonEmptyString(value, path);
    try {
        const parsed = new URL(text);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return invalid(path, 'must use the http or https scheme');
        }
    }
    catch {
        return invalid(path, 'must be a valid absolute http(s) URL');
    }
    return text;
}
function readTimestamp(value: unknown, path: string): { text: string; epochMillis: number } {
    const text = readNonEmptyString(value, path);
    const epochMillis = Date.parse(text);
    if (!Number.isFinite(epochMillis)) {
        return invalid(path, 'must be a valid ISO 8601 timestamp');
    }
    return { text, epochMillis };
}
function readOptionalTimestamp(source: Record<string, unknown>, key: string, path: string): { text: string; epochMillis: number } | undefined {
    const value = source[key];
    return value === undefined ? undefined : readTimestamp(value, path);
}
function readImpact(value: unknown, path: string): AriadaImpact {
    if (typeof value !== 'string' || !IMPACTS.has(value)) {
        return invalid(path, `must be one of ${ARIADA_IMPACTS.join(', ')}`);
    }
    return value as AriadaImpact;
}
function readFinding(value: unknown, path: string, mappedDomain?: string): AriadaCliFinding {
    const source = readRecord(value, path);
    const ruleId = readNonEmptyString(source['ruleId'], `${path}.ruleId`);
    const severity = readImpact(source['severity'], `${path}.severity`);
    const message = readString(source['message'], `${path}.message`);
    const explicitDomain = readOptionalNonEmptyString(source, 'domain', `${path}.domain`);
    const domain = explicitDomain ?? mappedDomain;
    return domain === undefined
        ? { ruleId, severity, message }
        : { ruleId, severity, message, domain };
}
function readFindings(value: unknown, path: string): AriadaCliFinding[] {
    if (Array.isArray(value)) {
        return value.map((finding, index) => readFinding(finding, `${path}[${index}]`));
    }
    const source = readRecord(value, path);
    const findings: AriadaCliFinding[] = [];
    for (const [domain, domainFindings] of Object.entries(source)) {
        if (domain.length === 0 || domain.trim() !== domain) {
            return invalid(path, 'domain keys must be non-empty and unpadded');
        }
        if (!Array.isArray(domainFindings)) {
            return invalid(`${path}.${domain}`, 'must be an array');
        }
        for (const [index, finding] of domainFindings.entries()) {
            findings.push(readFinding(finding, `${path}.${domain}[${index}]`, domain));
        }
    }
    return findings;
}
function readImpactCounts(value: unknown, path: string): AriadaImpactCounts {
    const source = readRecord(value, path);
    for (const key of Object.keys(source)) {
        if (!IMPACTS.has(key)) {
            return invalid(`${path}.${key}`, 'is not a supported impact');
        }
    }
    return {
        critical: readNonNegativeInteger(source['critical'], `${path}.critical`),
        serious: readNonNegativeInteger(source['serious'], `${path}.serious`),
        moderate: readNonNegativeInteger(source['moderate'], `${path}.moderate`),
        minor: readNonNegativeInteger(source['minor'], `${path}.minor`),
    };
}
function readSummary(value: unknown, path: string): AriadaCliSummary {
    const source = readRecord(value, path);
    return {
        total: readNonNegativeInteger(source['total'], `${path}.total`),
        byImpact: readImpactCounts(source['byImpact'], `${path}.byImpact`),
    };
}
function countImpacts(findings: readonly AriadaCliFinding[]): Record<AriadaImpact, number> {
    const counts: Record<AriadaImpact, number> = {
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
function scoreFindings(findings: readonly AriadaCliFinding[]): number {
    let score = 1;
    for (const finding of findings) {
        score = Math.min(score, SCORE_BY_IMPACT[finding.severity]);
    }
    return score;
}
function readExitCode(value: unknown, path: string): 0 | 1 {
    if (value !== 0 && value !== 1) {
        return invalid(path, 'must be 0 (pass) or 1 (violations)');
    }
    return value;
}
/** Parse and cross-check one current Ariada CLI `cli-scan.v1` payload. */
export function parseAriadaScanResult(input: unknown): ParsedAriadaScanResult {
    const source = readRecord(decodeInput(input), '$');
    if (source['$schema'] !== ARIADA_CLI_SCAN_SCHEMA) {
        return invalid('$.$schema', `must equal ${ARIADA_CLI_SCAN_SCHEMA}`);
    }
    const url = readHttpUrl(source['url'], '$.url');
    const topLevelScanId = readOptionalNonEmptyString(source, 'scanId', '$.scanId');
    const startedAt = readOptionalTimestamp(source, 'startedAt', '$.startedAt');
    const completedAt = readOptionalTimestamp(source, 'completedAt', '$.completedAt');
    const durationMs = readOptionalNonNegativeInteger(source, 'durationMs', '$.durationMs');
    const summary = readSummary(source['summary'], '$.summary');
    const report = readRecord(source['report'], '$.report');
    const reportUrlValue = report['url'];
    const reportUrl = reportUrlValue === undefined
        ? undefined
        : readHttpUrl(reportUrlValue, '$.report.url');
    const reportScanId = readOptionalNonEmptyString(report, 'scanId', '$.report.scanId');
    const findings = readFindings(report['findings'], '$.report.findings');
    const exitCode = readExitCode(source['exitCode'], '$.exitCode');
    if (reportUrl !== undefined && reportUrl !== url) {
        return invalid('$.report.url', 'must match $.url');
    }
    if (topLevelScanId !== undefined &&
        reportScanId !== undefined &&
        topLevelScanId !== reportScanId) {
        return invalid('$.report.scanId', 'must match $.scanId');
    }
    if (summary.total !== findings.length) {
        return invalid('$.summary.total', `must equal the ${findings.length} report findings`);
    }
    const actualByImpact = countImpacts(findings);
    for (const impact of ARIADA_IMPACTS) {
        if (summary.byImpact[impact] !== actualByImpact[impact]) {
            return invalid(`$.summary.byImpact.${impact}`, `must equal the ${actualByImpact[impact]} report findings with that impact`);
        }
    }
    if (startedAt !== undefined && completedAt !== undefined) {
        const elapsedMillis = completedAt.epochMillis - startedAt.epochMillis;
        if (elapsedMillis < 0) {
            return invalid('$.completedAt', 'must not precede $.startedAt');
        }
        if (durationMs !== undefined && durationMs !== elapsedMillis) {
            return invalid('$.durationMs', `must equal timestamp interval ${elapsedMillis}`);
        }
    }
    const scanId = topLevelScanId ?? reportScanId;
    return {
        schema: ARIADA_CLI_SCAN_SCHEMA,
        url,
        summary,
        findings,
        exitCode,
        gate: exitCode === 0 ? 'pass' : 'fail',
        score: scoreFindings(findings),
        ...(scanId === undefined ? {} : { scanId }),
        ...(startedAt === undefined
            ? {}
            : { startedAt: startedAt.text, startedAtEpochMillis: startedAt.epochMillis }),
        ...(completedAt === undefined
            ? {}
            : { completedAt: completedAt.text, completedAtEpochMillis: completedAt.epochMillis }),
        ...(durationMs === undefined ? {} : { durationMs }),
    };
}
