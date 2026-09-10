// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/scanner.js` and `dist/scanner.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with
// the rebuild check.
//
// THE FIXTURE ADDRESS IS RESTRICTED TO LOOPBACK OVER PLAIN HTTP, AND CHECKED
// TWICE. Once when the options are normalised, and again inside the scan
// function that is handed to the scanner — because that function receives an
// address from the scanner rather than from here, and a check made only on the
// way in is a check on the wrong value. This runs from a test runner with a
// browser attached; without the restriction, a fixture address in a test file
// would be a way to point that browser at anything reachable from the machine.
//
// A FINDING BELONGS TO THE COMPONENT ONLY IF THE SELECTOR SAYS SO, AND THE
// PREFIX MATCH IS DELIBERATE. `my-card...`, `my-card >>>...`, or `>>> my-card
//...` inside a shadow path — the component's own element and everything under
// it, but not a sibling whose name merely starts the same way. A page fixture
// contains more than the component under test, and reporting the page's problems
// against the component would make the result useless in both directions.
//
// Captured output over its limit throws rather than being truncated. It is
// evidence inside an error, and a partial transcript that looks whole is worse
// than a stated refusal.
//
// The result is written beside itself and renamed into place, because a test
// runner reads it as soon as the command returns.

import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';

import { runScan as ariadaRunScan } from '@ariada-org/cli';

import { LitAriadaError } from './errors.js';
import { flattenAriadaFindings, parseCliScanV1 } from './result.js';
import { ARIADA_SEVERITIES, } from './types.js';
import type { AriadaSeverity, LitBrowser, LitScanOptions, LitScanResult } from './types.js';

export type AriadaRunScan = typeof ariadaRunScan;
export type AriadaCoreScan = NonNullable<Parameters<AriadaRunScan>[4]>;

export interface AriadaRuntime {
  readonly runScan?: AriadaRunScan;
  readonly coreScan?: AriadaCoreScan;
}

const MAX_CAPTURE_BYTES = 128 * 1024;
const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
const CUSTOM_ELEMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function captureOutput(): { stream: PassThrough; text: () => string } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  let bytes = 0;
  stream.on('data', (chunk: Buffer) => {
    const copy = Buffer.from(chunk);
    bytes += copy.byteLength;
    if (bytes <= MAX_CAPTURE_BYTES) chunks.push(copy);
  });
  return {
    stream,
    text: () => {
      if (bytes > MAX_CAPTURE_BYTES) {
        throw new LitAriadaError('SCANNER_FAILED', 'Ariada output exceeded capture limit', {
          bytes,
          limit: MAX_CAPTURE_BYTES,
        });
      }
      return Buffer.concat(chunks).toString('utf8');
    },
  };
}

export function normalizeLitFixtureUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input);
  }
  catch {
    throw new LitAriadaError('INVALID_INPUT', `Invalid fixture URL: ${input}`);
  }
  if (parsed.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) ||
    parsed.username.length > 0 ||
    parsed.password.length > 0) {
    throw new LitAriadaError('INVALID_INPUT', 'Lit dev fixtures must use credential-free HTTP on localhost or a loopback address');
  }
  return parsed.href;
}

export function normalizeComponentSelector(input: string): string {
  const selector = input.trim().toLowerCase();
  if (!CUSTOM_ELEMENT.test(selector)) {
    throw new LitAriadaError('INVALID_INPUT', 'componentSelector must be a custom-element tag name containing a hyphen', { componentSelector: input });
  }
  return selector;
}

function normalizeBrowser(input: LitBrowser | undefined): LitBrowser {
  const browser = input ?? 'chromium';
  if (browser !== 'chromium' && browser !== 'firefox' && browser !== 'webkit') {
    throw new LitAriadaError('INVALID_INPUT', `Unsupported browser: ${String(browser)}`);
  }
  return browser;
}

function normalizedOptions(options: LitScanOptions): {
  fixtureUrl: string;
  componentSelector: string;
  outputDirectory: string;
  browser: LitBrowser;
  severityThreshold: AriadaSeverity;
  timeoutMs: number;
} {
  const severityThreshold = options.severityThreshold ?? 'serious';
  if (!ARIADA_SEVERITIES.includes(severityThreshold)) {
    throw new LitAriadaError('INVALID_INPUT', `Unsupported severity threshold: ${String(severityThreshold)}`);
  }
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new LitAriadaError('INVALID_INPUT', 'timeoutMs must be between 1000 and 120000');
  }
  return {
    fixtureUrl: normalizeLitFixtureUrl(options.fixtureUrl),
    componentSelector: normalizeComponentSelector(options.componentSelector),
    outputDirectory: resolve(options.outputDirectory ?? 'lit-ariada-output'),
    browser: normalizeBrowser(options.browser),
    severityThreshold,
    timeoutMs,
  };
}

