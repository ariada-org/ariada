// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/** @internal */
export {};

export type AriadaSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type AriadaFallback = 'cli';
export type AriadaScanMode = 'selenium-cdp' | 'dom-fallback';
export type AriadaAxTreeSource = 'selenium-session' | 'unavailable-from-webdriver';
export interface CdpSessionLike {
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
}
export interface WebDriverLike {
    getCurrentUrl(): Promise<string>;
    createCDPConnection?: (target: 'page') => Promise<CdpSessionLike> | CdpSessionLike;
    sendAndGetDevToolsCommand?: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
}
export interface AriadaFinding {
    ruleId: string; severity: AriadaSeverity | string; message: string; criterion?: string;
    element?: { selector?: string; role?: string; name?: string };
    nodes?: unknown[];
}
export interface AriadaPolicy { threshold: AriadaSeverity; blockingCount: number; passed: boolean }
export interface AriadaScanOptions { fallback?: AriadaFallback; outputDir?: string; severityThreshold?: AriadaSeverity; failOnViolation?: boolean }
export interface AriadaScanResult {
    url: string; mode: AriadaScanMode; axTreeSource: AriadaAxTreeSource; axTreeNodeCount: number;
    findings: AriadaFinding[]; policy: AriadaPolicy; outputDir?: string;
}
export interface CliRunScan {
    (url: string | undefined, options: { outputDir?: string; browser?: 'chromium' | 'firefox' | 'webkit'; format?: 'human' | 'json' | 'both'; severityThreshold?: AriadaSeverity }): Promise<number>;
}
export interface AriadaScanDependencies { cdpSession?: CdpSessionLike; loadAxeSource?: () => Promise<string>; runScan?: CliRunScan }
