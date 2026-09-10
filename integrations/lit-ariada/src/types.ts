// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.js` and `dist/types.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the two values
// are the compiled ones. Checked with
// the rebuild check.
//
// A finding and a report both keep an index signature alongside their named
// fields. This package reads another package's output, and dropping whatever it
// did not expect would silently narrow what a stored result contains — the named
// fields are what this code uses, not what the scanner is allowed to say.

export const ARIADA_CLI_SCAN_SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';
export const ARIADA_SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;

export type AriadaSeverity = (typeof ARIADA_SEVERITIES)[number];
export type AriadaScanExitCode = 0 | 1;
export type LitBrowser = 'chromium' | 'firefox' | 'webkit';

export interface AriadaFinding {
  readonly [key: string]: unknown;
  readonly ruleId: string;
  readonly severity: AriadaSeverity;
  readonly message: string;
  readonly element?: {
    readonly [key: string]: unknown;
    readonly selector?: string;
  };
}

export interface AriadaImpactCounts {
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
}

export interface AriadaReport {
  readonly [key: string]: unknown;
  readonly scanId?: string;
  readonly url?: string;
  readonly findings?: readonly AriadaFinding[] | Readonly<Record<string, readonly AriadaFinding[]>>;
}

export interface CliScanV1 {
  readonly $schema: typeof ARIADA_CLI_SCAN_SCHEMA;
  readonly url: string;
  readonly scanId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly summary: {
    readonly total: number;
    readonly byImpact: AriadaImpactCounts;
  };
  readonly report: AriadaReport;
  readonly exitCode: AriadaScanExitCode;
}

export interface LitScanOptions {
  readonly fixtureUrl: string;
  readonly componentSelector: string;
  readonly outputDirectory?: string;
  readonly browser?: LitBrowser;
  readonly severityThreshold?: AriadaSeverity;
  readonly timeoutMs?: number;
}

export interface LitScanResult {
  readonly schema: 'lit-ariada-result.v1';
  readonly fixtureUrl: string;
  readonly componentSelector: string;
  readonly outputDirectory: string;
  readonly scanArtifactPath: string;
  readonly resultArtifactPath: string;
  readonly invocation: {
    readonly package: '@ariada-org/cli';
    readonly version: '0.1.0';
    readonly exitCode: AriadaScanExitCode;
    readonly stdout: string;
    readonly stderr: string;
  };
  readonly scan: CliScanV1;
  readonly componentFindings: readonly AriadaFinding[];
  readonly decision: {
    readonly status: 'pass' | 'violations';
    readonly failOnSeverity: AriadaSeverity;
    readonly exitCode: AriadaScanExitCode;
  };
}

export interface LitAriadaCommandPayload {
  readonly fixtureUrl: string;
  readonly componentSelector: string;
  readonly browser?: LitBrowser;
  readonly severityThreshold?: AriadaSeverity;
  readonly timeoutMs?: number;
}