const realLoopbackCoreScan = async (url: string, options: Record<string, unknown>) => {
  normalizeLitFixtureUrl(url);
  const playwrightOptions = typeof options['playwright'] === 'object' && options['playwright'] !== null
    ? options['playwright'] as Record<string, unknown>
    : {};
  const requestedBrowser = playwrightOptions['browser'];
  const browser = requestedBrowser === 'firefox' || requestedBrowser === 'webkit'
    ? requestedBrowser
    : 'chromium';
  const timeoutMs = typeof options['timeoutMs'] === 'number' ? options['timeoutMs'] : 30_000;
  const core = await import('@ariada-org/core-playwright');
  const coreOptions = {
    allowPrivate: true,
    screenshot: false,
    timeoutMs,
    playwright: { browser, headless: true },
  };
  const result = await core.scan(url, coreOptions);
  return { report: result.report };
};

async function readScanArtifact(path: string): Promise<string> {
  try {
    const details = await stat(path);
    if (!details.isFile() || details.size > MAX_ARTIFACT_BYTES) {
      throw new Error(`scan.json must be a regular file <= ${MAX_ARTIFACT_BYTES} bytes`);
    }
    return await readFile(path, 'utf8');
  }
  catch (error) {
    throw new LitAriadaError('SCAN_ARTIFACT_INVALID', `Cannot read Ariada scan artifact: ${path}`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function isComponentFinding(selector: string | undefined, componentSelector: string): boolean {
  if (selector === undefined) return false;
  const normalized = selector.trim().toLowerCase();
  return (normalized.startsWith(`${componentSelector} `) ||
    normalized.startsWith(`${componentSelector} >>>`) ||
    normalized.includes(`>>> ${componentSelector} `));
}

export async function scanLitFixture(options: LitScanOptions): Promise<LitScanResult> {
  return scanLitFixtureWithRuntime(options);
}

export async function scanLitFixtureWithRuntime(options: LitScanOptions, runtime: AriadaRuntime = {}): Promise<LitScanResult> {
  const normalized = normalizedOptions(options);
  const scanArtifactPath = resolve(normalized.outputDirectory, 'scan.json');
  const resultArtifactPath = resolve(normalized.outputDirectory, 'lit-ariada-result.json');
  await mkdir(normalized.outputDirectory, { recursive: true });
  await Promise.all([rm(scanArtifactPath, { force: true }), rm(resultArtifactPath, { force: true })]);
  const stdout = captureOutput();
  const stderr = captureOutput();
  const runScan = runtime.runScan ?? ariadaRunScan;
  let rawExit;
  try {
    rawExit = await runScan(normalized.fixtureUrl, {
      browser: normalized.browser,
      format: 'json',
      outputDir: normalized.outputDirectory,
      severityThreshold: normalized.severityThreshold,
      timeoutMs: normalized.timeoutMs,
    }, stdout.stream, stderr.stream, runtime.coreScan ?? realLoopbackCoreScan);
  }
  catch (error) {
    throw new LitAriadaError('SCANNER_FAILED', '@ariada-org/cli threw before completing', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (rawExit !== 0 && rawExit !== 1) {
    throw new LitAriadaError('SCANNER_FAILED', `@ariada-org/cli exited with code ${rawExit}`, {
      stdout: stdout.text(),
      stderr: stderr.text(),
    });
  }
  const exitCode = rawExit;
  const scan = parseCliScanV1(await readScanArtifact(scanArtifactPath));
  if (scan.url !== normalized.fixtureUrl || scan.exitCode !== exitCode) {
    throw new LitAriadaError('SCAN_ARTIFACT_INVALID', 'Ariada process result disagrees with scan.json', { processExit: exitCode, artifactExit: scan.exitCode, artifactUrl: scan.url });
  }
  const componentFindings = flattenAriadaFindings(scan.report).filter((item) => isComponentFinding(item.element?.selector, normalized.componentSelector));
  const result: LitScanResult = {
    schema: 'lit-ariada-result.v1',
    fixtureUrl: normalized.fixtureUrl,
    componentSelector: normalized.componentSelector,
    outputDirectory: normalized.outputDirectory,
    scanArtifactPath,
    resultArtifactPath,
    invocation: {
      package: '@ariada-org/cli',
      version: '0.1.0',
      exitCode,
      stdout: stdout.text(),
      stderr: stderr.text(),
    },
    scan,
    componentFindings,
    decision: {
      status: exitCode === 0 ? 'pass' : 'violations',
      failOnSeverity: normalized.severityThreshold,
      exitCode,
    },
  };
  const temporaryPath = `${resultArtifactPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, resultArtifactPath);
  return result;
}
