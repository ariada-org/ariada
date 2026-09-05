// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface SoftrScanOptions {
  targetUrl: string;
  outputDirectory?: string;
  severityThreshold?: Severity;
  cliBin?: string;
  timeoutMs?: number;
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
  page?: string;
}

export interface SoftrScanResult {
  targetUrl: string;
  findings: AriadaFinding[];
  summary: { total: number; blocking: number };
  gate: { threshold: Severity; passed: boolean };
}

export type CommandRunner = (command: ScanCommand) => Promise<number>;

const RANK: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };

/**
 * Refuse anything that is not a web address, with the same message either way.
 *
 * A malformed address and a `file:` one are the same mistake from the caller's
 * side — pointing the scanner somewhere it was not asked to look — so they get
 * the same answer rather than one reading as a bug and the other as a typo.
 *
 * @param targetUrl - the candidate
 */
export function validateTargetUrl(targetUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error(`Softr target must be an http(s) URL: ${targetUrl}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Softr target must be an http(s) URL: ${targetUrl}`);
  }
}

/**
 * The command line for one scan.
 *
 * With no executable named it reaches the scanner through the package runner
 * rather than assuming one is installed.
 *
 * @param options - the page, where to write, and the rest
 * @returns the command and its arguments
 */
export function buildScanCommand(
  options: Required<Pick<SoftrScanOptions, 'targetUrl' | 'outputDirectory'>> &
    Pick<SoftrScanOptions, 'severityThreshold' | 'cliBin' | 'timeoutMs'>,
): ScanCommand {
  validateTargetUrl(options.targetUrl);
  const command = options.cliBin ?? process.env['ARIADA_CLI_BIN'] ?? 'npx';
  const prefix = options.cliBin || process.env['ARIADA_CLI_BIN'] ? [] : ['--yes', '@ariada-org/cli'];
  return {
    command,
    args: [
      ...prefix,
      'scan',
      options.targetUrl,
      '--format',
      'json',
      '--output-dir',
      options.outputDirectory,
      '--severity-threshold',
      options.severityThreshold ?? 'serious',
      '--domains',
      'accessibility',
      ...(options.timeoutMs ? ['--timeout-ms', String(options.timeoutMs)] : []),
    ],
  };
}

/**
 * Turn a report into this integration's result, with its gate.
 *
 * The report may wrap itself in an envelope or not, and may name its findings
 * either of two ways, and may group them by page instead of listing them. All
 * four shapes are read, because reading one is a gate that passes for having
 * looked in the wrong place.
 *
 * @param payload - the report
 * @param targetUrl - the page
 * @param threshold - the severity that fails the gate
 * @returns the result
 */
export function mapAriadaResult(
  payload: unknown,
  targetUrl: string,
  threshold: Severity = 'serious',
): SoftrScanResult {
  const report = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const envelope = (
    report['report'] && typeof report['report'] === 'object' ? report['report'] : report
  ) as Record<string, unknown>;
  const raw = envelope['findings'] ?? envelope['violations'];
  const values = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw).flatMap((entry) => (Array.isArray(entry) ? entry : []))
      : [];
  const findings = values.map((value) => toFinding(value, targetUrl));
  const blocking = findings.filter((finding) => RANK[finding.severity] >= RANK[threshold]).length;
  return {
    targetUrl,
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
export function evaluateGate(result: SoftrScanResult): number {
  return result.gate.passed ? 0 : 1;
}

/**
 * Read whichever report the scanner left behind.
 *
 * Unparseable JSON stops immediately rather than falling through to the next
 * filename: a broken report is not a missing one.
 *
 * @param outputDirectory - where the scanner wrote
 * @param targetUrl - the page
 * @param threshold - the severity that fails the gate
 * @returns the result
 */
export async function readAriadaResult(
  outputDirectory: string,
  targetUrl: string,
  threshold?: Severity,
): Promise<SoftrScanResult> {
  for (const filename of ['scan.json', 'multi-domain-report.json']) {
    try {
      return mapAriadaResult(
        JSON.parse(await readFile(resolve(outputDirectory, filename), 'utf8')),
        targetUrl,
        threshold,
      );
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new Error(`Invalid Ariada JSON: ${resolve(outputDirectory, filename)}`);
    }
  }
  throw new Error(`Ariada output not found in ${resolve(outputDirectory)}`);
}

/**
 * Scan one page and read the result back.
 *
 * A non-zero exit from the scanner is an error here, unlike some of its
 * neighbours: this one asks for a severity threshold, so the scanner exits zero
 * even when it found things below the line.
 *
 * @param options - the page and the settings
 * @param runner - how commands are run
 * @returns the result
 */
export async function scanSoftr(
  options: SoftrScanOptions,
  runner: CommandRunner = runCommand,
): Promise<SoftrScanResult> {
  const outputDirectory = options.outputDirectory ?? 'ariada-output';
  const command = buildScanCommand({
    targetUrl: options.targetUrl,
    outputDirectory,
    severityThreshold: options.severityThreshold,
    cliBin: options.cliBin,
    timeoutMs: options.timeoutMs,
  });
  const exitCode = await runner(command);
  if (exitCode !== 0) throw new Error(`@ariada-org/cli exited with code ${exitCode}`);
  return readAriadaResult(outputDirectory, options.targetUrl, options.severityThreshold);
}

/**
 * One finding, whatever the report called its fields.
 *
 * An unrecognised severity becomes serious, which is this integration's own
 * threshold: unknown blocks rather than passes.
 *
 * @param value - the raw finding
 * @param targetUrl - the page, when the finding names none
 * @returns the finding
 */
function toFinding(value: unknown, targetUrl: string): AriadaFinding {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const severity = row['severity'] ?? row['impact'];
  const normalized = SEVERITIES.includes(severity as Severity) ? (severity as Severity) : 'serious';
  return {
    id: String(row['id'] ?? row['ruleId'] ?? 'ariada/unknown'),
    severity: normalized,
    message: String(row['message'] ?? row['description'] ?? 'Ariada finding'),
    target: String(row['target'] ?? row['selector'] ?? 'document'),
    page:
      typeof row['page'] === 'string'
        ? row['page']
        : typeof row['url'] === 'string'
          ? row['url']
          : targetUrl,
  };
}

/**
 * Run a command, letting its output through to the caller's terminal.
 *
 * @param command - the command and its arguments
 * @returns the exit code, or two when it could not be started
 */
function runCommand({ command, args }: ScanCommand): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => resolveExit(code ?? 2));
    child.on('error', () => resolveExit(2));
  });
}
