// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const DEFAULT_THRESHOLD = 'serious';

const RANK = { minor: 1, moderate: 2, serious: 3, critical: 4 } as const;

export type Severity = keyof typeof RANK;

export interface ScanCommand {
  command: string;
  args: string[];
}

export interface DorikFinding {
  id: string;
  severity: Severity;
  message: string;
  target: string;
  page?: string;
}

export interface DorikScanResult {
  source: 'dorik-published-site';
  publishedUrl: string;
  findings: DorikFinding[];
  summary: { total: number; blocking: number };
  gate: { threshold: Severity; passed: boolean };
}

export type CommandRunner = (command: ScanCommand) => Promise<number>;

/**
 * The address as a web address, or an error.
 *
 * @param value - the candidate
 * @returns the normalised address
 */
export function validatePublishedUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Dorik published URL must use http(s)');
  return url.href;
}

/**
 * The command line for one scan.
 *
 * With no executable named, it reaches the scanner through the package runner
 * rather than assuming one is installed — which is what makes this usable from
 * a site builder's own pipeline, where nothing was installed on purpose.
 *
 * @param options - the page, where to write, the executable and the threshold
 * @returns the command and its arguments
 */
export function buildScanCommand(options: {
  publishedUrl: string;
  outputDirectory: string;
  cliBin?: string;
  threshold?: Severity;
}): ScanCommand {
  const publishedUrl = validatePublishedUrl(options.publishedUrl);
  const command = options.cliBin ?? process.env['ARIADA_CLI_BIN'] ?? 'npx';
  const prefix =
    options.cliBin || process.env['ARIADA_CLI_BIN'] ? [] : ['--yes', '@ariada-org/cli'];
  return {
    command,
    args: [
      ...prefix,
      'scan',
      publishedUrl,
      '--format',
      'json',
      '--output-dir',
      options.outputDirectory,
      '--severity-threshold',
      options.threshold ?? DEFAULT_THRESHOLD,
      '--domains',
      'accessibility',
    ],
  };
}

/**
 * Run one scan.
 *
 * @param options - the page and the rest
 * @param runner - how commands are run
 * @returns the scanner's exit code
 */
export async function scanPublishedSite(
  options: {
    publishedUrl: string;
    outputDirectory?: string;
    cliBin?: string;
    threshold?: Severity;
  },
  runner: CommandRunner = runCommand,
): Promise<number> {
  return runner(
    buildScanCommand({
      publishedUrl: options.publishedUrl,
      outputDirectory: options.outputDirectory ?? 'ariada-output',
      ...(options.cliBin ? { cliBin: options.cliBin } : {}),
      ...(options.threshold ? { threshold: options.threshold } : {}),
    }),
  );
}

/**
 * Read whichever report the scanner left behind.
 *
 * Two names are tried because the scanner writes one or the other depending on
 * how it was asked. Unparseable JSON stops immediately — that is a broken
 * report, not a missing one, and continuing would report "not found" for a file
 * that is right there.
 *
 * @param outputDirectory - where the scanner wrote
 * @param publishedUrl - the page that was scanned
 * @param threshold - the severity that fails the gate
 * @returns the mapped result
 */
export async function readAriadaResult(
  outputDirectory: string,
  publishedUrl: string,
  threshold: Severity = DEFAULT_THRESHOLD,
): Promise<DorikScanResult> {
  for (const filename of ['multi-domain-report.json', 'scan.json']) {
    try {
      return mapAriadaResult(
        JSON.parse(await readFile(resolve(outputDirectory, filename), 'utf8')),
        publishedUrl,
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
 * Turn a report into this integration's result, with its gate.
 *
 * Findings are looked for in three places, because the report's shape depends
 * on which way the scanner was invoked. Reading one and returning nothing for
 * the others would be a gate that passes because it looked in the wrong place.
 *
 * @param payload - the report
 * @param publishedUrl - the page
 * @param threshold - the severity that fails the gate
 * @returns the result
 */
export function mapAriadaResult(
  payload: unknown,
  publishedUrl: string,
  threshold: Severity = DEFAULT_THRESHOLD,
): DorikScanResult {
  const report = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const raw = Array.isArray(report['findings'])
    ? report['findings']
    : Array.isArray(report['violations'])
      ? report['violations']
      : collectGridFindings(report['grid']);
  const findings = raw.map((item) => toFinding(item, publishedUrl));
  const blocking = findings.filter((finding) => RANK[finding.severity] >= RANK[threshold]).length;
  return {
    source: 'dorik-published-site',
    publishedUrl: validatePublishedUrl(publishedUrl),
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
export function evaluateGate(result: DorikScanResult): number {
  return result.gate.passed ? 0 : 1;
}

/**
 * Findings out of a per-site, per-domain grid.
 *
 * @param value - the grid
 * @returns every finding in it
 */
function collectGridFindings(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap((site) =>
    site && typeof site === 'object'
      ? Object.values(site).flatMap((domain) => (Array.isArray(domain) ? domain : []))
      : [],
  );
}

/**
 * One finding, whatever the report called its fields.
 *
 * An unrecognised severity becomes serious, which is this integration's
 * threshold: an unknown severity is treated as blocking rather than waved
 * through, because a site builder's user will not be reading the raw report.
 *
 * @param value - the raw finding
 * @param page - the page, when the finding names none
 * @returns the finding
 */
function toFinding(value: unknown, page: string): DorikFinding {
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
    page: String(row['page'] ?? row['url'] ?? page),
  };
}

/**
 * Run a command, letting its output through to the caller's terminal.
 *
 * @param command - the command and its arguments
 * @returns the exit code, or three when it could not be started
 */
function runCommand({ command, args }: ScanCommand): Promise<number> {
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => done(code ?? 3));
    child.on('error', () => done(3));
  });
}
