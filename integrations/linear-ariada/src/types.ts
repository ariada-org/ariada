export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';
export interface AriadaFinding {
    id?: string;
    ruleId?: string;
    rule?: string;
    severity?: string;
    impact?: string;
    message?: string;
    description?: string;
    selector?: string;
    target?: string;
    page?: string;
    url?: string;
    wcag?: string | string[];
    en301549?: string | string[];
    remediation?: string;
    help?: string;
    fingerprint?: string;
}
export interface AriadaReport {
    url?: string;
    reportUrl?: string;
    findings?: AriadaFinding[];
    violations?: AriadaFinding[];
    report?: {
        findings?: AriadaFinding[];
    };
}
export interface LinearIssueInput {
    title: string;
    description: string;
    teamId: string;
    labelNames: string[];
    fingerprint: string;
    sourceUrl?: string;
}
export interface LinearIssue {
    id: string;
    identifier?: string;
    url?: string;
    title?: string;
    description?: string;
    labels?: {
        nodes?: {
            name?: string;
        }[];
    };
}
export interface LinearTransport {
    request<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}
export interface SyncResult {
    created: LinearIssue[];
    skipped: string[];
}
