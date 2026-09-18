import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { AriadaFinding, AriadaReport, CommandRunner, SaleorScanResult, ShopConfig } from './types.js';
const execFileAsync = promisify(execFile);
export function resolveStorefrontUrl(config: ShopConfig): string {
    const raw = config.storefrontUrl ?? (config.domain ? `${config.domain.protocol === 'HTTP' ? 'http' : 'https'}://${config.domain.host}` : undefined);
    if (!raw)
        throw new Error('Saleor shop config does not define a storefront URL');
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('Saleor storefront URL must use http or https');
    return url.toString().replace(/\/$/, '');
}
export function parseAriadaReport(value: unknown): AriadaReport {
    if (!value || typeof value !== 'object')
        throw new Error('Ariada output must be an object');
    const input = value as { findings?: unknown; report?: { findings?: unknown }; summary?: AriadaReport['summary']; reportUrl?: unknown };
    const findingsValue = input.findings ?? input.report?.findings;
    const findings = Array.isArray(findingsValue) ? findingsValue.map((finding) => {
        if (!finding || typeof finding !== 'object')
            throw new Error('Ariada finding must be an object');
        const item = finding as Record<string, unknown>;
        if (typeof item['ruleId'] !== 'string' || typeof item['severity'] !== 'string' || typeof item['message'] !== 'string')
            throw new Error('Ariada finding requires ruleId, severity, and message');
        const parsed: AriadaFinding = { ruleId: item['ruleId'] as string, severity: item['severity'] as string, message: item['message'] as string };
        if (typeof item['domain'] === 'string')
            parsed.domain = item['domain'] as string;
        if (typeof item['eaa'] === 'string')
            parsed.eaa = item['eaa'] as string;
        if (typeof item['standard'] === 'string')
            parsed.standard = item['standard'] as string;
        return parsed;
    }) : [];
    const report: AriadaReport = { findings };
    if (input.summary)
        report.summary = input.summary;
    if (typeof input.reportUrl === 'string')
        report.reportUrl = input.reportUrl;
    return report;
}
const defaultRunner: CommandRunner = async (command, args) => {
    try {
        const result = await execFileAsync(command, args, { maxBuffer: 10 * 1024 * 1024 });
        return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
    }
    catch (error) {
        const failure = error as { code?: unknown; stdout?: string; stderr?: string };
        return { exitCode: typeof failure.code === 'number' ? failure.code : 2, stdout: failure.stdout ?? '', stderr: failure.stderr ?? String(error) };
    }
};
// Exit one means findings, not failure. Treating it as an error would turn
// every storefront with an accessibility problem into a broken integration.
export async function scanStorefront(config: ShopConfig, runner: CommandRunner = defaultRunner, command = 'ariada'): Promise<SaleorScanResult> {
    const storefrontUrl = resolveStorefrontUrl(config);
    const result = await runner(command, ['scan', storefrontUrl, '--format', 'json']);
    if (result.exitCode > 1)
        throw new Error(`Ariada CLI failed with exit ${result.exitCode}: ${result.stderr}`);
    const report = parseAriadaReport(JSON.parse(result.stdout));
    const scan: SaleorScanResult = { status: report.findings.length === 0 ? 'passed' : 'failed', storefrontUrl, totalFindings: report.findings.length, findings: report.findings };
    if (report.reportUrl)
        scan.reportUrl = report.reportUrl;
    return scan;
}
