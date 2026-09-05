// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/adapter.js` and `dist/adapter.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface GlidePublishedBoundary {
  appName: string;
  pageName: string;
  publishedUrl: string;
}

export interface GlideScanConfig {
  targetUrl: string;
  reportDir: string;
  severityThreshold: Severity;
  timeoutMs: number;
  cli?: string;
}

export interface AriadaFinding {
  id: string;
  ruleId: string;
  severity: Severity;
  message: string;
  selector?: string;
}

export interface GlideScanResult {
  boundary: GlidePublishedBoundary;
  url: string;
  findings: AriadaFinding[];
  counts: Record<Severity, number>;
  threshold: Severity;
  failed: boolean;
  cliExitCode: number;
}

export interface Invocation {
  command: string;
  args: string[];
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * The command line for one scan, with everything checked first.
 *
 * The timeout must be a positive integer rather than merely a number: a zero or
 * a fraction reaches the scanner as a flag it will not understand, and the
 * failure then reads as a broken scanner instead of a bad setting.
 *
 * @param config - the page, where to write, the threshold and the timeout
 * @returns the command and its arguments
 */
export function buildAriadaInvocation(config: GlideScanConfig): Invocation {
  assertHttpUrl(config.targetUrl);
  assertSeverity(config.severityThreshold);
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive integer.');
  }
  const cli = config.cli ?? process.env['ARIADA_CLI'] ?? 'npx';
  const args = cli === 'npx' ? ['--yes', '@ariada-org/cli'] : [];
  args.push(
    'scan',
    config.targetUrl,
    '--browser',
    'chromium',
    '--format',
    'json',
    '--output-dir',
    config.reportDir,
    '--severity-threshold',
    config.severityThreshold,
    '--timeout-ms',
    String(config.timeoutMs),
  );
  return { command: cli, args };
}

/**
 * Read a report into findings and counts, with the gate decided.
 *
 * Every severity is counted including the zeroes, so a summary that lists only
 * what occurred cannot be mistaken for one that failed to look.
 *
 * @param value - the report
 * @param threshold - the severity that fails the gate
 * @returns findings, counts and the verdict
 */
export function mapAriadaResult(
  value: unknown,
  threshold: Severity,
): Omit<GlideScanResult, 'boundary' | 'url' | 'cliExitCode'> {
  assertSeverity(threshold);
  const envelope = record(value);
  const report = record(envelope['report']);
  const rawFindings = report['findings'] ?? envelope['findings'];
  if (!Array.isArray(rawFindings)) throw new Error('Ariada report must contain report.findings.');
  const findings = rawFindings.map((item, index) => mapFinding(item, index));
  const counts: Record<Severity, number> = { minor: 0, moderate: 0, serious: 0, critical: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  const rank: Record<Severity, number> = { minor: 1, moderate: 2, serious: 3, critical: 4 };
  return {
    findings,
    counts,
    threshold,
    failed: findings.some((finding) => rank[finding.severity] >= rank[threshold]),
  };
}

export type CommandRunner = (invocation: Invocation) => Promise<CommandResult>;

/**
 * Scan one published application page.
 *
 * The report is read from the file the scanner wrote, not from what it printed,
 * and a missing file is an error carrying the exit code — so "the scan produced
 * nothing" and "the scan failed" arrive as one sentence rather than two guesses.
 *
 * @param boundary - which application and page this is
 * @param config - where to write, the threshold, the timeout
 * @param run - how commands are run
 * @returns the result
 */
export async function scanGlidePublishedApp(
  boundary: GlidePublishedBoundary,
  config: Omit<GlideScanConfig, 'targetUrl'>,
  run: CommandRunner = runCommand,
): Promise<GlideScanResult> {
  const appName = requireText(boundary.appName, 'appName');
  const pageName = requireText(boundary.pageName, 'pageName');
  const publishedUrl = requireText(boundary.publishedUrl, 'publishedUrl');
  const fullConfig = { ...config, targetUrl: publishedUrl };
  const invocation = buildAriadaInvocation(fullConfig);
  await mkdir(fullConfig.reportDir, { recursive: true });
  const commandResult = await run(invocation);
  let payload: unknown;
  try {
    payload = JSON.parse(await readFile(`${fullConfig.reportDir}/scan.json`, 'utf8'));
  } catch {
    throw new Error(
      `Ariada did not produce ${fullConfig.reportDir}/scan.json (exit ${commandResult.code}).`,
    );
  }
  return {
    boundary: { appName, pageName, publishedUrl },
    url: publishedUrl,
    ...mapAriadaResult(payload, fullConfig.severityThreshold),
    cliExitCode: commandResult.code,
  };
}

/**
 * Run a command, telling apart a failed run from one that never started.
 *
 * A process that ran and exited non-zero comes back as a result; a process that
 * could not be started at all throws. Those are different problems — one is the
 * scan, the other is the machine — and collapsing them sends whoever reads the
 * error to the wrong place.
 *
 * @param invocation - the command and its arguments
 * @returns the exit code and output
 */
async function runCommand(invocation: Invocation): Promise<CommandResult> {
  try {
    const result = await execFileAsync(invocation.command, invocation.args, {
      maxBuffer: 20 * 1024 * 1024,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as { code?: unknown; stdout?: string; stderr?: string; message?: string };
    if (failure.stdout !== undefined || failure.stderr !== undefined) {
      return {
        code: typeof failure.code === 'number' ? failure.code : 1,
        stdout: failure.stdout ?? '',
        stderr: failure.stderr ?? '',
      };
    }
    throw new Error(`Could not start Ariada CLI: ${failure.message ?? String(error)}`);
  }
}

/**
 * One finding, refusing any whose severity is unrecognised.
 *
 * @param value - the raw finding
 * @param index - its position, for the message
 * @returns the finding
 */
function mapFinding(value: unknown, index: number): AriadaFinding {
  const item = record(value);
  const severity = item['severity'];
  assertSeverity(severity, `finding ${index}`);
  return {
    id: String(item['id'] ?? item['ruleId'] ?? `finding-${index + 1}`),
    ruleId: String(item['ruleId'] ?? item['id'] ?? 'ariada/unknown'),
    severity,
    message: String(
      item['message'] ?? item['description'] ?? 'Ariada reported an accessibility finding.',
    ),
    ...(typeof item['selector'] === 'string' ? { selector: item['selector'] } : {}),
  };
}

/**
 * The value as an object, or an error.
 *
 * @param value - the candidate
 * @returns the object
 */
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Ariada result must be an object.');
  return value as Record<string, unknown>;
}

/**
 * Refuse anything that is not a web address.
 *
 * @param value - the candidate
 */
function assertHttpUrl(value: string): void {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`Glide publishedUrl must be an http(s) URL: ${value}`);
  }
}

/**
 * Refuse a severity this integration does not know.
 *
 * @param value - the candidate
 * @param subject - what to call it in the message
 */
// Утверждающая сигнатура, а не просто проверка: она СУЖАЕТ тип у вызывающего,
// и потому ниже можно писать сокращённо `severity,`. С обычным `void`
// пришлось бы писать `severity: severity as Severity` — тот же смысл и другой
// собранный модуль; сверка это и назвала.
function assertSeverity(value: unknown, subject = 'severity'): asserts value is Severity {
  if (!['minor', 'moderate', 'serious', 'critical'].includes(String(value)))
    throw new Error(`Unsupported ${subject}: ${String(value)}`);
}

/**
 * The value if it has content, or an error naming the field.
 *
 * @param value - the candidate
 * @param name - the field
 * @returns the value
 */
function requireText(value: string, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Glide boundary requires ${name}.`);
  return value;
}
