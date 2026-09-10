// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/contracts.js` and `dist/contracts.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the two
// values are the compiled ones. Checked with
// the rebuild check.
//
// The schema is named as a literal type rather than a string, so a report from a
// future version cannot be read as this one by a comparison that happens to
// pass. The severities are a frozen list, and every other shape derives from it,
// which means adding one is a single edit rather than a search.
//
// The exit code is narrowed to nought or one at the type level. Those are the
// two the policy produces — clean and violations — and anything else is the
// scanner not having reached an answer, so it cannot be assigned here at all.
//
// Findings arrive either as a flat list or grouped by page, because a scan of
// one address and a scan of an exported archive report differently, and both
// have to fit one artefact.
//
// The scanner is an interface with a runtime behind it rather than a direct
// call. That is the only reason the parts above can be exercised without a
// browser.

export const CLI_SCAN_V1_SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';

export const IMPACTS = [
  'critical',
  'serious',
  'moderate',
  'minor'
] as const;

export type Impact = (typeof IMPACTS)[number];
export type CliPolicyExitCode = 0 | 1;
export type BrowserName = 'chromium' | 'firefox' | 'webkit';

export interface CliFindingV1 {
  readonly ruleId: string;
  readonly severity: Impact;
  readonly message: string;
  readonly [key: string]: unknown;
}

export interface CliScanSummaryV1 {
  readonly total: number;
  readonly byImpact: Readonly<Record<Impact, number>>;
}

export interface CliReportV1 {
  readonly scanId: string;
  readonly url: string;
  readonly findings: readonly CliFindingV1[] | Readonly<Record<string, readonly CliFindingV1[]>>;
  readonly [key: string]: unknown;
}

export interface CliScanV1 {
  readonly $schema: typeof CLI_SCAN_V1_SCHEMA;
  readonly url: string;
  readonly scanId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly summary: CliScanSummaryV1;
  readonly report: CliReportV1;
  readonly exitCode: CliPolicyExitCode;
}

export interface CliScanExpectation {
  readonly url: string;
  readonly exitCode: CliPolicyExitCode;
}

export interface CliScannerInvocation {
  readonly targetUrl: string;
  readonly outputDir: string;
  readonly browser: BrowserName;
  readonly severityThreshold: Impact;
  readonly timeoutMs: number;
  readonly allowPrivate: boolean;
}

export interface CliScannerRuntime {
  run(invocation: CliScannerInvocation): Promise<CliPolicyExitCode>;
}

export interface BeehiivScanOptions {
  readonly outputDir?: string;
  readonly browser?: BrowserName;
  readonly severityThreshold?: Impact;
  readonly timeoutMs?: number;
  readonly allowCustomDomain?: boolean;
}

export interface BeehiivScanDependencies {
  readonly runtime: CliScannerRuntime;
}

export type BeehiivScanSource =
  | {
      readonly kind: 'url';
      readonly url: string;
    }
  | {
      readonly kind: 'export';
      readonly path: string;
    };

export interface BeehiivScanResult {
  readonly source: BeehiivScanSource;
  readonly artifactPath: string;
  readonly artifact: CliScanV1;
  readonly findings: readonly CliFindingV1[];
  readonly exitCode: CliPolicyExitCode;
}
