// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';
export type GateStatus = 'passed' | 'failed';

export interface CarrdFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  selector?: string;
}

export interface AriadaCliResult {
  $schema?: string;
  url: string;
  scanId?: string;
  summary?: { total?: number; byImpact?: Partial<Record<Severity, number>> };
  report?: {
    findings?: Record<string, Array<Record<string, unknown>>> | Array<Record<string, unknown>>;
  };
  exitCode?: number;
}

export interface CarrdScan {
  platform: 'carrd';
  boundary: 'published-site/page';
  url: string;
  result: AriadaCliResult;
  findings: CarrdFinding[];
  gate: {
    status: GateStatus;
    threshold: Severity;
    blockingFindings: number;
    exitCode: 0 | 1;
  };
}

export interface ScanOptions {
  threshold?: Severity;
  cliCommand?: string;
  runner?: CliRunner;
}

export type CliRunner = (
  command: string,
  args: string[],
) => Promise<{ code: number; stdout: string; stderr: string }>;

const SEVERITY_RANK: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

/**
 * The command line for one scan.
 *
 * @param url - the published page
 * @param outputDir - where the scanner should write
 * @param threshold - the severity that fails the gate
 * @returns the arguments
 */
export function buildCliArgs(url: string, outputDir: string, threshold: Severity = 'moderate'): string[] {
  assertPublishedUrl(url);
  return [
    'scan',
    url,
    '--format',
    'json',
    '--output-dir',
    outputDir,
    '--severity-threshold',
    threshold,
  ];
}

/**
 * Turn a scanner result into the shape this integration reports, with its gate.
 *
 * The gate counts only findings at or above the threshold. Everything found is
 * still carried, so lowering the threshold later needs no rescan — and so that
 * a passing gate does not read as an empty page.
 *
 * @param result - the scanner's output
 * @param threshold - the severity that fails the gate
 * @returns the scan
 */
export function mapAriadaResult(result: AriadaCliResult, threshold: Severity = 'moderate'): CarrdScan {
  const findings = flattenFindings(result);
  const blockingFindings = findings.filter(
    (finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK[threshold],
  ).length;
  return {
    platform: 'carrd',
    boundary: 'published-site/page',
    url: result.url,
    result,
    findings,
    gate: {
      status: blockingFindings === 0 ? 'passed' : 'failed',
      threshold,
      blockingFindings,
      exitCode: blockingFindings === 0 ? 0 : 1,
    },
  };
}

/**
 * Scan one published page.
 *
 * Exit code one is a scan that found something, not a scan that failed, so both
 * zero and one are read as an answer and anything else is an error. The
 * temporary directory is removed whichever way it ends.
 *
 * @param url - the published page
 * @param options - the threshold, the executable, and how to run it
 * @returns the scan
 */
export async function scanCarrdSite(url: string, options: ScanOptions = {}): Promise<CarrdScan> {
  const threshold = options.threshold ?? 'moderate';
  const outputDir = await mkdtemp(join(tmpdir(), 'carrd-ariada-'));
  try {
    const args = buildCliArgs(url, outputDir, threshold);
    const run = options.runner ?? runProcess;
    const execution = await run(options.cliCommand ?? 'ariada', args);
    if (execution.code !== 0 && execution.code !== 1) {
      throw new Error(
        `Ariada CLI failed with exit code ${execution.code}: ${execution.stderr || execution.stdout}`,
      );
    }
    const result = JSON.parse(
      await readFile(join(outputDir, 'scan.json'), 'utf8'),
    ) as AriadaCliResult;
    return mapAriadaResult(result, threshold);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
}

/**
 * The findings, whether the report grouped them or listed them.
 *
 * @param result - the scanner's output
 * @returns the findings
 */
function flattenFindings(result: AriadaCliResult): CarrdFinding[] {
  const raw = result.report?.findings;
  const values = Array.isArray(raw) ? raw : Object.values(raw ?? {}).flat();
  return values.map((finding) => ({
    ruleId: String(finding['ruleId'] ?? 'unknown'),
    severity: normalizeSeverity(finding['severity']),
    message: String(finding['message'] ?? ''),
    ...(finding['selector'] ? { selector: String(finding['selector']) } : {}),
  }));
}

/**
 * A severity this integration knows, defaulting to the middle.
 *
 * An unknown severity becomes moderate rather than the highest or the lowest:
 * treating it as critical would fail gates on a word nobody recognises, and
 * treating it as minor would hide it.
 *
 * @param value - whatever the report said
 * @returns a known severity
 */
function normalizeSeverity(value: unknown): Severity {
  return value === 'minor' || value === 'moderate' || value === 'serious' || value === 'critical'
    ? value
    : 'moderate';
}

/**
 * Refuse anything that is not a web address.
 *
 * @param value - the candidate
 */
function assertPublishedUrl(value: string): void {
  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new Error('Carrd scan expects an http(s) published URL');
}

/**
 * Run a command and collect what it said.
 *
 * @param command - the executable
 * @param args - its arguments
 * @returns exit code and output
 */
function runProcess(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 2, stdout, stderr }));
  });
}
