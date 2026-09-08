// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/artifact.js` and `dist/artifact.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THIS FILE DISTRUSTS A FILE OUR OWN SCANNER WROTE, AND GOES FURTHER THAN MOST:
// it does not merely check that the fields are present and of the right type, it
// checks that they agree with each other.
//
// The duration must equal the completion minus the start. The totals must equal
// the findings actually counted, per severity and overall. The identifier and
// address inside the report must match the ones outside it, and the address must
// match the one that was asked for. Each of those is a way an artefact can be
// internally consistent in its types and still be describing a different run, a
// truncated write, or two runs stitched together — and none of them would be
// caught by checking types alone.
//
// Keys are required to match exactly rather than merely to be present. An extra
// key means the writer knew something this reader does not, and silently
// dropping it is how a reader keeps agreeing with a format it no longer
// understands.
//
// Timestamps must be canonical, checked by round-tripping rather than by a
// pattern: a string that parses to a date but does not print back identically is
// ambiguous, and two readers will disagree about it.
//
// Every complaint carries the path it happened at, in the notation of the
// document itself, because the reader of this error has the file open and needs
// to be told where to look rather than what mood the parser was in.

import {
  CLI_SCAN_V1_SCHEMA,
  IMPACTS,
  type CliFindingV1,
  type CliScanExpectation,
  type CliScanV1,
  type Impact
} from './contracts.js';

const TOP_LEVEL_KEYS = [
  '$schema',
  'completedAt',
  'durationMs',
  'exitCode',
  'report',
  'scanId',
  'startedAt',
  'summary',
  'url'
];

const SUMMARY_KEYS = ['byImpact', 'total'];

export class CliScanArtifactError extends Error {
  override readonly name = 'CliScanArtifactError';
}

function fail(path: string, message: string): never {
  throw new CliScanArtifactError(`${path}: ${message}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, i) => key !== wanted[i])) {
    fail(path, `expected exact keys ${wanted.join(', ')}, received ${actual.join(', ')}`);
  }
}

function asNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'expected a non-empty string');
  }
  return value;
}

function asSafeCount(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(path, 'expected a non-negative safe integer');
  }
  return value as number;
}

function asCanonicalTimestamp(value: unknown, path: string): string {
  const timestamp = asNonEmptyString(value, path);
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== timestamp) {
    fail(path, 'expected a canonical ISO-8601 UTC timestamp');
  }
  return timestamp;
}

function asHttpUrl(value: unknown, path: string): string {
  const text = asNonEmptyString(value, path);
  let parsed: URL;
  try {
    parsed = new URL(text);
  }
  catch {
    fail(path, 'expected a parseable URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail(path, 'expected an http(s) URL');
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    fail(path, 'credentials are forbidden');
  }
  return text;
}

function asImpact(value: unknown, path: string): Impact {
  if (typeof value !== 'string' || !IMPACTS.includes(value as Impact)) {
    fail(path, `expected one of ${IMPACTS.join(', ')}`);
  }
  return value as Impact;
}

function validateFinding(value: unknown, path: string): CliFindingV1 {
  const finding = asRecord(value, path);
  asNonEmptyString(finding['ruleId'], `${path}.ruleId`);
  asImpact(finding['severity'], `${path}.severity`);
  asNonEmptyString(finding['message'], `${path}.message`);
  return finding as unknown as CliFindingV1;
}

export function flattenCliFindings(
  findings: CliScanV1['report']['findings']
): readonly CliFindingV1[] {
  return Array.isArray(findings)
    ? findings
    : Object.values(findings).flat();
}

function validateFindings(value: unknown): CliFindingV1[] {
  if (Array.isArray(value)) {
    return value.map((finding, index) => validateFinding(finding, `$.report.findings[${index}]`));
  }
  const groups = asRecord(value, '$.report.findings');
  const flattened: CliFindingV1[] = [];
  for (const [group, entries] of Object.entries(groups)) {
    if (group.trim().length === 0 || !Array.isArray(entries)) {
      fail(`$.report.findings.${group}`, 'expected a named array of findings');
    }
    entries.forEach((finding, index) => {
      flattened.push(validateFinding(finding, `$.report.findings.${group}[${index}]`));
    });
  }
  return flattened;
}

export function parseCliScanV1(raw: string, expectation: CliScanExpectation): CliScanV1 {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  }
  catch {
    fail('$', 'artifact is not valid JSON');
  }
  const artifact = asRecord(decoded, '$');
  assertExactKeys(artifact, TOP_LEVEL_KEYS, '$');
  if (artifact['$schema'] !== CLI_SCAN_V1_SCHEMA) {
    fail('$.$schema', `expected ${CLI_SCAN_V1_SCHEMA}`);
  }
  const url = asHttpUrl(artifact['url'], '$.url');
  if (url !== expectation.url) {
    fail('$.url', `expected requested URL ${expectation.url}`);
  }
  const scanId = asNonEmptyString(artifact['scanId'], '$.scanId');
  const startedAt = asCanonicalTimestamp(artifact['startedAt'], '$.startedAt');
  const completedAt = asCanonicalTimestamp(artifact['completedAt'], '$.completedAt');
  const durationMs = asSafeCount(artifact['durationMs'], '$.durationMs');
  if (Date.parse(completedAt) - Date.parse(startedAt) !== durationMs) {
    fail('$.durationMs', 'does not match completedAt - startedAt');
  }
  const exitCode = artifact['exitCode'];
  if (exitCode !== 0 && exitCode !== 1) {
    fail('$.exitCode', 'expected CLI policy exit 0 or 1');
  }
  if (exitCode !== expectation.exitCode) {
    fail('$.exitCode', `expected process exit ${expectation.exitCode}`);
  }
  const summary = asRecord(artifact['summary'], '$.summary');
  assertExactKeys(summary, SUMMARY_KEYS, '$.summary');
  const total = asSafeCount(summary['total'], '$.summary.total');
  const byImpact = asRecord(summary['byImpact'], '$.summary.byImpact');
  assertExactKeys(byImpact, IMPACTS, '$.summary.byImpact');
  const expectedCounts: Record<Impact, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  };
  for (const impact of IMPACTS) {
    asSafeCount(byImpact[impact], `$.summary.byImpact.${impact}`);
  }
  const report = asRecord(artifact['report'], '$.report');
  if (asNonEmptyString(report['scanId'], '$.report.scanId') !== scanId) {
    fail('$.report.scanId', 'must match $.scanId');
  }
  if (asHttpUrl(report['url'], '$.report.url') !== url) {
    fail('$.report.url', 'must match $.url');
  }
  const findings = validateFindings(report['findings']);
  for (const finding of findings) {
    expectedCounts[finding.severity] += 1;
  }
  if (total !== findings.length) {
    fail('$.summary.total', 'must equal the number of validated findings');
  }
  for (const impact of IMPACTS) {
    if (byImpact[impact] !== expectedCounts[impact]) {
      fail(
        `$.summary.byImpact.${impact}`,
        `expected ${expectedCounts[impact]} from validated findings`
      );
    }
  }
  return artifact as unknown as CliScanV1;
}
