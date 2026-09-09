// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones.
//
// It has since been released from that comparison, and the wording of that
// sentence matters: the guard reads for it literally, so it stays on one line.
//
// HOW IT IS HELD NOW. While the comparison still matched, behaviour tests were
// written against the artifact reader, and only then were the finding walk and
// the per-severity counts split out of it. Stop checking that the artifact
// describes the address asked for, or that its summary agrees with the findings
// present, and exactly one test fails for each.
//
// The guarantee lives in `tests/scripts/recovered-turborepo-task.test.ts`, and
// the release is recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`.
//
// WHAT THIS TASK IS FOR, since nobody had read it. Turborepo caches a task by
// its inputs and its outputs, so a scan is only worth caching if it writes one
// deterministic artifact. That is what the findings file is: everything the
// scan learned, written once, so a cache hit replays a real result rather than
// re-running a browser.
//
// TWO DECISIONS IN HERE ARE WORTH SEEING BEFORE THEY LOOK ARBITRARY.
//
// The semantic exit code and the process exit code are separate fields, and
// `--report-only` moves only the second. So a pipeline can record that the page
// failed while letting the build carry on, and the record does not lie about it
// afterwards — which is the thing a single exit code cannot do.
//
// Local HTML is served over loopback rather than opened as a file. A file URL
// has a different origin and different rules, so a page scanned that way is not
// the page that gets deployed. The server answers exactly one address, refuses
// anything else, and is closed in a `finally` whatever happened.

import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { PassThrough } from 'node:stream';

import { runScan as defaultRunScan } from '@ariada-org/cli';
import { scan as scanWithPlaywright } from '@ariada-org/core-playwright';
import { createA11yAnalyzer } from '@ariada-org/rules-axe';


export const ARIADA_TURBO_VERSION = '0.1.0';
export const FINDINGS_SCHEMA = 'https://ariada.org/schemas/turborepo-findings.v1.json';

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_SCAN_BYTES = 16 * 1024 * 1024;
const MAX_DIAGNOSTIC_BYTES = 128 * 1024;

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

type AriadaRunScan = typeof defaultRunScan;
type AriadaCoreScan = NonNullable<Parameters<AriadaRunScan>[4]>;

export interface AriadaTaskOptions {
  readonly url?: string;
  readonly html?: string;
  readonly output?: string;
  readonly browser?: BrowserName;
  readonly failOn?: Severity;
  readonly timeoutMs?: number;
  readonly reportOnly?: boolean;
  readonly cwd?: string;
}

export interface AriadaRuntime {
  readonly runScan?: AriadaRunScan;
  readonly coreScan?: AriadaCoreScan;
}

export interface FindingsArtifact {
  readonly $schema: typeof FINDINGS_SCHEMA;
  readonly task: 'a11y';
  readonly scanner: {
    readonly cli: '@ariada-org/cli@0.1.0';
    readonly core: '@ariada-org/core-playwright@0.1.0';
    readonly analyzer: '@ariada-org/rules-axe@0.1.0';
    readonly browser: BrowserName;
  };
  readonly target: {
    readonly kind: 'url' | 'html';
    readonly value: string;
    readonly scannedUrl: string;
  };
  readonly summary: {
    readonly total: number;
    readonly byImpact: Record<string, number>;
  };
  readonly findings: readonly Record<string, unknown>[];
  readonly semanticExitCode: 0 | 1;
  readonly ariada: Record<string, unknown>;
}

export interface AriadaTaskResult {
  readonly artifact: FindingsArtifact;
  readonly outputPath: string;
  readonly semanticExitCode: 0 | 1;
  readonly processExitCode: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
}

