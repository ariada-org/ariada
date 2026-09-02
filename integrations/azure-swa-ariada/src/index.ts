// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Read back from the compiled package that was left in this directory when its
// source went missing. The output was plain and unminified and its declarations
// were beside it, so the types below are the ones the original had rather than
// types invented to fit; what could not be recovered is the comments, and those
// are written here fresh.

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const ARIADA_CLI_VERSION = '0.1.0';
export const ARIADA_SCAN_SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';
export const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'] as const;
export const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;
export const MODES = ['gate', 'report'] as const;

/** How bad a finding has to be before it counts. */
export type Severity = (typeof SEVERITIES)[number];
/** Which engine the scan runs in. */
export type Browser = (typeof BROWSERS)[number];
/** Whether a crossed threshold stops the pipeline or is only written down. */
export type IntegrationMode = (typeof MODES)[number];
/** What the run amounted to: nothing found, something found, something found and blocked. */
export type IntegrationStatus = 'passed' | 'reported' | 'blocked';
/** The variables read from the pipeline, none of which we may write to. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** Exactly what will be started, kept whole so it can be asserted on in a test. */
export interface CommandInvocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

/** How the scanner ended: a code, or a signal if it was killed. */
export interface CommandResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Starting the scanner, as a seam — the tests supply their own. */
export type CommandRunner = (invocation: CommandInvocation) => Promise<CommandResult>;

/** Everything a caller may decide; every field has a default that works. */
export interface IntegrationOptions {
  readonly previewUrl?: string;
  readonly buildOutput?: string;
  readonly mode?: IntegrationMode;
  readonly severityThreshold?: Severity;
  readonly browser?: Browser;
  readonly timeoutMs?: number;
  readonly ariadaCommand?: string;
  readonly cwd?: string;
  readonly env?: Environment;
}

/** The two things the outside world provides: how to run, and what time it is. */
export interface IntegrationDependencies {
  readonly runCommand?: CommandRunner;
  readonly now?: () => Date;
}

/** Findings per severity, as the scanner counted them. */
export interface ImpactCounts {
  readonly critical: number;
  readonly serious: number;
  readonly moderate: number;
  readonly minor: number;
}

/** The scanner's answer after it has been checked, so nothing downstream re-checks it. */
export interface AriadaScanEnvelope {
  readonly $schema: typeof ARIADA_SCAN_SCHEMA;
  readonly url: string;
  readonly scanId?: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly summary: { readonly total: number; readonly byImpact: ImpactCounts };
  readonly report: Readonly<Record<string, unknown>>;
  readonly exitCode: 0 | 1;
}

/** The report the pipeline reads, and the record of what produced it. */
export interface IntegrationResult {
  readonly schemaVersion: 1;
  readonly integration: '@ariada-integrations/azure-swa-ariada';
  readonly generatedAt: string;
  readonly previewUrl: string;
  readonly buildOutput: string;
  readonly mode: IntegrationMode;
  readonly severityThreshold: Severity;
  readonly browser: Browser;
  readonly timeoutMs: number;
  readonly status: IntegrationStatus;
  readonly blocked: boolean;
  readonly exitCode: 0 | 1;
  readonly summary: AriadaScanEnvelope['summary'];
  readonly ariada: {
    readonly package: '@ariada-org/cli';
    readonly version: typeof ARIADA_CLI_VERSION;
    readonly exitCode: 0 | 1;
    readonly scanId?: string;
    readonly scanJsonPath: string;
  };
  readonly reportPath: string;
}

/** Every refusal this package makes, carrying a code a pipeline can branch on. */
export class AzureSwaAriadaError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;

  /** The code is what a pipeline branches on; the message is for whoever reads the log. */
  constructor(code: string, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'AzureSwaAriadaError';
    this.code = code;
    this.details = details;
  }
}

function firstNonBlank(values: readonly (string | undefined)[]): string | undefined {
  return values.find((value) => value !== undefined && value.trim().length > 0)?.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertEnum<T extends string>(label: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', `${label} must be one of: ${allowed.join(', ')}`, {
      label,
      value,
    });
  }
  return value as T;
}

/**
 * Where the deployment lives. The hosting service publishes it under three
 * different variable names depending on how the pipeline was wired, so all
 * three are read; a person naming one explicitly beats all of them.
 */
