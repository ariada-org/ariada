export type AriadaSeverity = 'critical' | 'serious' | 'moderate' | 'minor' | 'info' | string;
export interface AriadaFinding {
    id?: string;
    ruleId: string;
    title?: string;
    description?: string;
    severity?: AriadaSeverity;
    url?: string;
    selector?: string;
    html?: string;
    help?: string;
    helpUrl?: string;
    wcag?: string[];
    en301549?: string[];
    remediation?: string;
    fingerprint?: string;
    [key: string]: unknown;
}
export interface AriadaReport {
    schemaVersion?: string;
    scanId: string;
    completedAt?: string;
    sourceUrl?: string;
    reportUrl?: string;
    passed: boolean;
    summary?: {
        total?: number;
        violations?: number;
        [key: string]: unknown;
    };
    findings: AriadaFinding[];
    [key: string]: unknown;
}
export interface AriadaWebhookPayload {
    event: 'scan.completed';
    report: unknown;
}
export interface AriadaSourceConfig {
    kind: 'report' | 'webhook' | 'cli';
    reportPath?: string;
    cliPath?: string;
    cliArgs?: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