export class AriadaTaskError extends Error {
  readonly code: 'INVALID_OPTIONS' | 'SCAN_FAILED' | 'ARTIFACT_INVALID';
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: 'INVALID_OPTIONS' | 'SCAN_FAILED' | 'ARTIFACT_INVALID',
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'AriadaTaskError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether a path stays under a directory.
 *
 * Answered by the relative path rather than by prefix comparison, because a
 * prefix says `/tmp/a-b` is inside `/tmp/a`, and a path that climbs out with
 * `..` looks like an ordinary name until it is resolved.
 */
function isInside(parent: string, child: string): boolean {
  const nested = relative(parent, child);
  return nested === '' || (nested !== '..' && !nested.startsWith(`..${sep}`) && !isAbsolute(nested));
}

/**
 * A stream that keeps what it is given up to a limit, and says so past it.
 *
 * Diagnostic output from a failing scan can be a browser's whole log, and this
 * is carried in an error object. Past the limit the text is replaced outright
 * rather than truncated in the middle, so nobody reads half a line as a whole
 * one.
 */
function boundedCapture(): { stream: PassThrough; text: () => string } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  let bytes = 0;
  stream.on('data', (chunk: Buffer) => {
    const copy = Buffer.from(chunk);
    bytes += copy.byteLength;
    if (bytes <= MAX_DIAGNOSTIC_BYTES) chunks.push(copy);
  });
  return {
    stream,
    text: () => {
      if (bytes > MAX_DIAGNOSTIC_BYTES) return '[diagnostic output truncated]';
      return Buffer.concat(chunks).toString('utf8');
    },
  };
}

function parseBrowser(value: unknown): BrowserName {
  return value === 'firefox' || value === 'webkit' ? value : 'chromium';
}

function createProductionCoreScan(allowPrivate: boolean): AriadaCoreScan {
  return async (url: string, rawOptions: Record<string, unknown>) => {
    const rawPlaywright = rawOptions['playwright'];
    const playwright = isRecord(rawPlaywright) ? rawPlaywright : {};
    const timeout = rawOptions['timeoutMs'];
    const scanOptions = {
      allowPrivate,
      analyzers: [createA11yAnalyzer()],
      playwright: {
        browser: parseBrowser(playwright['browser']),
        headless: true,
      },
      screenshot: false,
      timeoutMs: typeof timeout === 'number' ? timeout : 30_000,
    };
    const result = await scanWithPlaywright(url, scanOptions);
    return result;
  };
}

async function readBounded(path: string, maximum: number, label: string): Promise<string> {
  let details;
  try {
    details = await stat(path);
  } catch (error) {
    throw new AriadaTaskError('INVALID_OPTIONS', `${label} is not readable: ${path}`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!details.isFile() || details.size > maximum) {
    throw new AriadaTaskError(
      'INVALID_OPTIONS',
      `${label} must be a regular file no larger than ${String(maximum)} bytes`,
      { path, bytes: details.size },
    );
  }
  return readFile(path, 'utf8');
}

/**
 * Serve one HTML document on loopback, at one address, and nothing else.
 *
 * Port zero so the operating system picks a free one — a fixed port makes two
 * scans in the same pipeline fight each other. The declared policy is narrow
 * because the fixture must not be able to reach anything the real page could
 * not.
 */
async function startHtmlServer(html: string): Promise<{ server: Server; url: string }> {
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'self' data:; style-src 'self' 'unsafe-inline'",
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
    });
    response.end(html);
  });
  await new Promise<void>((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      accept();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    server.close();
    throw new AriadaTaskError('SCAN_FAILED', 'Loopback fixture server did not bind a TCP port');
  }
  return { server, url: `http://127.0.0.1:${String(address.port)}/` };
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (server === undefined) return;
  await new Promise<void>((accept, reject) => {
    server.close((error) => (error === undefined ? accept() : reject(error)));
  });
}

function normalizeUrl(value: string): string {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new AriadaTaskError('INVALID_OPTIONS', `Invalid scan URL: ${value}`);
  }
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw new AriadaTaskError(
      'INVALID_OPTIONS',
      'Scan URL must be absolute HTTP(S) and must not contain credentials',
    );
  }
  return parsed.href;
}

