// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { EXIT_OK, EXIT_RUNTIME_ERROR, EXIT_VIOLATIONS, type ExitCode } from '@ariada-org/cli';
import { createErrorArtifact, parseAriadaArtifact } from './artifact.js';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { ARIADA_ATTACHMENT_CONTENT_TYPE, ARIADA_ATTACHMENT_NAME, ARIADA_REPORTER_SCHEMA, type AriadaArtifact } from './types.js';

export interface AriadaReporterOptions { readonly outputFile?: string; readonly enforcePolicy?: boolean; readonly quiet?: boolean }
export interface AriadaReporterTestRecord {
    readonly testId: string; readonly title: string; readonly titlePath: readonly string[];
    readonly projectName: string; readonly retry: number; readonly playwrightStatus: TestResult['status'];
    readonly artifacts: readonly AriadaArtifact[];
}
export interface AriadaReporterEnvelope {
    readonly $schema: typeof ARIADA_REPORTER_SCHEMA; readonly version: 1;
    readonly playwrightStatus: FullResult['status']; readonly exitCode: ExitCode;
    readonly summary: { readonly tests: number; readonly scans: number; readonly findings: number; readonly blockingFindings: number; readonly blockers: number };
    readonly tests: readonly AriadaReporterTestRecord[];
}
export default class AriadaReporter implements Reporter {
    private readonly outputFile: string;
    private readonly enforcePolicy: boolean;
    private readonly quiet: boolean;
    private readonly records: AriadaReporterTestRecord[] = [];
    constructor(options: AriadaReporterOptions = {}) { this.outputFile = resolve(options.outputFile ?? 'ariada-results.json'); this.enforcePolicy = options.enforcePolicy ?? true; this.quiet = options.quiet ?? false; }
    printsToStdio(): boolean { return !this.quiet; }
    async onTestEnd(test: TestCase, result: TestResult): Promise<void> { const attachments = result.attachments.filter((a) => a.name === ARIADA_ATTACHMENT_NAME && a.contentType === ARIADA_ATTACHMENT_CONTENT_TYPE); if (attachments.length === 0)
        return; const artifacts = []; for (const attachment of attachments) {
        try {
            const body = attachment.body ? attachment.body.toString('utf8') : attachment.path ? await readFile(attachment.path, 'utf8') : undefined;
            if (body === undefined)
                throw new Error('Ariada attachment has neither body nor path');
            artifacts.push(parseAriadaArtifact(body));
        }
        catch (error) {
            artifacts.push(createErrorArtifact(error));
        }
    } const record: AriadaReporterTestRecord = { testId: test.id, title: test.title, titlePath: test.titlePath(), projectName: test.parent.project()?.name ?? '', retry: result.retry, playwrightStatus: result.status, artifacts }; this.records.push(record); if (!this.quiet)
        process.stdout.write(formatConsoleSection(record)); }
    async onEnd(result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> { const envelope = this.createEnvelope(result.status); await mkdir(dirname(this.outputFile), { recursive: true }); await writeFile(this.outputFile, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8'); if (this.enforcePolicy && result.status === 'passed' && envelope.exitCode !== EXIT_OK)
        return { status: 'failed' }; return undefined; }
    private createEnvelope(playwrightStatus: FullResult['status']): AriadaReporterEnvelope { const tests = [...this.records].sort((a, b) => a.testId.localeCompare(b.testId) || a.retry - b.retry); let scans = 0, findings = 0, blockingFindings = 0, blockers = 0; for (const record of tests)
        for (const artifact of record.artifacts) {
            if (artifact.status === 'error') {
                blockers += 1;
                continue;
            }
            scans += 1;
            blockingFindings += artifact.result.policy.blockingFindings.length;
            for (const site of artifact.result.report.sites)
                for (const domain of artifact.result.report.domains)
                    findings += artifact.result.report.grid[site]?.[domain]?.length ?? 0;
        } const exitCode = blockers > 0 ? EXIT_RUNTIME_ERROR : blockingFindings > 0 ? EXIT_VIOLATIONS : EXIT_OK; return { $schema: ARIADA_REPORTER_SCHEMA, version: 1, playwrightStatus, exitCode, summary: { tests: tests.length, scans, findings, blockingFindings, blockers }, tests }; }
}
function formatConsoleSection(record: AriadaReporterTestRecord): string { const lines = [`\n  Ariada a11y: ${record.title}\n`]; for (const artifact of record.artifacts) {
    if (artifact.status === 'error')
        lines.push(`    BLOCKED: ${artifact.error.message}\n`);
    else {
        lines.push(`    ${artifact.result.policy.blockingFindings.length} blocking finding(s), threshold ${artifact.result.policy.threshold}, AX ${artifact.result.capabilities.axTree.status}\n`);
        for (const finding of artifact.result.policy.blockingFindings.slice(0, 10))
            lines.push(`    - ${finding.ruleId} [${finding.severity}] ${finding.element.selector}\n`);
    }
} return lines.join(''); }
