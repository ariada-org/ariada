// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/report.js` and `dist/report.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// This module has since been released from that comparison.
//
// HOW IT IS HELD NOW. Fifteen behaviour tests written while the comparison still
// matched, then the reader split into collecting findings, checking the summary
// agrees with them, and checking that something was actually examined. Nineteen
// against a limit of fifteen.
//
// That last split has a name because it is the substance: a scan that loaded no
// page, or ran no accessibility rules, reports zero findings — and zero findings
// is what a clean page reports. Remove either of those two checks and a false
// pass arrives wearing the right numbers, which is worse than a failure.
//
// The guarantee lives in `tests/scripts/recovered-storybook-alt-report.test.ts`,
// and the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// Two checks here exist because this scans a component rather than a page, and
// a component that never rendered looks exactly like one with nothing wrong: the
// accessibility analyzer must appear among those that ran, and the accessibility
// tree must be present and not empty. Their two failures are worded separately —
// a missing tree and an empty one are different faults, and reading which is
// which saves an afternoon.
//
// The rest is agreement between the report's halves: identifier and address
// inside must match the ones outside, each per-severity count must equal what
// was counted here, and the exit code must be what a minor threshold implies of
// the findings actually present.

import { ARIADA_SEVERITIES } from './types.js';
import type { AriadaFinding, AriadaSeverity, ParsedAriadaScan } from './types.js';

const CLI_SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';

export function emptySeverityCounts(): Record<AriadaSeverity, number> {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}

export function parseAriadaScanJson(text: string, expectedUrl: string, processExitCode: number): ParsedAriadaScan {
  let value: unknown;
  try {
    value = JSON.parse(text);
  }
  catch (error) {
    throw new Error('Ariada CLI report is not valid JSON', { cause: error });
  }
  const root = record(value, '$');
  if (string(root['$schema'], '$.$schema') !== CLI_SCHEMA)
    throw new Error('Ariada CLI report schema is unsupported');
  const url = httpUrl(root['url'], '$.url');
  if (url !== new URL(expectedUrl).href)
    throw new Error('Ariada CLI report URL does not match the story URL');
  const scanId = nonEmptyString(root['scanId'], '$.scanId');
  const exitCode = root['exitCode'];
  if (exitCode !== 0 && exitCode !== 1)
    throw new Error('Ariada CLI report exitCode must be 0 or 1');
  if (exitCode !== processExitCode)
    throw new Error('Ariada CLI process and report exit codes disagree');
  const report = record(root['report'], '$.report');
  if (nonEmptyString(report['scanId'], '$.report.scanId') !== scanId)
    throw new Error('Ariada report scanId is inconsistent');
  if (httpUrl(report['url'], '$.report.url') !== url)
    throw new Error('Ariada report URL is inconsistent');
  const findings = collectFindings(record(report['findings'], '$.report.findings'));
  const bySeverity = emptySeverityCounts();
  findings.forEach((finding) => {
    bySeverity[finding.severity] += 1;
  });
  assertSummaryAgrees(record(root['summary'], '$.summary'), findings, bySeverity);
  if (exitCode !== (findings.length > 0 ? 1 : 0)) {
    throw new Error('Ariada CLI minor-threshold semantic exit does not match findings');
  }
  const analyzers = assertSomethingWasLookedAt(report);
  const axTree = record(report['snapshot'], '$.report.snapshot')['axTree'] as unknown[];
  return { scanId, url, exitCode, findings, bySeverity, analyzersRun: analyzers, axTreeNodeCount: axTree.length, raw: root };
}

/** Every finding across every domain, refusing a group that is not a list. */
function collectFindings(groups: Record<string, unknown>): AriadaFinding[] {
  const findings: AriadaFinding[] = [];
  for (const [domain, entries] of Object.entries(groups)) {
    if (!Array.isArray(entries))
      throw new Error('$.report.findings.' + domain + ' must be an array');
    entries.forEach((entry, index) => findings.push(parseFinding(entry, domain, index)));
  }
  return findings;
}