export function resolvePreviewUrl(explicit: string | undefined, env: Environment): string {
  const candidate = firstNonBlank([
    explicit,
    env['SWA_PREVIEW_URL'],
    env['AZURESTATICWEBAPP_STATIC_WEB_APP_URL'],
    env['STATIC_WEB_APP_URL'],
  ]);
  if (candidate === undefined) {
    throw new AzureSwaAriadaError(
      'E_PREVIEW_URL_REQUIRED',
      'No Static Web Apps URL was supplied. Set --preview-url or SWA_PREVIEW_URL.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new AzureSwaAriadaError('E_PREVIEW_URL_INVALID', 'The Static Web Apps URL is invalid.', {
      value: candidate,
    });
  }

  if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.hostname.length === 0) {
    throw new AzureSwaAriadaError('E_PREVIEW_URL_INVALID', 'The Static Web Apps URL must use http or https.', {
      value: candidate,
    });
  }

  // Credentials in the URL would be written into the report and into whatever
  // reads it. Refused rather than stripped, so the person who put them there
  // finds out.
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new AzureSwaAriadaError(
      'E_PREVIEW_URL_INVALID',
      'Credentials must not be embedded in the Static Web Apps URL.',
    );
  }

  return parsed.href;
}

/** Where the reports go: what was asked for, else what the runner offers, else here. */
export function resolveBuildOutput(explicit: string | undefined, env: Environment, cwd: string): string {
  const configured = firstNonBlank([explicit, env['ARIADA_BUILD_OUTPUT']]);
  if (configured !== undefined) {
    if (configured.includes('\0')) {
      throw new AzureSwaAriadaError('E_BUILD_OUTPUT_INVALID', 'The build output path is invalid.');
    }
    return resolve(cwd, configured);
  }

  const azureArtifacts = firstNonBlank([env['BUILD_ARTIFACTSTAGINGDIRECTORY']]);
  if (azureArtifacts !== undefined) return resolve(cwd, azureArtifacts, 'azure-swa-ariada');

  const githubTemp = firstNonBlank([env['RUNNER_TEMP']]);
  if (githubTemp !== undefined) return resolve(cwd, githubTemp, 'azure-swa-ariada');

  return resolve(cwd, 'ariada-output');
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', `Ariada output field ${key} must be a string.`);
  }
  return value;
}

function readNonNegativeNumber(record: Record<string, unknown>, key: string, integer = false): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    throw new AzureSwaAriadaError(
      'E_ARIADA_OUTPUT_INVALID',
      `Ariada output field ${key} must be a non-negative ${integer ? 'integer' : 'number'}.`,
    );
  }
  return value;
}

/**
 * The scanner's answer, read rather than trusted. Everything downstream of this
 * is written into a report a pipeline decides on, so a field that is the wrong
 * shape has to stop here rather than travel as `undefined`.
 */
export function parseAriadaScanJson(raw: string): AriadaScanEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', 'Ariada scan.json is not valid JSON.');
  }
  if (!isRecord(parsed)) {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', 'Ariada scan.json must contain an object.');
  }
  if (parsed['$schema'] !== ARIADA_SCAN_SCHEMA) {
    throw new AzureSwaAriadaError(
      'E_ARIADA_OUTPUT_INVALID',
      `Unsupported Ariada scan schema: ${String(parsed['$schema'])}`,
    );
  }

  const summary = parsed['summary'];
  if (!isRecord(summary) || !isRecord(summary['byImpact'])) {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', 'Ariada summary.byImpact is missing.');
  }
  if (!isRecord(parsed['report'])) {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', 'Ariada report must be an object.');
  }

  const startedAt = readString(parsed, 'startedAt');
  const completedAt = readString(parsed, 'completedAt');
  if (Number.isNaN(Date.parse(startedAt)) || Number.isNaN(Date.parse(completedAt))) {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', 'Ariada timestamps must be ISO date strings.');
  }
  if (parsed['exitCode'] !== 0 && parsed['exitCode'] !== 1) {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', 'Ariada exitCode must be 0 or 1.');
  }
  const scanId = parsed['scanId'];
  if (scanId !== undefined && typeof scanId !== 'string') {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_INVALID', 'Ariada scanId must be a string when present.');
  }

  const byImpact = summary['byImpact'] as Record<string, unknown>;
  return {
    $schema: ARIADA_SCAN_SCHEMA,
    url: readString(parsed, 'url'),
    ...(scanId === undefined ? {} : { scanId }),
    startedAt,
    completedAt,
    durationMs: readNonNegativeNumber(parsed, 'durationMs'),
    summary: {
      total: readNonNegativeNumber(summary, 'total', true),
      byImpact: {
        critical: readNonNegativeNumber(byImpact, 'critical', true),
        serious: readNonNegativeNumber(byImpact, 'serious', true),
        moderate: readNonNegativeNumber(byImpact, 'moderate', true),
        minor: readNonNegativeNumber(byImpact, 'minor', true),
      },
    },
    report: parsed['report'],
    exitCode: parsed['exitCode'],
  };
}

