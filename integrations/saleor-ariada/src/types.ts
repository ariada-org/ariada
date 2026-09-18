export type SaleorPermission = 'MANAGE_SETTINGS';
export interface SaleorManifest {
    id: string;
    version: string;
    requiredSaleorVersion: string;
    name: string;
    author: string;
    about: string;
    permissions: SaleorPermission[];
    appUrl: string;
    tokenTargetUrl: string;
    dataPrivacy: string;
    homepageUrl: string;
    supportUrl: string;
    extensions: Array<{
        label: string;
        mount: 'HOMEPAGE_WIDGETS';
        target: 'WIDGET';
        permissions: SaleorPermission[];
        url: string;
        options: {
            homeWidgetTarget: {
                method: 'GET';
                fullscreen: boolean;
            };
        };
    }>;
    webhooks: [];
}
export interface AuthData {
    domain: string;
    token: string;
}
export interface APL {
    get(domain: string): Promise<AuthData | undefined>;
    set(authData: AuthData): Promise<void>;
    delete(domain: string): Promise<void>;
    getAll(): Promise<AuthData[]>;
}
export interface ShopConfig {
    storefrontUrl?: string;
    domain?: {
        host: string;
        protocol?: 'HTTP' | 'HTTPS';
    };
}
export interface AriadaFinding {
    ruleId: string;
    severity: string;
    message: string;
    domain?: string;
    eaa?: string;
    standard?: string;
}
export interface AriadaReport {
    summary?: {
        total?: number;
        passed?: number;
        failed?: number;
    };
    findings: AriadaFinding[];
    reportUrl?: string;
}
export interface SaleorScanResult {
    status: 'passed' | 'failed';
    storefrontUrl: string;
    totalFindings: number;
    findings: AriadaFinding[];
    reportUrl?: string;
}
export type CommandRunner = (command: string, args: string[]) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
}>;
