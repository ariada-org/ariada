// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
export const ARIADA_CLI_SCAN_SCHEMA: "https://ariada.org/schemas/cli-scan.v1.json" =
    'https://ariada.org/schemas/cli-scan.v1.json';
export const ARIADA_IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;

export type AriadaImpact = (typeof ARIADA_IMPACTS)[number];
export type AriadaGateResult = 'pass' | 'fail';
export type AriadaImpactCounts = Readonly<Record<AriadaImpact, number>>;

/** Telemetry-relevant fields from one CLI finding. Other report fields remain opaque. */
export interface AriadaCliFinding {
    readonly ruleId: string;
    readonly severity: AriadaImpact;
    readonly message: string;
    readonly domain?: string;
    readonly [key: string]: unknown;
}

export type AriadaCliFindings =
    | readonly AriadaCliFinding[]
    | Readonly<Record<string, readonly AriadaCliFinding[]>>;

export interface AriadaCliReport {
    readonly scanId?: string;
    readonly url?: string;
    readonly findings: AriadaCliFindings;
    readonly [key: string]: unknown;
}

export interface AriadaCliSummary {
    readonly total: number;
    readonly byImpact: AriadaImpactCounts;
    readonly [key: string]: unknown;
}

/** Wire shape emitted by `ariada scan --format json`. */
export interface AriadaCliScanResult {
    readonly $schema: typeof ARIADA_CLI_SCAN_SCHEMA;
    readonly url: string;
    readonly scanId?: string;
    readonly startedAt?: string;
    readonly completedAt?: string;
    readonly durationMs?: number;
    readonly summary: AriadaCliSummary;
    readonly report: AriadaCliReport;
    readonly exitCode: 0 | 1;
    readonly [key: string]: unknown;
}

/** Validated, flattened representation used to record one scan atomically. */
export interface ParsedAriadaScanResult {
    readonly schema: typeof ARIADA_CLI_SCAN_SCHEMA;
    readonly url: string;
    readonly scanId?: string;
    readonly startedAt?: string;
    readonly startedAtEpochMillis?: number;
    readonly completedAt?: string;
    readonly completedAtEpochMillis?: number;
    readonly durationMs?: number;
    readonly summary: AriadaCliSummary;
    readonly findings: readonly AriadaCliFinding[];
    readonly exitCode: 0 | 1;
    readonly gate: AriadaGateResult;
    readonly score: number;
}