function normalizeOptions(options: AriadaTaskOptions): {
  cwd: string;
  outputPath: string;
  browser: BrowserName;
  failOn: Severity;
  timeoutMs: number;
} {
  const cwd = resolve(options.cwd ?? process.cwd());
  const outputPath = resolve(cwd, options.output ?? '.ariada/findings.json');
  if (!isInside(cwd, outputPath)) {
    throw new AriadaTaskError(
      'INVALID_OPTIONS',
      'Output must stay inside the package working directory',
    );
  }
  const browser = options.browser ?? 'chromium';
  if (browser !== 'chromium' && browser !== 'firefox' && browser !== 'webkit') {
    throw new AriadaTaskError('INVALID_OPTIONS', `Unsupported browser: ${String(browser)}`);
  }
  const failOn = options.failOn ?? 'moderate';
  if (!['minor', 'moderate', 'serious', 'critical'].includes(failOn)) {
    throw new AriadaTaskError(
      'INVALID_OPTIONS',
      `Unsupported failure threshold: ${String(failOn)}`,
    );
  }
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300_000) {
    throw new AriadaTaskError('INVALID_OPTIONS', 'timeoutMs must be an integer from 1 to 300000');
  }
  return { cwd, outputPath, browser, failOn, timeoutMs };
}

/**
 * Every finding across every domain, refusing anything malformed on the way.
 *
 * A domain whose entries are not a list, or a finding with no rule or no
 * severity, is refused rather than skipped: a findings file read leniently
 * reports fewer problems than the scan found, and it is the count that gets
 * cached and believed.
 */
function flattenFindings(grouped: Record<string, unknown>): Record<string, unknown>[] {
  const findings: Record<string, unknown>[] = [];
  for (const [domain, entries] of Object.entries(grouped)) {
    if (!Array.isArray(entries)) {
      throw new AriadaTaskError('ARTIFACT_INVALID', `Ariada findings.${domain} must be an array`);
    }
    for (const entry of entries) {
      if (
        !isRecord(entry) ||
        typeof entry['ruleId'] !== 'string' ||
        typeof entry['severity'] !== 'string'
      ) {
        throw new AriadaTaskError(
          'ARTIFACT_INVALID',
          `Ariada findings.${domain} contains an invalid finding`,
        );
      }
      findings.push(entry);
    }
  }
  return findings;
}

/**
 * The per-severity counts, refusing any that is not a real count.
 */
function countsByImpact(byImpact: Record<string, unknown>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [impact, count] of Object.entries(byImpact)) {
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
      throw new AriadaTaskError('ARTIFACT_INVALID', `Invalid summary count for ${impact}`);
    }
    counts[impact] = count;
  }
  return counts;
}

/**
 * Read the scanner's own artifact, and refuse it unless it agrees with itself.
 *
 * Every check here is a disagreement worth catching rather than a formality:
 * the address scanned must be the address asked for, the summary total must
 * equal the findings actually present, and the exit code must be one of the two
 * the scanner is allowed to mean. A findings file that quietly disagrees with
 * its own summary is worse than a missing one, because it gets cached.
 */
