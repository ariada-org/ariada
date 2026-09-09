// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/result.js` and `dist/result.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// This file is released from that comparison, and is no longer held by the
// comparison with that module: it came out of the compiler flat enough to fail
// the complexity limit standing on publication.
//
// The behavioural checks in `tests/scripts/recovered-lit-result.test.ts` were
// written while the comparison still held, and are the guarantee now. The
// release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`; a
// divergence reported by `bash scripts/sverit-vosstanovlennoe.sh` on this
// package is expected.
//
// THE STRICTEST ARTIFACT READER OF THE SET, AND EVERY RULE IS A DISAGREEMENT IT
// CAN CATCH RATHER THAN A FORMALITY:
//
//   the duration must equal the completion time minus the start time — three
//   fields that are written separately and can drift apart;
//   the timestamps must be canonical, so that re-encoding them changes nothing;
//   the address must carry no credentials, since it is stored and re-read;
//   the summary total must equal the findings actually present, and each
//   per-severity count must equal what was counted here;
//   the identifier and address inside the report must match the ones outside it
//   when they are present at all.
//
// The findings keep whatever else they carried. Only the fields this code relies
// on are checked and normalised; the rest passes through, because narrowing
// another package's output to what this one happens to read would quietly
// discard what a person opening the artifact came for.
//
// Every refusal names its exact path — `$.summary.byImpact.serious` — and comes
// back as one error type carrying that path as data, so a caller can report it
// without parsing a sentence.

import { LitAriadaError } from './errors.js';
import { ARIADA_CLI_SCAN_SCHEMA, ARIADA_SEVERITIES, } from './types.js';
import type { AriadaFinding, AriadaImpactCounts, AriadaReport, AriadaSeverity, CliScanV1 } from './types.js';

function invalid(path: string, expectation: string): never {
  throw new LitAriadaError('SCAN_ARTIFACT_INVALID', `Invalid cli-scan.v1 artifact at ${path}: ${expectation}`, { path, expectation });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    return invalid(path, allowEmpty ? 'must be a string' : 'must be a non-empty string');
  }
  return value;
}

function integer(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    return invalid(path, 'must be a non-negative safe integer');
  }
  return value as number;
}

function httpUrl(value: unknown, path: string): string {
  const raw = stringValue(value, path);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  }
  catch {
    return invalid(path, 'must be an absolute HTTP(S) URL');
  }
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username.length > 0 ||
    parsed.password.length > 0) {
    return invalid(path, 'must be an absolute HTTP(S) URL without credentials');
  }
  return raw;
}

function isoTimestamp(value: unknown, path: string): { raw: string; epochMs: number } {
  const raw = stringValue(value, path);
  const epochMs = Date.parse(raw);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== raw) {
    return invalid(path, 'must be a canonical ISO-8601 timestamp');
  }
  return { raw, epochMs };
}

function severity(value: unknown, path: string): AriadaSeverity {
  if (typeof value !== 'string' || !ARIADA_SEVERITIES.includes(value as AriadaSeverity)) {
    return invalid(path, `must be one of ${ARIADA_SEVERITIES.join(', ')}`);
  }
  return value as AriadaSeverity;
}

function finding(value: unknown, path: string): AriadaFinding {
  const source = record(value, path);
  let element: Record<string, unknown> | undefined;
  if (source['element'] !== undefined) {
    const rawElement = record(source['element'], `${path}.element`);
    element = {
      ...rawElement,
      ...(rawElement['selector'] === undefined
        ? {}
        : { selector: stringValue(rawElement['selector'], `${path}.element.selector`) }),
    };
  }
  return {
    ...source,
    ruleId: stringValue(source['ruleId'], `${path}.ruleId`),
    severity: severity(source['severity'], `${path}.severity`),
    message: stringValue(source['message'], `${path}.message`, true),
    ...(element === undefined ? {} : { element }),
  } as AriadaFinding;
}

function parseFindings(value: unknown): { parsed?: unknown; flattened: AriadaFinding[] } {
  if (value === undefined) return { flattened: [] };
  if (Array.isArray(value)) {
    const parsed = value.map((item, index) => finding(item, `$.report.findings[${index}]`));
    return { parsed, flattened: parsed };
  }
  const source = record(value, '$.report.findings');
  const parsed: Record<string, AriadaFinding[]> = {};
  const flattened: AriadaFinding[] = [];
  for (const [group, groupValue] of Object.entries(source)) {
    if (group.trim().length === 0 || !Array.isArray(groupValue)) {
      return invalid(`$.report.findings.${group}`, 'must be an array under a non-empty key');
    }
    const groupFindings = groupValue.map((item, index) => finding(item, `$.report.findings.${group}[${index}]`));
    parsed[group] = groupFindings;
    flattened.push(...groupFindings);
  }
  return { parsed, flattened };
}

