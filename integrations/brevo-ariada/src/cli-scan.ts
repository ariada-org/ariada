// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/cli-scan.js` and `dist/cli-scan.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. It is released from that comparison: the digest
// no longer has to match, and what holds this file now is the behaviour
// described in the tests beside it, written while
// the comparison still agreed, so it describes the code that ships rather than
// the intent behind it.
//
// THIS IS THE STRICTEST READER IN THE SET, AND EVERY EXTRA QUESTION IT ASKS IS
// ABOUT THE REPORT AGREEING WITH ITSELF. Types and presence are the easy half;
// what it really refuses is a document that is well-formed and untrue.
//
// The duration must equal the completion minus the start, and the completion
// must not precede the start. The per-severity counts must sum to the total, and
// the total must equal the findings actually present, and each severity's count
// must equal the findings actually carrying it — three separate ways of asking
// whether the summary was computed from the report or written beside it.
//
// The identifier and address inside the report must match the ones outside it,
// so a report about another run cannot be presented as this one's.
//
// And an exit code of one requires at least one finding. That is the sharpest
// check here: it is the only one that catches a scan claiming violations while
// reporting none — a shape that reads as a working gate and blocks nothing.
//
// Unknown fields are refused rather than ignored. An extra key means the writer
// knew something this reader does not, and silently dropping it is how a reader
// keeps agreeing with a format it has stopped understanding.
//
// Timestamps are checked by round-tripping rather than by pattern: a string that
// parses but does not print back identically is ambiguous, and two readers will
// disagree about what it meant.

export const CLI_SCAN_SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';
export const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface AriadaFinding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly [key: string]: unknown;
}

export interface AriadaReport {
  readonly scanId: string;
  readonly url: string;
  readonly findings: readonly AriadaFinding[] | Readonly<Record<string, readonly AriadaFinding[]>>;
  readonly [key: string]: unknown;
}

export interface CliScanEnvelope {
  readonly $schema: typeof CLI_SCAN_SCHEMA;
  readonly url: string;
  readonly scanId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly summary: {
    readonly total: number;
    readonly byImpact: Readonly<Record<Severity, number>>;
  };
  readonly report: AriadaReport;
  readonly exitCode: 0 | 1;
}

export class CliScanParseError extends Error {
  override readonly name = 'CliScanParseError';
}

const ROOT_KEYS = new Set([
  '$schema',
  'url',
  'scanId',
  'startedAt',
  'completedAt',
  'durationMs',
  'summary',
  'report',
  'exitCode',
]);

const SUMMARY_KEYS = new Set(['total', 'byImpact']);
const IMPACT_KEYS = new Set<string>(SEVERITIES);

