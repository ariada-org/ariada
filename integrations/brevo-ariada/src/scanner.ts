// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/scanner.js` and `dist/scanner.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// THIS MODULE TRUSTS THE SCANNER NO FURTHER THAN IT CAN CHECK IT. The scanner
// runs as a separate process, and everything it says on the way back is read as
// a claim rather than as a fact: the exit code it wrote into its artifact must
// agree with the exit code the operating system reported, and the address in the
// artifact must be the address that was asked for. A scanner that answered about
// a different page, or that finished with a code its own report contradicts, is
// refused here rather than half-believed downstream.
//
// THE COMPATIBILITY FALLBACK IS NARROW ON PURPOSE. Older releases of the command
// line tool exported the scanner from the package root instead of a subpath, so
// a load failure retries the root — but only when the failure is one of the two
// module-resolution codes AND its message names the subpath. Any other failure
// is rethrown. A broad `catch` here would turn a broken installation into a
// silent second attempt against a package that may not be the one intended.
//
// THE ONE TARGET THAT GETS A PRIVATE SCANNER is the campaign page this
// integration renders for itself: loopback, plain http, no credentials, and that
// exact path. Everything else goes through the ordinary scan, which refuses
// private addresses. The check is written as an exhaustive comparison rather
// than a prefix match, because a prefix match on a loopback address is how a
// caller reaches every other service on the machine.

import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCliScan, type CliScanEnvelope, type Severity } from './cli-scan.js';
import {
  spawnProcess,
  type ProcessRequest,
  type ProcessResult,
  type ProcessRunner,
} from './process.js';

export const SCANNER_MODULE_ID = '@ariada-org/cli/scanner';
export const SCANNER_COMPAT_MODULE_ID = '@ariada-org/cli';
export const CORE_SCANNER_MODULE_ID = '@ariada-org/core-playwright';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

interface ScannerOptions {
  readonly outputDir?: string;
  readonly browser?: BrowserName;
  readonly format?: 'human' | 'json' | 'both';
  readonly severityThreshold?: Severity;
  readonly timeoutMs?: number;
}

type RunScan = (
  url: string | undefined,
  options: ScannerOptions,
  stdout?: NodeJS.WritableStream,
  stderr?: NodeJS.WritableStream,
  coreScan?: CoreScan,
) => Promise<number>;

type CoreScan = (
  url: string,
  options: Record<string, unknown>,
) => Promise<{ readonly report: Record<string, unknown> }>;

export interface LoadedScanner {
  readonly runScan: RunScan;
  readonly source: typeof SCANNER_MODULE_ID | typeof SCANNER_COMPAT_MODULE_ID;
}

export interface InvokeScannerOptions {
  readonly targetUrl: string;
  readonly outputDir: string;
  readonly cwd: string;
  readonly browser: BrowserName;
  readonly severityThreshold: Severity;
  readonly timeoutMs: number;
  readonly processTimeoutMs?: number;
  readonly runner?: ProcessRunner;
}

export interface ScannerInvocation {
  readonly envelope: CliScanEnvelope;
  readonly artifactPath: string;
  readonly process: ProcessResult;
}

export class ScannerInvocationError extends Error {
  readonly processResult: ProcessResult | undefined;
  override readonly name = 'ScannerInvocationError';

  constructor(
    message: string,
    processResult: ProcessResult | undefined = undefined,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.processResult = processResult;
  }
}

function moduleRecord(value: unknown, specifier: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    throw new ScannerInvocationError(`${specifier} did not return an ESM module namespace`);
  }
  return value as Record<string, unknown>;
}

function scannerFrom(value: unknown, specifier: string): RunScan {
  const runScan = moduleRecord(value, specifier)['runScan'];
  if (typeof runScan !== 'function') {
    throw new ScannerInvocationError(`${specifier} does not export runScan`);
  }
  return runScan as RunScan;
}

function supportsCompatFallback(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const code = (error as { readonly code?: unknown }).code;
  const message = error instanceof Error ? error.message : '';
  return (
    (code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' || code === 'ERR_MODULE_NOT_FOUND') &&
    (message.includes('/scanner') || message.includes(SCANNER_MODULE_ID))
  );
}

export async function loadAriadaScanner(): Promise<LoadedScanner> {
  try {
    const scanner = (await import(SCANNER_MODULE_ID)) as unknown;
    return { runScan: scannerFrom(scanner, SCANNER_MODULE_ID), source: SCANNER_MODULE_ID };
  } catch (error) {
    if (!supportsCompatFallback(error)) throw error;
  }
  const compat = (await import(SCANNER_COMPAT_MODULE_ID)) as unknown;
  return {
    runScan: scannerFrom(compat, SCANNER_COMPAT_MODULE_ID),
    source: SCANNER_COMPAT_MODULE_ID,
  };
}

export async function loadPrivateTargetCoreScanner(): Promise<CoreScan> {
  const imported = (await import(CORE_SCANNER_MODULE_ID)) as unknown;
  const scan = moduleRecord(imported, CORE_SCANNER_MODULE_ID)['scan'];
  if (typeof scan !== 'function') {
    throw new ScannerInvocationError(`${CORE_SCANNER_MODULE_ID} does not export scan`);
  }
  const actualScan = scan as CoreScan;
  return async (url, options) =>
    await actualScan(url, {
      ...options,
      allowPrivate: true,
    });
}

function isGeneratedCampaignTarget(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/campaign.html'
    );
  } catch {
    return false;
  }
}

