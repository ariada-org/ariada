// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
export const ARIADA_SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;

export type AriadaSeverity = (typeof ARIADA_SEVERITIES)[number];

export interface AriadaElementReference {
    readonly selector?: string;
    readonly role?: string;
    readonly name?: string;
}

export interface AriadaRegulatoryReference {
    readonly framework: string;
    readonly code: string;
}

export interface AriadaFinding {
    readonly id?: string;
    readonly scanId?: string;
    readonly domain: string;
    readonly ruleId: string;
    readonly severity: AriadaSeverity;
    readonly element?: AriadaElementReference;
    readonly message: string;
    readonly criterion?: string;
    readonly wcagMapping?: readonly string[];
    readonly regulatoryMapping?: readonly AriadaRegulatoryReference[];
    readonly fingerprint?: string;
    readonly confidence?: number;
}

export interface AriadaReport {
    readonly scanId?: string;
    readonly url?: string;
    readonly findings:
        | readonly AriadaFinding[]
        | Readonly<Record<string, readonly AriadaFinding[]>>;
}

export interface AriadaScanResult {
    readonly report: AriadaReport;
}

export interface AriadaCliScanEnvelope {
    readonly $schema?: string;
    readonly report: AriadaReport;
}

export type AriadaScanOutput = AriadaReport | AriadaScanResult | AriadaCliScanEnvelope;

export interface AriadaScanContext {
    readonly requestedUrl: string;
    readonly mainDocumentUrl: string;
    readonly finalDisplayedUrl: string;
}

export type AriadaScanProvider = (
    context: AriadaScanContext,
) => AriadaScanOutput | Promise<AriadaScanOutput>;

export type AriadaScanFunction<TOptions> = (
    url: string,
    options?: TOptions,
) => Promise<AriadaScanOutput>;

export type AriadaScanOptionsFactory<TOptions> = (
    context: AriadaScanContext,
) => TOptions | undefined;
