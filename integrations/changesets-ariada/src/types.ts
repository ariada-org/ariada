// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/types.js` and `dist/types.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the one value
// is the compiled one. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// The report has a schema version because it is written to disk and read back
// by a later step, possibly by a later version of this package. Two counts are
// carried rather than one — everything found, and everything at or above the
// threshold — so lowering the threshold later needs no rescan, and a passing
// gate does not read as a page with nothing wrong with it.

export const ARIADA_SEVERITIES = ["critical", "serious", "moderate", "minor"] as const;

export type AriadaSeverity = (typeof ARIADA_SEVERITIES)[number];

export type BrowserName = "chromium" | "firefox" | "webkit";

export interface SeverityCounts {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

export interface AriadaSummary {
  total: number;
  triggering: number;
  bySeverity: SeverityCounts;
  ruleIds: string[];
  triggeringRuleIds: string[];
}

export interface ChangesetSummary {
  required: boolean;
  directory: string;
  pending: string[];
}

export interface GateReport {
  schemaVersion: "1.0";
  status: "pass" | "fail";
  target: string;
  threshold: AriadaSeverity;
  ariadaExitCode: 0 | 1;
  findings: AriadaSummary;
  changesets: ChangesetSummary;
}

export interface GateOptions {
  url: string;
  severityThreshold: AriadaSeverity;
  browser: BrowserName;
  timeoutMs: number;
  outputDirectory: string;
  reportPath: string;
  changesetDirectory: string;
  requireChangeset: boolean;
  allowPrivate: boolean;
  changelogPath?: string;
  cwd: string;
}

export interface GateExecution {
  report: GateReport;
  diagnostics: string;
}