function impactCounts(value: unknown): AriadaImpactCounts {
  const source = record(value, '$.summary.byImpact');
  return {
    critical: integer(source['critical'], '$.summary.byImpact.critical'),
    serious: integer(source['serious'], '$.summary.byImpact.serious'),
    moderate: integer(source['moderate'], '$.summary.byImpact.moderate'),
    minor: integer(source['minor'], '$.summary.byImpact.minor'),
  };
}

export function flattenAriadaFindings(report: AriadaReport): readonly AriadaFinding[] {
  const findings = report.findings;
  if (findings === undefined) return [];
  return Array.isArray(findings) ? findings : Object.values(findings).flat();
}

/**
 * The summary must agree with the findings it summarises.
 *
 * The summary is the number anybody quotes; a total or a per-severity count that
 * disagrees with the list means the artifact contradicts itself, and one of the
 * two is being read by somebody.
 */
function assertSummaryAgrees(
  flattened: readonly AriadaFinding[],
  total: number,
  byImpact: Record<AriadaSeverity, number>,
): void {
  if (flattened.length !== total) {
    return invalid('$.summary.total', 'must equal the number of report findings');
  }
  const actual: Record<AriadaSeverity, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  for (const item of flattened) actual[item.severity] += 1;
  for (const level of ARIADA_SEVERITIES) {
    if (actual[level] !== byImpact[level]) {
      return invalid(`$.summary.byImpact.${level}`, 'must equal finding count');
    }
  }
}

/**
 * The report's own copies of the identifier and the address, where it has them.
 *
 * Only where it has them: an absent repetition is not a disagreement, and
 * demanding it would refuse sound artifacts.
 */
function assertReportEchoesTop(report: AriadaReport, scanId: string, url: string): void {
  if (report.scanId !== undefined && report.scanId !== scanId) {
    return invalid('$.report.scanId', 'must equal top-level scanId');
  }
  if (report.url !== undefined && report.url !== url) {
    return invalid('$.report.url', 'must equal top-level url');
  }
}

export function parseCliScanV1(input: string | unknown): CliScanV1 {
  let decoded = input;
  if (typeof input === 'string') {
    try {
      decoded = JSON.parse(input);
    }
    catch {
      return invalid('$', 'must be valid JSON');
    }
  }
  const source = record(decoded, '$');
  if (source['$schema'] !== ARIADA_CLI_SCAN_SCHEMA) {
    return invalid('$.$schema', `must equal ${ARIADA_CLI_SCAN_SCHEMA}`);
  }
  const url = httpUrl(source['url'], '$.url');
  const scanId = stringValue(source['scanId'], '$.scanId');
  const startedAt = isoTimestamp(source['startedAt'], '$.startedAt');
  const completedAt = isoTimestamp(source['completedAt'], '$.completedAt');
  const durationMs = integer(source['durationMs'], '$.durationMs');
  if (completedAt.epochMs - startedAt.epochMs !== durationMs) {
    return invalid('$.durationMs', 'must equal completedAt minus startedAt');
  }
  const summary = record(source['summary'], '$.summary');
  const total = integer(summary['total'], '$.summary.total');
  const byImpact = impactCounts(summary['byImpact']);
  const reportSource = record(source['report'], '$.report');
  const reportFindings = parseFindings(reportSource['findings']);
  assertSummaryAgrees(reportFindings.flattened, total, byImpact);

  const rawExit = source['exitCode'];
  if (rawExit !== 0 && rawExit !== 1) {
    return invalid('$.exitCode', 'must be 0 or 1');
  }
  const exitCode = rawExit;
  const report = {
    ...reportSource,
    ...(reportFindings.parsed === undefined ? {} : { findings: reportFindings.parsed }),
  } as AriadaReport;
  assertReportEchoesTop(report, scanId, url);
  return {
    $schema: ARIADA_CLI_SCAN_SCHEMA,
    url,
    scanId,
    startedAt: startedAt.raw,
    completedAt: completedAt.raw,
    durationMs,
    summary: { total, byImpact },
    report,
    exitCode,
  };
}
