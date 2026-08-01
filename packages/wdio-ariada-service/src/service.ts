// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { resolve } from 'node:path';
import { runAriadaScan } from './scan-adapter.js';
import type { AriadaAnnotatedResult, AriadaHookName, AriadaReportAttachment, AriadaServiceOptions, AriadaWdioBrowser } from './types.js';
export class AriadaPolicyError extends Error {
    readonly result: AriadaReportAttachment;
    constructor(result: AriadaReportAttachment) { super(formatPolicyFailure(result)); this.name = 'AriadaPolicyError'; this.result = result; }
}
/** WebdriverIO runner service. */
export default class AriadaService {
    readonly results: AriadaReportAttachment[] = [];
    private readonly options: AriadaServiceOptions;
    private browser?: AriadaWdioBrowser;
    private scanning = false;
    private sequence = 0;
    constructor(options: AriadaServiceOptions = {}) { this.options = options; }
    before(_capabilities: unknown, _specs: readonly string[], browser: AriadaWdioBrowser): void { this.browser = browser; }
    async afterTest(test: AriadaAnnotatedResult & Record<string, unknown>, _context: unknown, outcome: AriadaAnnotatedResult & Record<string, unknown>): Promise<void> { if (this.options.scanAfterTest === false)
        return; await this.scan('afterTest', testLabel(test), [test, outcome]); }
    async afterCommand(commandName: string, _args: unknown, _result: unknown, _error?: Error): Promise<void> { if (this.scanning || !shouldScanCommand(this.options.scanAfterCommand, commandName))
        return; await this.scan('afterCommand', commandName, []); }
    private async scan(hook: AriadaHookName, label: string, targets: Array<AriadaAnnotatedResult & Record<string, unknown>>): Promise<void> {
        if (this.scanning)
            return;
        if (!this.browser)
            throw new Error('Ariada WDIO service has no browser session; the before hook did not run');
        this.scanning = true;
        try {
            const result = await runAriadaScan(this.browser, { outputDir: this.nextOutputDir(hook, label), ...(this.options.severityThreshold !== undefined ? { severityThreshold: this.options.severityThreshold } : {}) });
            const attachment = { ...result, hook, label };
            this.results.push(attachment);
            for (const target of targets)
                attach(target, attachment);
            this.log(`ARIADA_WDIO_REPORT ${JSON.stringify(attachment)}`);
            await this.options.onResult?.(attachment);
            if (this.options.failOnViolation !== false && result.exitCode === 1)
                throw new AriadaPolicyError(attachment);
        }
        finally {
            this.scanning = false;
        }
    }
    private nextOutputDir(hook: AriadaHookName, label: string): string { this.sequence += 1; return resolve(this.options.outputDir ?? 'ariada-output/wdio', `${String(this.sequence).padStart(3, '0')}-${slug(hook)}-${slug(label)}`); }
    private log(line: string): void { if (this.options.log)
        this.options.log(line);
    else
        process.stdout.write(`${line}\n`); }
}
function shouldScanCommand(option: AriadaServiceOptions['scanAfterCommand'], name: string): boolean { return option === true || (Array.isArray(option) && option.includes(name)); }
function attach(target: AriadaAnnotatedResult, result: AriadaReportAttachment): void { try {
    target.ariada = result;
}
catch { /* Frozen runner objects still get the reporter line. */ } }
function testLabel(test: Record<string, unknown>): string { const full = test.fullTitle; if (typeof full === 'string' && full)
    return full; const title = test.title; return typeof title === 'string' && title ? title : 'unnamed-test'; }
function slug(value: string): string { return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '').slice(0, 80) || 'scan'; }
function formatPolicyFailure(result: AriadaReportAttachment): string { const details = result.findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'serious' || finding.severity === 'moderate').slice(0, 10).map((finding) => `${finding.ruleId} [${finding.severity}] ${finding.element.selector}`).join(', '); return `Ariada policy failed with ${result.blockingCount} blocking violation(s) on ${result.url}${details ? `: ${details}` : ''}. Report: ${result.artifactPath}`; }