function invalid(path: string, expectation: string): never {
  throw new CliScanParseError(`Invalid cli-scan.v1 at ${path}: ${expectation}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return invalid(path, 'expected an array');
  return value;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  required: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid(`${path}.${key}`, 'unknown field');
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) invalid(`${path}.${key}`, 'required field is missing');
  }
}

function nonEmptyStringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    return invalid(path, 'expected a non-empty string');
  }
  return value;
}

function nonNegativeIntegerAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    return invalid(path, 'expected a non-negative safe integer');
  }
  return value;
}

function httpUrlAt(value: unknown, path: string): string {
  const text = nonEmptyStringAt(value, path);
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return invalid(path, 'expected an http(s) URL');
    }
    return url.href;
  }
  catch {
    return invalid(path, 'expected a valid URL');
  }
}

function canonicalTimestampAt(value: unknown, path: string): { text: string; milliseconds: number } {
  const text = nonEmptyStringAt(value, path);
  const milliseconds = Date.parse(text);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== text) {
    return invalid(path, 'expected a canonical ISO 8601 UTC timestamp');
  }
  return { text, milliseconds };
}

function severityAt(value: unknown, path: string): Severity {
  if (value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor') {
    return value;
  }
  return invalid(path, 'expected critical, serious, moderate, or minor');
}

function findingAt(value: unknown, path: string): AriadaFinding {
  const finding = objectAt(value, path);
  const ruleId = nonEmptyStringAt(finding['ruleId'], `${path}.ruleId`);
  const severity = severityAt(finding['severity'], `${path}.severity`);
  const message = nonEmptyStringAt(finding['message'], `${path}.message`);
  return { ...finding, ruleId, severity, message };
}

function findingsAt(value: unknown, path: string): AriadaReport['findings'] {
  if (Array.isArray(value)) {
    return value.map((finding, index) => findingAt(finding, `${path}[${index}]`));
  }
  const groups = objectAt(value, path);
  const parsed: Record<string, readonly AriadaFinding[]> = {};
  for (const [group, findings] of Object.entries(groups)) {
    if (group.length === 0) invalid(path, 'finding group names must be non-empty');
    parsed[group] = arrayAt(findings, `${path}.${group}`).map((finding, index) =>
      findingAt(finding, `${path}.${group}[${index}]`),
    );
  }
  return parsed;
}

export function flattenFindings(report: Pick<AriadaReport, 'findings'>): readonly AriadaFinding[] {
  if (Array.isArray(report.findings)) return report.findings;
  return Object.values(report.findings).flat();
}

/**
 * The three time fields, and the two ways they can disagree with each other. A
 * scan cannot finish before it starts, and its stated duration has to be the
 * distance between the two — otherwise one of the three was written by hand.
 */
function timingAt(envelope: Record<string, unknown>): {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
} {
  const startedAt = canonicalTimestampAt(envelope['startedAt'], '$.startedAt');
  const completedAt = canonicalTimestampAt(envelope['completedAt'], '$.completedAt');
  const durationMs = nonNegativeIntegerAt(envelope['durationMs'], '$.durationMs');
  if (completedAt.milliseconds < startedAt.milliseconds) {
    return invalid('$.completedAt', 'must not precede startedAt');
  }
  if (completedAt.milliseconds - startedAt.milliseconds !== durationMs) {
    return invalid('$.durationMs', 'must equal completedAt minus startedAt');
  }
  return { startedAt: startedAt.text, completedAt: completedAt.text, durationMs };
}

/**
 * The summary, read and checked against itself. The per-severity counts have to
 * sum to the total; whether either of them describes the report is a separate
 * question, asked below once the findings have been read.
 */
function summaryAt(envelope: Record<string, unknown>): {
  readonly total: number;
  readonly byImpact: Record<Severity, number>;
} {
  const summary = objectAt(envelope['summary'], '$.summary');
  exactKeys(summary, SUMMARY_KEYS, [...SUMMARY_KEYS], '$.summary');
  const total = nonNegativeIntegerAt(summary['total'], '$.summary.total');
  const rawByImpact = objectAt(summary['byImpact'], '$.summary.byImpact');
  exactKeys(rawByImpact, IMPACT_KEYS, SEVERITIES, '$.summary.byImpact');
  const byImpact = {
    critical: nonNegativeIntegerAt(rawByImpact['critical'], '$.summary.byImpact.critical'),
    serious: nonNegativeIntegerAt(rawByImpact['serious'], '$.summary.byImpact.serious'),
    moderate: nonNegativeIntegerAt(rawByImpact['moderate'], '$.summary.byImpact.moderate'),
    minor: nonNegativeIntegerAt(rawByImpact['minor'], '$.summary.byImpact.minor'),
  };
  if (Object.values(byImpact).reduce((sum, count) => sum + count, 0) !== total) {
    return invalid('$.summary', 'byImpact counts must sum to total');
  }
  return { total, byImpact };
}

/**
 * Whether the summary was computed from the report or written beside it. Both
 * the count and its breakdown are compared against the findings actually
 * present, because a summary can agree with itself and describe another run.
 */
function assertSummaryDescribesReport(
  flatFindings: readonly AriadaFinding[],
  total: number,
  byImpact: Record<Severity, number>,
): void {
  if (flatFindings.length !== total) {
    invalid('$.summary.total', 'must match the number of report findings');
  }
  const observed: Record<Severity, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const finding of flatFindings) observed[finding.severity] += 1;
  for (const severity of SEVERITIES) {
    if (observed[severity] !== byImpact[severity]) {
      invalid(`$.summary.byImpact.${severity}`, 'must match report findings');
    }
  }
}

/**
 * The report, with the two fields that must name the same run as the envelope
 * around it. A report about another scan cannot be presented as this one's.
 */
function reportAt(envelope: Record<string, unknown>, scanId: string, url: string): AriadaReport {
  const rawReport = objectAt(envelope['report'], '$.report');
  const reportScanId = nonEmptyStringAt(rawReport['scanId'], '$.report.scanId');
  const reportUrl = httpUrlAt(rawReport['url'], '$.report.url');
  if (reportScanId !== scanId) return invalid('$.report.scanId', 'must match $.scanId');
  if (reportUrl !== url) return invalid('$.report.url', 'must match $.url');
  const findings = findingsAt(rawReport['findings'], '$.report.findings');
  return {
    ...rawReport,
    scanId: reportScanId,
    url: reportUrl,
    findings,
  } as AriadaReport;
}

/**
 * The verdict, and the one way it can contradict the report it came with. An
 * exit code of one claims violations; a run claiming violations while reporting
 * none reads as a working gate and blocks nothing.
 */
function exitCodeAt(envelope: Record<string, unknown>, total: number): 0 | 1 {
  const exitCode = envelope['exitCode'];
  if (exitCode !== 0 && exitCode !== 1) return invalid('$.exitCode', 'expected 0 or 1');
  if (exitCode === 1 && total === 0) {
    return invalid('$.exitCode', 'exit 1 requires at least one finding');
  }
  return exitCode;
}

export function parseCliScan(source: string): CliScanEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CliScanParseError(`cli-scan.v1 is not strict JSON: ${detail}`);
  }
  const envelope = objectAt(raw, '$');
  exactKeys(envelope, ROOT_KEYS, [...ROOT_KEYS], '$');
  if (envelope['$schema'] !== CLI_SCAN_SCHEMA) {
    return invalid('$.$schema', `expected ${CLI_SCAN_SCHEMA}`);
  }
  const url = httpUrlAt(envelope['url'], '$.url');
  const scanId = nonEmptyStringAt(envelope['scanId'], '$.scanId');
  const { startedAt, completedAt, durationMs } = timingAt(envelope);
  const { total, byImpact } = summaryAt(envelope);
  const report = reportAt(envelope, scanId, url);
  assertSummaryDescribesReport(flattenFindings(report), total, byImpact);
  return {
    $schema: CLI_SCAN_SCHEMA,
    url,
    scanId,
    startedAt,
    completedAt,
    durationMs,
    summary: { total, byImpact },
    report,
    exitCode: exitCodeAt(envelope, total),
  };
}