function browserAt(value: string): BrowserName {
  if (value === 'chromium' || value === 'firefox' || value === 'webkit') return value;
  throw new ScannerInvocationError(`Invalid scanner worker browser: ${value}`);
}

function severityAt(value: string): Severity {
  if (value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor') {
    return value;
  }
  throw new ScannerInvocationError(`Invalid scanner worker severity: ${value}`);
}

function positiveIntegerAt(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ScannerInvocationError(`${name} must be a positive integer`);
  }
  return parsed;
}

export async function runScannerWorker(args: readonly string[]): Promise<number> {
  if (args.length !== 5) {
    throw new ScannerInvocationError(
      'Scanner worker expects targetUrl, outputDir, browser, severityThreshold, and timeoutMs',
    );
  }
  const [targetUrl, outputDir, browserValue, severityValue, timeoutValue] = args;
  if (
    targetUrl === undefined ||
    outputDir === undefined ||
    browserValue === undefined ||
    severityValue === undefined ||
    timeoutValue === undefined
  ) {
    throw new ScannerInvocationError('Scanner worker arguments are incomplete');
  }
  const scanner = await loadAriadaScanner();
  const options: ScannerOptions = {
    outputDir,
    browser: browserAt(browserValue),
    format: 'json',
    severityThreshold: severityAt(severityValue),
    timeoutMs: positiveIntegerAt(timeoutValue, 'timeoutMs'),
  };
  if (!isGeneratedCampaignTarget(targetUrl)) {
    return await scanner.runScan(targetUrl, options);
  }
  const coreScan = await loadPrivateTargetCoreScanner();
  return await scanner.runScan(targetUrl, options, process.stdout, process.stderr, coreScan);
}

export function buildScannerProcessRequest(options: InvokeScannerOptions): ProcessRequest {
  const workerPath = fileURLToPath(new URL('./scanner-worker.js', import.meta.url));
  return {
    command: process.execPath,
    args: [
      workerPath,
      options.targetUrl,
      resolve(options.outputDir),
      options.browser,
      options.severityThreshold,
      String(options.timeoutMs),
    ],
    cwd: resolve(options.cwd),
    env: {
      ...process.env,
      NO_COLOR: '1',
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
    },
    shell: false,
    timeoutMs: options.processTimeoutMs ?? options.timeoutMs + 30_000,
    outputLimitBytes: 1_048_576,
  };
}

function conciseOutput(result: ProcessResult): string {
  const text = (result.stderr.trim() || result.stdout.trim() || 'no diagnostics').replace(
    /\s+/g,
    ' ',
  );
  return text.length <= 600 ? text : `${text.slice(0, 597)}...`;
}

export async function invokeScanner(options: InvokeScannerOptions): Promise<ScannerInvocation> {
  const outputDir = resolve(options.outputDir);
  const artifactPath = join(outputDir, 'scan.json');
  await mkdir(outputDir, { recursive: true });
  await rm(artifactPath, { force: true });

  const runner = options.runner ?? spawnProcess;
  let processResult: ProcessResult;
  try {
    processResult = await runner(buildScannerProcessRequest({ ...options, outputDir }));
  } catch (error) {
    if (error instanceof ScannerInvocationError) throw error;
    throw new ScannerInvocationError(
      `Scanner process boundary failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      { cause: error },
    );
  }

  if (
    processResult.signal !== null ||
    (processResult.exitCode !== 0 && processResult.exitCode !== 1)
  ) {
    throw new ScannerInvocationError(
      `Ariada scanner failed with exit ${String(processResult.exitCode)}: ${conciseOutput(processResult)}`,
      processResult,
    );
  }

  let source: string;
  try {
    source = await readFile(artifactPath, 'utf8');
  } catch (error) {
    throw new ScannerInvocationError(`Ariada scanner did not write ${artifactPath}`, processResult, {
      cause: error,
    });
  }

  if (Buffer.byteLength(source) > 4 * 1024 * 1024) {
    throw new ScannerInvocationError('Ariada scan artifact exceeds 4 MiB', processResult);
  }

  let envelope: CliScanEnvelope;
  try {
    envelope = parseCliScan(source);
  } catch (error) {
    throw new ScannerInvocationError(
      `Ariada scanner produced an invalid cli-scan.v1 artifact: ${error instanceof Error ? error.message : String(error)}`,
      processResult,
      { cause: error },
    );
  }

  if (envelope.exitCode !== processResult.exitCode) {
    throw new ScannerInvocationError(
      `Ariada process exit ${processResult.exitCode} does not match artifact exit ${envelope.exitCode}`,
      processResult,
    );
  }

  if (new URL(envelope.url).href !== new URL(options.targetUrl).href) {
    throw new ScannerInvocationError(
      'Ariada artifact URL does not match the requested scan target',
      processResult,
    );
  }

  return { envelope, artifactPath, process: processResult };
}
