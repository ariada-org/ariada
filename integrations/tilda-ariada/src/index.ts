// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const TILDA_SOURCE = 'tilda.published-page';
export const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface TildaConfig {
  url: string;
  outputDir?: string;
  severityThreshold?: Severity;
  timeoutMs?: number;
  browser?: 'chromium' | 'firefox' | 'webkit';
}

export interface TildaFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  selector?: string;
}

export interface TildaResult {
  source: typeof TILDA_SOURCE;
  boundary: 'published-page';
  renderedPage: true;
  url: string;
  scanId?: string;
  findings: TildaFinding[];
  summary: {
    total: number;
    counts: Record<Severity, number>;
    worstSeverity?: Severity;
  };
  gate: 'pass' | 'fail';
  cliExitCode?: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (binary: string, args: string[]) => Promise<CommandResult>;

const severityRank: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

/**
 * Whether the value is a published web address.
 *
 * @param value - the candidate
 * @returns true when it is http(s) and names a host
 */
function isPublishedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/**
 * A severity this integration knows, defaulting to the middle.
 *
 * @param value - whatever the report said
 * @returns a known severity
 */
function asSeverity(value: unknown): Severity {
  return SEVERITIES.includes(value as Severity) ? (value as Severity) : 'moderate';
}

/**
 * The findings, whether the report grouped them or listed them, and under
 * whichever of the two keys it used.
 *
 * @param input - the report
 * @returns the findings
 */
function findingsFromReport(input: {
  report?: { findings?: unknown };
  findings?: unknown;
}): TildaFinding[] {
  const raw = input?.report?.findings ?? input?.findings ?? [];
  const values = (
    Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown[]>).flat()
  ) as Array<Record<string, unknown>>;
  return values.map((finding) => ({
    ruleId: String(finding.ruleId ?? finding.id ?? 'unknown'),
    severity: asSeverity(finding.severity ?? finding.impact),
    message: String(finding.message ?? 'Accessibility finding'),
    ...(finding.selector || finding.target
      ? { selector: String(finding.selector ?? finding.target) }
      : {}),
  }));
}

/**
 * The command line for one scan.
 *
 * The page is rendered in a real browser, because a page from this builder is
 * assembled by script: reading the delivered markup would describe a document
 * nobody sees.
 *
 * @param config - the page and the settings
 * @returns the arguments
 */
export function buildTildaCliArgs(config: TildaConfig): string[] {
  if (!isPublishedUrl(config.url))
    throw new Error(`Tilda URL must be a published http(s) URL: ${config.url}`);
  const threshold = config.severityThreshold ?? 'serious';
  if (!SEVERITIES.includes(threshold)) throw new Error(`Unsupported severity threshold: ${threshold}`);
  const args = [
    'scan',
    config.url,
    '--domains',
    'accessibility',
    '--browser',
    config.browser ?? 'chromium',
    '--format',
    'json',
    '--severity-threshold',
    threshold,
    '--timeout-ms',
    String(config.timeoutMs ?? 30000),
  ];
  if (config.outputDir) args.push('--output-dir', config.outputDir);
  return args;
}

/**
 * Turn a scanner report into this integration's result, with its gate.
 *
 * Every severity gets a count, including the zeroes: a report that lists only
 * what occurred cannot be told apart from one that failed to look.
 *
 * @param input - the report
 * @param config - the page and the settings
 * @returns the result
 */
export function mapAriadaResult(input: unknown, config: TildaConfig): TildaResult {
  // Приведения, а не локальная переменная: приведение стирается при сборке, и
  // `(input as X)?.scanId` даёт ровно `input?.scanId`. Локальная переменная
  // добавляла объявление и меняла имя в девяти местах — сверка назвала все
  // девять.
  type Payload = {
    scanId?: string;
    exitCode?: number;
    report?: { scanId?: string; findings?: unknown };
    findings?: unknown;
  };
  const findings = findingsFromReport(input as Payload);
  const threshold = config.severityThreshold ?? 'serious';
  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])) as Record<
    Severity,
    number
  >;
  for (const finding of findings) counts[finding.severity] += 1;
  const worstSeverity = [...SEVERITIES].reverse().find((severity) => counts[severity] > 0);
  return {
    source: TILDA_SOURCE,
    boundary: 'published-page',
    renderedPage: true,
    url: config.url,
    // Без внешних скобок вокруг условия: приведение стирается, и лишняя пара
    // скобок оставалась в собранном модуле там, где её не было.
    ...(input as Payload)?.scanId || (input as Payload)?.report?.scanId
      ? { scanId: ((input as Payload).scanId ?? (input as Payload).report!.scanId) as string }
      : {},
    findings,
    summary: { total: findings.length, counts, ...(worstSeverity ? { worstSeverity } : {}) },
    gate: findings.some((finding) => severityRank[finding.severity] >= severityRank[threshold])
      ? 'fail'
      : 'pass',
    ...((input as Payload)?.exitCode !== undefined
      ? { cliExitCode: (input as Payload).exitCode }
      : {}),
  };
}

/**
 * Run one scan.
 *
 * Output that is not JSON is an error naming what came back instead, rather
 * than an empty result: a scan that could not be read is not a scan that found
 * nothing.
 *
 * @param config - the page and the settings
 * @param runner - how commands are run
 * @returns the result
 */
export async function runTildaScan(
  config: TildaConfig,
  runner: CommandRunner = defaultRunner,
): Promise<TildaResult> {
  const result = await runner(process.env['ARIADA_BIN'] ?? 'ariada', buildTildaCliArgs(config));
  let payload: unknown;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Ariada CLI did not return JSON: ${result.stderr || result.stdout}`);
  }
  return mapAriadaResult(payload, config);
}

/**
 * Run a command and collect its output.
 *
 * The buffer is ten megabytes because a full report of a long page is larger
 * than the default, and a truncated report parses as broken JSON — which reads
 * as a broken scanner rather than a small buffer.
 *
 * @param binary - the executable
 * @param args - its arguments
 * @returns what it wrote
 */
async function defaultRunner(binary: string, args: string[]): Promise<CommandResult> {
  const result = await execFileAsync(binary, args, { maxBuffer: 10 * 1024 * 1024 });
  return { stdout: result.stdout, stderr: result.stderr };
}
