// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/report.js` and `dist/report.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// the rebuild check.
//
// THIS DOES NOT TRUST THE SCANNER'S SUMMARY; IT RECOUNTS AND COMPARES. The
// findings are parsed, counted by severity, and the counts are checked against
// the ones the report declares — every level, not just the total. Then the
// threshold is applied here and the resulting verdict is checked against the
// exit code the scanner returned.
//
// That last check is the one worth having. The gate's whole answer is "did
// anything at or above this level appear", and it is being asked of a report
// that already contains an answer. If the two disagree, one of them is wrong and
// there is no way to tell which — so neither is used and the run stops. A gate
// that silently preferred either would pass releases on a number nobody could
// reproduce.
//
// Every error names the exact place — `$.summary.byImpact.serious` — so a
// malformed report is diagnosed from the message rather than by opening it.

import { ARIADA_SEVERITIES, } from "./types.js";
import type { AriadaSeverity, AriadaSummary, SeverityCounts } from "./types.js";

const ARIADA_SCHEMA = "https://ariada.org/schemas/cli-scan.v1.json";

const SEVERITY_RANK: Record<AriadaSeverity, number> = {
  minor: 0,
  moderate: 1,
  serious: 2,
  critical: 3,
};

interface ParsedFinding {
  ruleId: string;
  severity: AriadaSeverity;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid Ariada JSON at ${path}: expected object`);
  }
  return value as Record<string, unknown>;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid Ariada JSON at ${path}: expected non-negative integer`);
  }
  return value as number;
}

function severity(value: unknown, path: string): AriadaSeverity {
  if (typeof value !== "string" || !ARIADA_SEVERITIES.includes(value as AriadaSeverity)) {
    throw new Error(`Invalid Ariada JSON at ${path}: expected a supported severity`);
  }
  return value as AriadaSeverity;
}

function counts(value: unknown, path: string): SeverityCounts {
  const source = record(value, path);
  return {
    critical: nonNegativeInteger(source.critical, `${path}.critical`),
    serious: nonNegativeInteger(source.serious, `${path}.serious`),
    moderate: nonNegativeInteger(source.moderate, `${path}.moderate`),
    minor: nonNegativeInteger(source.minor, `${path}.minor`),
  };
}

function parseFinding(value: unknown, path: string): ParsedFinding {
  const source = record(value, path);
  if (typeof source.ruleId !== "string" || source.ruleId.length === 0) {
    throw new Error(`Invalid Ariada JSON at ${path}.ruleId: expected non-empty string`);
  }
  return { ruleId: source.ruleId, severity: severity(source.severity, `${path}.severity`) };
}

function findings(value: unknown, path: string): ParsedFinding[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => parseFinding(item, `${path}[${index}]`));
  }
  const groups = record(value, path);
  const result: ParsedFinding[] = [];
  for (const [group, entries] of Object.entries(groups)) {
    if (!Array.isArray(entries)) {
      throw new Error(`Invalid Ariada JSON at ${path}.${group}: expected array`);
    }
    result.push(...entries.map((item, index) => parseFinding(item, `${path}.${group}[${index}]`)));
  }
  return result;
}

function countFindings(entries: ParsedFinding[]): SeverityCounts {
  const result: SeverityCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const entry of entries)
    result[entry.severity] += 1;
  return result;
}

export function parseAriadaSummary(
  json: string,
  processExitCode: number,
  threshold: AriadaSeverity,
): AriadaSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  }
  catch (cause) {
    throw new Error("Ariada CLI did not emit valid JSON", { cause });
  }
  const envelope = record(parsed, "$");
  if (envelope.$schema !== ARIADA_SCHEMA) {
    throw new Error(`Invalid Ariada JSON at $.$schema: expected ${ARIADA_SCHEMA}`);
  }
  const declaredExitCode = nonNegativeInteger(envelope.exitCode, "$.exitCode");
  if (declaredExitCode !== 0 && declaredExitCode !== 1) {
    throw new Error("Invalid Ariada JSON at $.exitCode: expected 0 or 1");
  }
  if (declaredExitCode !== processExitCode) {
    throw new Error(`Ariada process/report exit mismatch: process=${processExitCode} report=${declaredExitCode}`);
  }
  const summary = record(envelope.summary, "$.summary");
  const declaredTotal = nonNegativeInteger(summary.total, "$.summary.total");
  const declaredCounts = counts(summary.byImpact, "$.summary.byImpact");
  const report = record(envelope.report, "$.report");
  const parsedFindings = findings(report.findings, "$.report.findings");
  const actualCounts = countFindings(parsedFindings);
  if (declaredTotal !== parsedFindings.length) {
    throw new Error("Ariada summary total does not match report findings");
  }
  for (const level of ARIADA_SEVERITIES) {
    if (declaredCounts[level] !== actualCounts[level]) {
      throw new Error(`Ariada summary count for ${level} does not match report findings`);
    }
  }
  const triggering = parsedFindings.filter((finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[threshold]);
  const expectedExitCode = triggering.length > 0 ? 1 : 0;
  if (declaredExitCode !== expectedExitCode) {
    throw new Error(`Ariada threshold result is inconsistent: threshold=${threshold} triggering=${triggering.length} exit=${declaredExitCode}`);
  }
  return {
    total: parsedFindings.length,
    triggering: triggering.length,
    bySeverity: actualCounts,
    ruleIds: [...new Set(parsedFindings.map((finding) => finding.ruleId))].sort(),
    triggeringRuleIds: [...new Set(triggering.map((finding) => finding.ruleId))].sort(),
  };
}
