// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/artifact.js` and `dist/artifact.d.ts`. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// THIS READS THE SCANNER'S OWN OUTPUT AND REFUSES IT UNLESS IT AGREES WITH
// ITSELF. Every check here is a way the artifact could contradict its own
// contents, and each one has a reason to exist rather than being defensive
// habit:
//
//   the schema must be the one this understands, because a later format that
//   happens to parse would be read under the wrong meaning;
//
//   the address scanned must be the address asked for, because a report about
//   some other page is worse than no report;
//
//   the identifier and address inside the report must match the ones outside
//   it, because those two halves are written at different moments;
//
//   the per-severity counts must add up to the stated total, and the findings
//   actually present must number that total — a summary that disagrees with its
//   own detail is the one thing a reader will not check by hand;
//
//   the exit code must be one of the two the scanner is allowed to mean, and
//   must match what the process returned.
//
// The error path names the exact location — `$.summary.byImpact.serious` — so a
// broken artifact is diagnosed from the message rather than by reading the file.
// And a parse failure is wrapped rather than propagated, so "this file is not
// JSON" arrives as a contract failure with the path in it, like the others.

import { readFile } from 'node:fs/promises';

const SCHEMA_URI = 'https://ariada.org/schemas/cli-scan.v1.json';

export const IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;

export type Impact = (typeof IMPACTS)[number];

export interface Finding {
  ruleId?: string;
  severity?: string;
  [key: string]: unknown;
}

export interface ParsedScanArtifact {
  schema: typeof SCHEMA_URI;
  url: string;
  scanId: string;
  durationMs: number;
  total: number;
  byImpact: Record<Impact, number>;
  findings: Finding[];
  exitCode: 0 | 1;
  raw: Record<string, unknown>;
}

export class ArtifactContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtifactContractError';
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ArtifactContractError(path + ' must be an object');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ArtifactContractError(path + ' must be a non-empty string');
  }
  return value;
}

function integer(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new ArtifactContractError(path + ' must be a non-negative safe integer');
  }
  return value as number;
}

function flattenFindings(report: Record<string, unknown>): Finding[] {
  const value = report['findings'];
  if (value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((entry, index) => record(entry, '$.report.findings[' + String(index) + ']'));
  }
  const grouped = record(value, '$.report.findings');
  const findings: Finding[] = [];
  for (const [domain, entries] of Object.entries(grouped)) {
    if (!Array.isArray(entries)) {
      throw new ArtifactContractError('$.report.findings.' + domain + ' must be an array');
    }
    entries.forEach((entry, index) => {
      findings.push(record(entry, '$.report.findings.' + domain + '[' + String(index) + ']'));
    });
  }
  return findings;
}

export function parseCliScanArtifact(
  value: unknown,
  expectedUrl?: string,
  expectedExitCode?: number,
): ParsedScanArtifact {
  const root = record(value, '$');
  if (root['$schema'] !== SCHEMA_URI) {
    throw new ArtifactContractError('$.$schema must equal ' + SCHEMA_URI);
  }
  const url = requiredString(root['url'], '$.url');
  if (expectedUrl !== undefined && url !== expectedUrl) {
    throw new ArtifactContractError('$.url does not match requested target ' + expectedUrl);
  }
  const scanId = requiredString(root['scanId'], '$.scanId');
  const durationMs = integer(root['durationMs'], '$.durationMs');
  const report = record(root['report'], '$.report');
  if (requiredString(report['scanId'], '$.report.scanId') !== scanId) {
    throw new ArtifactContractError('$.report.scanId does not match $.scanId');
  }
  if (requiredString(report['url'], '$.report.url') !== url) {
    throw new ArtifactContractError('$.report.url does not match $.url');
  }
  const findings = flattenFindings(report);
  const summary = record(root['summary'], '$.summary');
  const total = integer(summary['total'], '$.summary.total');
  const rawByImpact = record(summary['byImpact'], '$.summary.byImpact');
  const byImpact = Object.fromEntries(IMPACTS.map((impact) => [impact, integer(rawByImpact[impact], '$.summary.byImpact.' + impact)])) as Record<Impact, number>;
  if (Object.values(byImpact).reduce((sum, count) => sum + count, 0) !== total) {
    throw new ArtifactContractError('$.summary.byImpact counts do not add up to $.summary.total');
  }
  if (findings.length !== total) {
    throw new ArtifactContractError('$.report findings count does not match $.summary.total');
  }
  const exitCode = root['exitCode'];
  if (exitCode !== 0 && exitCode !== 1) {
    throw new ArtifactContractError('$.exitCode must be 0 or 1');
  }
  if (expectedExitCode !== undefined && exitCode !== expectedExitCode) {
    throw new ArtifactContractError('$.exitCode does not match Ariada process exit code');
  }
  return { schema: SCHEMA_URI, url, scanId, durationMs, total, byImpact, findings, exitCode, raw: root };
}

export async function readCliScanArtifact(
  path: string,
  expectedUrl?: string,
  expectedExitCode?: number,
): Promise<ParsedScanArtifact> {
  try {
    return parseCliScanArtifact(JSON.parse(await readFile(path, 'utf8')), expectedUrl, expectedExitCode);
  }
  catch (error) {
    if (error instanceof ArtifactContractError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ArtifactContractError('Cannot read Ariada artifact ' + path + ': ' + message);
  }
}
