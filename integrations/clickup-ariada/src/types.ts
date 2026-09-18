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
export interface ClickUpCustomField {
    id: string;
    value: string;
}
export interface ClickUpTaskInput {
    name: string;
    description: string;
    tags: string[];
    custom_fields: ClickUpCustomField[];
    fingerprint: string;
    sourceUrl?: string;
}
export interface ClickUpTask {
    id: string;
    name?: string;
    url?: string;
    description?: string;
    tags?: Array<{
        name?: string;
    }>;
    custom_fields?: Array<{
        id?: string;
        value?: unknown;
    }>;
}
export interface ClickUpWebhookRegistration {
    id: string;
    webhook?: {
        id?: string;
        secret?: string;
        endpoint?: string;
    };
    secret?: string;
    endpoint?: string;
}
export interface ClickUpWebhookEvent {
    webhook_id?: string;
    event?: string;
    task_id?: string;
    [key: string]: unknown;
}
export interface ClickUpTransport {
    listTasks(listId: string): Promise<ClickUpTask[]>;
    createTask(listId: string, input: ClickUpTaskInput): Promise<ClickUpTask>;
    createWebhook(teamId: string, endpoint: string, events?: string[]): Promise<ClickUpWebhookRegistration>;
}
export interface DedupeState {
    fingerprints: Record<string, string>;
}
export interface SyncResult {
    created: ClickUpTask[];
    skipped: string[];
}