/** The summary must equal what was actually counted, overall and per severity. */
function assertSummaryAgrees(
  summary: Record<string, unknown>,
  findings: readonly AriadaFinding[],
  bySeverity: Record<AriadaSeverity, number>,
): void {
  if (integer(summary['total'], '$.summary.total') !== findings.length) {
    throw new Error('Ariada CLI summary total does not match parsed findings');
  }
  const summaryCounts = record(summary['byImpact'], '$.summary.byImpact');
  for (const severity of ARIADA_SEVERITIES) {
    if (integer(summaryCounts[severity], '$.summary.byImpact.' + severity) !== bySeverity[severity]) {
      throw new Error('Ariada CLI summary ' + severity + ' count does not match findings');
    }
  }
}

/**
 * That something was actually examined, rather than nothing being wrong.
 *
 * A scan that loaded no page, or ran no accessibility rules, reports zero
 * findings — and zero findings is what a clean page reports too. These two
 * checks are the difference between the readings, and without them a false pass
 * arrives wearing the right numbers.
 */
function assertSomethingWasLookedAt(report: Record<string, unknown>): string[] {
  const stats = record(report['stats'], '$.report.stats');
  const analyzers = stringArray(stats['analyzersRun'], '$.report.stats.analyzersRun');
  if (!analyzers.includes('a11y'))
    throw new Error('Ariada accessibility analyzer did not run');
  const snapshot = record(report['snapshot'], '$.report.snapshot');
  const axTree = snapshot['axTree'];
  if (!Array.isArray(axTree) || axTree.length === 0)
    throw new Error('Ariada report does not contain a non-empty AX tree');
  return analyzers;
}

export function hasFindingAtOrAbove(findings: readonly AriadaFinding[], threshold: AriadaSeverity | false): boolean {
  if (threshold === false) return false;
  const rank: Record<AriadaSeverity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
  return findings.some((finding) => rank[finding.severity] >= rank[threshold]);
}

function parseFinding(value: unknown, domainKey: string, index: number): AriadaFinding {
  const path = '$.report.findings.' + domainKey + '[' + index + ']';
  const finding = record(value, path);
  const domain = nonEmptyString(finding['domain'], path + '.domain');
  if (domain !== domainKey)
    throw new Error(path + '.domain does not match its finding group');
  const severity = string(finding['severity'], path + '.severity');
  if (!ARIADA_SEVERITIES.includes(severity as AriadaSeverity))
    throw new Error(path + '.severity is unsupported');
  const element = record(finding['element'], path + '.element');
  const criterion = finding['criterion'];
  const wcagMapping = finding['wcagMapping'];
  return {
    id: nonEmptyString(finding['id'], path + '.id'),
    domain,
    ruleId: nonEmptyString(finding['ruleId'], path + '.ruleId'),
    severity: severity as AriadaSeverity,
    message: string(finding['message'], path + '.message'),
    selector: string(element['selector'], path + '.element.selector'),
    ...(criterion === undefined ? {} : { criterion: string(criterion, path + '.criterion') }),
    ...(wcagMapping === undefined ? {} : { wcagMapping: stringArray(wcagMapping, path + '.wcagMapping') }),
  };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(path + ' must be an object');
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string')
    throw new Error(path + ' must be a string');
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  const output = string(value, path);
  if (output.length === 0)
    throw new Error(path + ' must not be empty');
  return output;
}

function integer(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(path + ' must be a non-negative integer');
  return value as number;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value))
    throw new Error(path + ' must be an array');
  return value.map((entry, index) => string(entry, path + '[' + index + ']'));
}

function httpUrl(value: unknown, path: string): string {
  const raw = string(value, path);
  let url: URL;
  try {
    url = new URL(raw);
  }
  catch {
    throw new Error(path + ' must be an absolute URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error(path + ' must use HTTP(S)');
  return url.href;
}
