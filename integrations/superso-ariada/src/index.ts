// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface ScanOptions {
  publishedUrl: string;
  outputDirectory?: string;
  cliBin?: string;
  severityThreshold?: Severity;
}

export interface ScanCommand {
  command: string;
  args: string[];
}

export interface AriadaFinding {
  id: string;
  severity: Severity;
  message: string;
  target: string;
}

export interface SuperSoScanResult {
  publishedUrl: string;
  findings: AriadaFinding[];
  summary: { total: number; blocking: number };
  gate: { threshold: Severity; passed: boolean };
}

export type CommandRunner = (command: ScanCommand) => Promise<number>;

const SEVERITY_RANK: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

/**
 * The command line for one scan.
 *
 * With no executable named it reaches the scanner through the package runner
 * rather than assuming one is installed.
 *
 * @param options - the page, where to write, and the rest
 * @returns the command and its arguments
 */
export function buildScanCommand(options: {
  publishedUrl: string;
  outputDirectory: string;
  cliBin?: string;
  severityThreshold?: Severity;
}): ScanCommand {
  const cliBin = options.cliBin ?? process.env['ARIADA_CLI_BIN'];
  return {
    command: cliBin ?? 'npx',
    args: [
      ...(cliBin ? [] : ['--yes', '@ariada-org/cli']),
      'scan',
      options.publishedUrl,
      '--format',
      'json',
      '--output-dir',
      options.outputDirectory,
      '--domains',
      'accessibility',
      '--severity-threshold',
      options.severityThreshold ?? 'serious',
    ],
  };
}

/**
 * Run one scan.
 *
 * The address is checked before the command is built, so a bad address fails
 * here rather than as a scanner error about something it was handed.
 *
 * @param options - the page and the settings
 * @param runner - how commands are run
 * @returns the scanner's exit code
 */
export async function scanSuperSoSite(
  options: ScanOptions,
  runner: CommandRunner = runCommand,
): Promise<number> {
  validatePublishedUrl(options.publishedUrl);
  return runner(
    buildScanCommand({
      publishedUrl: options.publishedUrl,
      outputDirectory: options.outputDirectory ?? 'ariada-output',
      ...(options.cliBin ? { cliBin: options.cliBin } : {}),
      ...(options.severityThreshold ? { severityThreshold: options.severityThreshold } : {}),
    }),
  );
}

/**
 * Read the report the scanner wrote.
 *
 * @param outputDirectory - where it wrote
 * @param publishedUrl - the page
 * @param threshold - the severity that fails the gate
 * @returns the result
 */
export async function readAriadaResult(
  outputDirectory: string,
  publishedUrl: string,
  threshold: Severity = 'serious',
): Promise<SuperSoScanResult> {
  const payload = JSON.parse(await readFile(resolve(outputDirectory, 'scan.json'), 'utf8'));
  return mapAriadaResult(payload, publishedUrl, threshold);
}

/**
 * Turn a report into this integration's result, with its gate.
 *
 * @param payload - the report
 * @param publishedUrl - the page
 * @param threshold - the severity that fails the gate
 * @returns the result
 */
export function mapAriadaResult(
  payload: unknown,
  publishedUrl: string,
  threshold: Severity = 'serious',
): SuperSoScanResult {
  const findings = collectFindings(payload).map(toFinding);
  const blocking = findings.filter(
    (finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[threshold],
  ).length;
  return {
    publishedUrl,
    findings,
    summary: { total: findings.length, blocking },
    gate: { threshold, passed: blocking === 0 },
  };
}

/**
 * The exit code for a result.
 *
 * @param result - the result
 * @returns zero when the gate passed
 */
export function evaluateGate(result: SuperSoScanResult): number {
  return result.gate.passed ? 0 : 1;
}

/**
 * Refuse anything that is not a web address.
 *
 * @param value - the candidate
 */
function validatePublishedUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Super.so scan requires an http(s) published URL');
}

/**
 * The findings, from whichever of the four places a report keeps them.
 *
 * @param payload - the report
 * @returns the findings, or none
 */
function collectFindings(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const report = (
    root['report'] && typeof root['report'] === 'object' ? root['report'] : root
  ) as Record<string, unknown>;
  if (Array.isArray(root['findings'])) return root['findings'];
  if (Array.isArray(report['findings'])) return report['findings'];
  if (report['findings'] && typeof report['findings'] === 'object')
    return Object.values(report['findings']).flatMap((value) => (Array.isArray(value) ? value : []));
  return [];
}

/**
 * One finding, whatever the report called its fields.
 *
 * An unrecognised severity becomes serious, which is this integration's own
 * threshold: unknown blocks rather than passes.
 *
 * @param value - the raw finding
 * @returns the finding
 */
function toFinding(value: unknown): AriadaFinding {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const severity = row['severity'] ?? row['impact'];
  return {
    id: String(row['id'] ?? row['ruleId'] ?? 'ariada/unknown'),
    severity:
      severity === 'minor' || severity === 'moderate' || severity === 'critical'
        ? severity
        : 'serious',
    message: String(row['message'] ?? row['description'] ?? 'Ariada finding'),
    target: String(row['target'] ?? row['selector'] ?? 'document'),
  };
}

/**
 * Run a command, letting its output through to the caller's terminal.
 *
 * The child-process module is imported where it is used rather than at the top,
 * so importing this module from a browser bundle does not pull it in.
 *
 * @param command - the command and its arguments
 * @returns the exit code, or three when it could not be started
 */
function runCommand({ command, args }: ScanCommand): Promise<number> {
  return import('node:child_process').then(
    ({ spawn }) =>
      new Promise<number>((resolveExit) => {
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('exit', (code) => resolveExit(code ?? 3));
        child.on('error', () => resolveExit(3));
      }),
  );
}