export const spawnCommand: CommandRunner = async (invocation) =>
  new Promise((resolveResult, reject) => {
    // No shell: the URL and the paths come from a pipeline's environment, and a
    // shell would give them a second reading.
    const child = spawn(invocation.command, [...invocation.args], {
      cwd: invocation.cwd,
      env: invocation.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.once('error', (error: Error) => {
      reject(
        new AzureSwaAriadaError('E_ARIADA_START', `Unable to start Ariada CLI: ${error.message}`, {
          command: invocation.command,
        }),
      );
    });

    child.once('close', (exitCode, signal) => {
      resolveResult({ exitCode, signal, stdout, stderr });
    });
  });

function urlsMatch(left: string, right: string): boolean {
  try {
    return new URL(left).href === new URL(right).href;
  } catch {
    return false;
  }
}

function boundedText(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 4000 ? trimmed : `${trimmed.slice(0, 4000)}...`;
}

/**
 * Scan a deployment and write the report the pipeline reads.
 *
 * Two agreements are checked afterwards rather than assumed: that the scanner
 * looked at the address it was given, and that the process and the file it
 * wrote say the same thing about how it ended. Either one disagreeing means the
 * report on disk is about a different run than the one that just happened, and
 * a gate deciding on that is worse than a gate that refuses.
 */
export async function runAzureSwaAriada(
  options: IntegrationOptions = {},
  dependencies: IntegrationDependencies = {},
): Promise<IntegrationResult> {
  const env = { ...process.env, ...options.env };
  const cwd = resolve(options.cwd ?? process.cwd());
  const previewUrl = resolvePreviewUrl(options.previewUrl, env);
  const buildOutput = resolveBuildOutput(options.buildOutput, env, cwd);
  const mode = assertEnum('mode', options.mode ?? 'report', MODES);
  const severityThreshold = assertEnum('severityThreshold', options.severityThreshold ?? 'moderate', SEVERITIES);
  const browser = assertEnum('browser', options.browser ?? 'chromium', BROWSERS);

  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', 'timeoutMs must be a positive integer.');
  }

  const ariadaCommand = firstNonBlank([options.ariadaCommand, env['ARIADA_CLI_COMMAND']]) ?? 'ariada';
  if (ariadaCommand.includes('\0')) {
    throw new AzureSwaAriadaError('E_CONFIG_INVALID', 'ariadaCommand is invalid.');
  }

  const scannerOutput = join(buildOutput, 'ariada');
  const scanJsonPath = join(scannerOutput, 'scan.json');
  const reportPath = join(buildOutput, 'azure-swa-ariada-report.json');
  await mkdir(scannerOutput, { recursive: true });

  const invocation: CommandInvocation = {
    command: ariadaCommand,
    args: [
      'scan',
      previewUrl,
      '--browser',
      browser,
      '--severity-threshold',
      severityThreshold,
      '--timeout-ms',
      String(timeoutMs),
      '--format',
      'json',
      '--output-dir',
      scannerOutput,
    ],
    cwd,
    env,
  };

  const commandResult = await (dependencies.runCommand ?? spawnCommand)(invocation);

  // Zero means clean, one means the threshold was crossed. Anything else — a
  // signal, a crash — is not a verdict.
  if (commandResult.signal !== null || (commandResult.exitCode !== 0 && commandResult.exitCode !== 1)) {
    throw new AzureSwaAriadaError('E_ARIADA_PROCESS', 'Ariada CLI did not complete a valid scan.', {
      exitCode: commandResult.exitCode,
      signal: commandResult.signal,
      stderr: boundedText(commandResult.stderr),
    });
  }

  let rawScan: string;
  try {
    rawScan = await readFile(scanJsonPath, 'utf8');
  } catch (error) {
    throw new AzureSwaAriadaError('E_ARIADA_OUTPUT_MISSING', 'Ariada did not produce scan.json.', {
      path: scanJsonPath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  const scan = parseAriadaScanJson(rawScan);

  if (!urlsMatch(scan.url, previewUrl)) {
    throw new AzureSwaAriadaError(
      'E_ARIADA_URL_MISMATCH',
      'Ariada output URL does not match the requested Static Web Apps URL.',
      { expected: previewUrl, actual: scan.url },
    );
  }
  if (scan.exitCode !== commandResult.exitCode) {
    throw new AzureSwaAriadaError(
      'E_ARIADA_EXIT_MISMATCH',
      'Ariada process and scan.json exit codes do not match.',
      { process: commandResult.exitCode, output: scan.exitCode },
    );
  }

  const hasThresholdViolations = scan.exitCode === 1;
  const blocked = mode === 'gate' && hasThresholdViolations;
  const status: IntegrationStatus = blocked ? 'blocked' : hasThresholdViolations ? 'reported' : 'passed';

  const result: IntegrationResult = {
    schemaVersion: 1,
    integration: '@ariada-integrations/azure-swa-ariada',
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    previewUrl,
    buildOutput,
    mode,
    severityThreshold,
    browser,
    timeoutMs,
    status,
    blocked,
    exitCode: blocked ? 1 : 0,
    summary: scan.summary,
    ariada: {
      package: '@ariada-org/cli',
      version: ARIADA_CLI_VERSION,
      exitCode: scan.exitCode,
      ...(scan.scanId === undefined ? {} : { scanId: scan.scanId }),
      scanJsonPath,
    },
    reportPath,
  };

  await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}
