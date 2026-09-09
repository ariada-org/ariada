// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/scan-adapter.js` and its declaration. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones.
//
// This file is released from that comparison, and is no longer held by the
// comparison with that module. It was,
// and that guarantee is a strong and brittle one: it fixes the source in the
// shape a compiler left it, and the report reader came out of that compiler flat
// enough to fail the complexity limit standing on publication. While the
// comparison was the only support, this package could not travel at all.
//
// So it was released from the comparison, in the one moment that release can
// honestly be made: the behavioural checks in
// `tests/scripts/recovered-testcafe-scan-adapter.test.ts` were written while the
// comparison still held, so they describe the module that ships rather than
// anybody's account of it, and only then was the shape changed. Those nineteen
// checks are the guarantee now. The release is recorded in
// `tests/scripts/vypushchennye-iz-slicheniya.txt`; running
// `bash scripts/sverit-vosstanovlennoe.sh` on this package will report a
// divergence, and that is expected rather than a defect.

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface AriadaFinding {
  ruleId: string;
  severity: string;
  message: string;
  domain: string;
}

export interface ScanResult {
  report: unknown;
  findings: AriadaFinding[];
  policyFailed: boolean;
}

export interface CommandResult {
  exitCode: number;
  stderr: string;
}

export interface ScanDependencies {
  run(command: string, args: string[]): Promise<CommandResult>;
  makeTempDir(): Promise<string>;
  readReport(path: string): Promise<string>;
  removeTempDir(path: string): Promise<void>;
}

const defaults: ScanDependencies = {
  run: (command, args) =>
    new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', reject);
      child.on('close', (code) => resolve({ exitCode: code ?? 5, stderr }));
    }),
  makeTempDir: () => mkdtemp(join(tmpdir(), 'ariada-testcafe-')),
  readReport: (path) => readFile(path, 'utf8'),
  removeTempDir: (path) => rm(path, { recursive: true, force: true }),
};

/**
 * One finding, with a name for every field that has none.
 *
 * `unknown-rule` and `unknown` are placed rather than dropped: this runs inside
 * somebody's test suite, and a finding that vanishes because a field was
 * missing is a test that passes for the wrong reason.
 *
 * @param value - the raw finding
 * @param domain - which domain it came from
 * @returns the finding
 */
function finding(value: unknown, domain: string): AriadaFinding {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    ruleId: typeof item['ruleId'] === 'string' ? item['ruleId'] : 'unknown-rule',
    severity: typeof item['severity'] === 'string' ? item['severity'] : 'unknown',
    message: typeof item['message'] === 'string' ? item['message'] : '',
    domain,
  };
}

/**
 * Read a report in any of the three shapes the scanner writes.
 *
 * A list of findings, the same key as an object grouped by domain, or a grid
 * keyed by page and then by domain. A report matching none of them is an error
 * rather than an empty result — a test that cannot read its report has not
 * passed.
 *
 * @param raw - the report as written
 * @returns the report and its findings
 */
/** An object with named members, as opposed to a list or a null. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Findings from the canonical shape, or null when the report is not in it.
 *
 * The canonical block carries either a flat list — accessibility, because that
 * is what a report with one domain used to be — or one list per domain.
 */
function canonicalFindings(report: Record<string, unknown>): AriadaFinding[] | null {
  const canonical = report['report'];
  if (!isRecord(canonical)) return null;
  const values = canonical['findings'];
  if (Array.isArray(values)) return values.map((item) => finding(item, 'a11y'));
  if (isRecord(values)) {
    return Object.entries(values).flatMap(([domain, items]) =>
      Array.isArray(items) ? items.map((item) => finding(item, domain)) : [],
    );
  }
  return null;
}

/** Findings from the grid shape: page, then domain, then the list. */
function gridFindings(grid: unknown): AriadaFinding[] {
  const findings: AriadaFinding[] = [];
  if (!isRecord(grid)) return findings;
  for (const domains of Object.values(grid)) {
    if (!isRecord(domains)) continue;
    for (const [domain, values] of Object.entries(domains)) {
      if (Array.isArray(values)) findings.push(...values.map((item) => finding(item, domain)));
    }
  }
  return findings;
}

function parseReport(raw: string): { report: unknown; findings: AriadaFinding[] } {
  const report = JSON.parse(raw) as Record<string, unknown>;
  if (!isRecord(report)) {
    throw new Error('Ariada report is not an object.');
  }
  const canonical = canonicalFindings(report);
  if (canonical) return { report, findings: canonical };
  if (!isRecord(report['grid'])) {
    throw new Error('Ariada report has no canonical findings or grid.');
  }
  return { report, findings: gridFindings(report['grid']) };
}

/**
 * A scanner with every side effect handed in.
 *
 * Running a process, making a temporary directory, reading a file and removing
 * it are all injectable, which is what lets this be tested without a browser or
 * a filesystem. The temporary directory is removed in a `finally` either way.
 *
 * @param dependencies - overrides for any of the four
 * @returns a scanner
 */
export function createScanAdapter(
  dependencies: Partial<ScanDependencies> = {},
): (url: string, binary?: string) => Promise<ScanResult> {
  const deps = { ...defaults, ...dependencies };
  return async function scan(url: string, binary = 'ariada'): Promise<ScanResult> {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('TestCafe page URL must be http/https.');
    }
    const outputDir = await deps.makeTempDir();
    try {
      const result = await deps.run(binary, [
        'scan',
        parsed.href,
        '--format',
        'json',
        '--output-dir',
        outputDir,
      ]);
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        throw new Error(`Ariada CLI failed with exit ${result.exitCode}: ${result.stderr}`);
      }
      let raw: string;
      try {
        raw = await deps.readReport(join(outputDir, 'scan.json'));
      } catch {
        try {
          raw = await deps.readReport(join(outputDir, 'multi-domain-report.json'));
        } catch {
          throw new Error('Ariada CLI completed without scan.json.');
        }
      }
      const parsedReport = parseReport(raw);
      return {
        ...parsedReport,
        policyFailed: result.exitCode === 1 || parsedReport.findings.length > 0,
      };
    } finally {
      await deps.removeTempDir(outputDir);
    }
  };
}

export const scanWithAriada = createScanAdapter();
