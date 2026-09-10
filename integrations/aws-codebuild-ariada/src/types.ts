// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.js` and `dist/types.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the one value
// is the compiled one. Checked with
// the rebuild check.
//
// The report names the scanner package and its version alongside the result.
// This runs as a function somebody else invokes, so the answer travels away from
// the machine that produced it — and a verdict that cannot say what produced it
// is a number with no provenance.

export const SEVERITY_THRESHOLDS = [
  "minor",
  "moderate",
  "serious",
  "critical",
] as const;

export type SeverityThreshold = (typeof SEVERITY_THRESHOLDS)[number];

export interface LambdaScanEvent {
  url: string;
  severityThreshold?: SeverityThreshold;
  timeoutMs?: number;
}

export interface CliScanRequest {
  url: string;
  severityThreshold: SeverityThreshold;
  timeoutMs: number;
}

export interface ImpactCounts {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

export interface AriadaSummary {
  total: number;
  byImpact: ImpactCounts;
}

export interface AriadaScanEnvelope {
  $schema: "https://ariada.org/schemas/cli-scan.v1.json";
  url: string;
  scanId?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: AriadaSummary;
  report: unknown;
  exitCode: number;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  envelope: unknown | undefined;
}

export type CliRunner = (request: CliScanRequest) => Promise<CliRunResult>;

export interface LambdaScanReport {
  schemaVersion: 1;
  integration: {
    name: "aws-codebuild-ariada";
    cliPackage: "@ariada-org/cli";
    cliVersion: "0.1.0";
  };
  target: {
    url: string;
  };
  gate: {
    passed: boolean;
    outcome: "passed" | "violations";
    threshold: SeverityThreshold;
    exitCode: 0 | 1;
  };
  summary: AriadaSummary;
  ariada: AriadaScanEnvelope;
}