export function parseCliScanArtifact(
  raw: string,
  expectedUrl: string,
): {
  readonly envelope: Record<string, unknown>;
  readonly findings: readonly Record<string, unknown>[];
  readonly total: number;
  readonly byImpact: Record<string, number>;
  readonly exitCode: 0 | 1;
} {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new AriadaTaskError('ARTIFACT_INVALID', 'Ariada scan.json is not valid JSON', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
  if (!isRecord(value) || value['url'] !== expectedUrl || !isRecord(value['report'])) {
    throw new AriadaTaskError('ARTIFACT_INVALID', 'Ariada scan.json target or report is invalid');
  }
  const report = value['report'];
  const grouped = report['findings'];
  if (!isRecord(grouped)) {
    throw new AriadaTaskError('ARTIFACT_INVALID', 'Ariada report.findings must be domain-grouped');
  }
  const findings = flattenFindings(grouped);
  const summary = value['summary'];
  if (!isRecord(summary) || summary['total'] !== findings.length || !isRecord(summary['byImpact'])) {
    throw new AriadaTaskError('ARTIFACT_INVALID', 'Ariada summary does not match report findings');
  }
  const exitCode = value['exitCode'];
  if (exitCode !== 0 && exitCode !== 1) {
    throw new AriadaTaskError('ARTIFACT_INVALID', 'Ariada scan.json has a non-semantic exit code');
  }
  const byImpact = countsByImpact(summary['byImpact']);
  return { envelope: value, findings, total: findings.length, byImpact, exitCode };
}

/**
 * Write the artifact beside itself and move it into place.
 *
 * A cached task is read by whatever runs next, and a half-written file is
 * indistinguishable from a complete one to a reader. The rename is the only
 * step anyone else can observe, and it is atomic.
 */
async function writeArtifact(path: string, artifact: FindingsArtifact): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${String(process.pid)}.tmp`);
  await writeFile(temporary, `${JSON.stringify(artifact, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, path);
}

export async function runAriadaTask(
  options: AriadaTaskOptions,
  runtime: AriadaRuntime = {},
): Promise<AriadaTaskResult> {
  if ((options.url === undefined) === (options.html === undefined)) {
    throw new AriadaTaskError('INVALID_OPTIONS', 'Provide exactly one of url or html');
  }
  const normalized = normalizeOptions(options);
  const scratch = await mkdtemp(join(tmpdir(), 'turborepo-ariada-'));
  const cliOutput = join(scratch, 'cli-output');
  let server: Server | undefined;
  let targetUrl: string;
  let target: FindingsArtifact['target'];
  let allowPrivate = false;
  try {
    if (options.html !== undefined) {
      const htmlPath = resolve(normalized.cwd, options.html);
      if (!isInside(normalized.cwd, htmlPath)) {
        throw new AriadaTaskError(
          'INVALID_OPTIONS',
          'HTML input must stay inside the package working directory',
        );
      }
      const html = await readBounded(htmlPath, MAX_HTML_BYTES, 'HTML input');
      const local = await startHtmlServer(html);
      server = local.server;
      targetUrl = local.url;
      target = { kind: 'html', value: relative(normalized.cwd, htmlPath), scannedUrl: targetUrl };
      allowPrivate = true;
    } else {
      targetUrl = normalizeUrl(options.url ?? '');
      target = { kind: 'url', value: targetUrl, scannedUrl: targetUrl };
    }
    const stdout = boundedCapture();
    const stderr = boundedCapture();
    const runScan = runtime.runScan ?? defaultRunScan;
    const coreScan = runtime.coreScan ?? createProductionCoreScan(allowPrivate);
    const cliExit = await runScan(
      targetUrl,
      {
        browser: normalized.browser,
        format: 'json',
        outputDir: cliOutput,
        severityThreshold: normalized.failOn,
        timeoutMs: normalized.timeoutMs,
      },
      stdout.stream,
      stderr.stream,
      coreScan,
    );
    if (cliExit !== 0 && cliExit !== 1) {
      throw new AriadaTaskError('SCAN_FAILED', `@ariada-org/cli returned exit ${String(cliExit)}`, {
        cliExit,
        stdout: stdout.text(),
        stderr: stderr.text(),
      });
    }
    const parsed = parseCliScanArtifact(
      await readBounded(join(cliOutput, 'scan.json'), MAX_SCAN_BYTES, 'Ariada scan artifact'),
      targetUrl,
    );
    if (parsed.exitCode !== cliExit) {
      throw new AriadaTaskError('ARTIFACT_INVALID', 'CLI process and scan.json exit codes disagree', {
        cliExit,
        artifactExit: parsed.exitCode,
      });
    }
    const artifact: FindingsArtifact = {
      $schema: FINDINGS_SCHEMA,
      task: 'a11y',
      scanner: {
        cli: '@ariada-org/cli@0.1.0',
        core: '@ariada-org/core-playwright@0.1.0',
        analyzer: '@ariada-org/rules-axe@0.1.0',
        browser: normalized.browser,
      },
      target,
      summary: { total: parsed.total, byImpact: parsed.byImpact },
      findings: parsed.findings,
      semanticExitCode: parsed.exitCode,
      ariada: parsed.envelope,
    };
    await writeArtifact(normalized.outputPath, artifact);
    return {
      artifact,
      outputPath: normalized.outputPath,
      semanticExitCode: parsed.exitCode,
      processExitCode: options.reportOnly === true ? 0 : parsed.exitCode,
      stdout: stdout.text(),
      stderr: stderr.text(),
    };
  } finally {
    await closeServer(server);
    await rm(scratch, { recursive: true, force: true });
  }
}
