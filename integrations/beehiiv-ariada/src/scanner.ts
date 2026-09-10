// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/scanner.js` and `dist/scanner.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// THE ADDRESS CHECK IS THE LARGEST THING HERE AND THAT IS DELIBERATE. This takes
// an address from whoever runs it and fetches it with a browser, so a lax check
// turns the tool into a way of reaching things its operator cannot: encrypted
// transport only, no credentials in the address, no port other than the default,
// and no address written as a bare network number, since that is how the naming
// layer gets stepped around.
//
// A publication on the platform must be a single label beneath its domain, and
// not one of the platform's own names — a scan of the administrative interface
// would be a scan of somebody's dashboard, not of a newsletter. A publication on
// its own domain is refused unless the caller asked for that explicitly, and even
// then names reserved for private and testing use are rejected, because those
// are the ones that resolve differently inside a network than outside it.
//
// AN EXPORTED FILE IS TREATED AS HOSTILE INPUT, NOT AS A LOCAL FILE. It must be
// a regular file rather than a link — a link is how a caller aims the reader at
// something else — it is size-bounded both ways, its real path is resolved before
// reading, and a redirect instruction in its head is refused outright, since that
// would send the browser somewhere this checked nothing about.
//
// It is then served over the loopback interface, from one address, with a policy
// that permits no outbound fetching at all. Opening the file directly would give
// the page the privileges of a local document; serving it makes it an ordinary
// remote page that can reach nothing.
//
// The private-network permission is granted only on that path, where the address
// is one this file created moments earlier — never on the path where the address
// came from the caller.
//
// Diagnostics from the scanner are captured under a byte ceiling and the excess
// dropped, so a process that fails by printing without end cannot exhaust memory
// on the way to reporting that it failed.
//
// Errors carry a short code so a caller can tell bad input from a broken run
// from a malformed report without reading prose, and the temporary server is
// closed in a `finally` whatever happened.

import { lstat, mkdir, readFile, realpath, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { isIP } from 'node:net';
import { extname, join, resolve } from 'node:path';
import { Writable } from 'node:stream';

import { runScan } from '@ariada-org/cli';

import { flattenCliFindings, parseCliScanV1 } from './artifact.js';
import {
  IMPACTS,
  type BeehiivScanDependencies,
  type BeehiivScanOptions,
  type BeehiivScanResult,
  type BeehiivScanSource,
  type BrowserName,
  type CliPolicyExitCode,
  type CliScannerRuntime,
  type Impact
} from './contracts.js';

const DEFAULT_OUTPUT_DIR = 'ariada-beehiiv-output';
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_CAPTURE_BYTES = 64 * 1024;

const RESERVED_BEEHIIV_LABELS = new Set([
  'admin',
  'api',
  'app',
  'dashboard',
  'status',
  'www'
]);

const RESERVED_SUFFIXES = [
  '.example',
  '.internal',
  '.invalid',
  '.local',
  '.localhost',
  '.test'
];

export class BeehiivScanError extends Error {
  readonly code: 'E_INPUT' | 'E_RUNTIME' | 'E_ARTIFACT' | 'E_EXPORT';
  override readonly name = 'BeehiivScanError';

  constructor(
    code: 'E_INPUT' | 'E_RUNTIME' | 'E_ARTIFACT' | 'E_EXPORT',
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.code = code;
  }
}

interface NormalizedOptions {
  readonly outputDir: string;
  readonly browser: BrowserName;
  readonly severityThreshold: Impact;
  readonly timeoutMs: number;
  readonly allowCustomDomain: boolean;
}

function captureStream(): { stream: Writable; text: () => string } {
  let captured = Buffer.alloc(0);
  const stream = new Writable({
    write(chunk: unknown, _encoding, callback) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      const remaining = MAX_CAPTURE_BYTES - captured.byteLength;
      if (remaining > 0) {
        captured = Buffer.concat([captured, bytes.subarray(0, remaining)]);
      }
      callback();
    }
  });
  return { stream, text: () => captured.toString('utf8') };
}

function normalizedOptions(options: BeehiivScanOptions): NormalizedOptions {
  const browser = options.browser ?? 'chromium';
  if (!['chromium', 'firefox', 'webkit'].includes(browser)) {
    throw new BeehiivScanError('E_INPUT', `Unsupported browser: ${browser}`);
  }
  const severityThreshold = options.severityThreshold ?? 'moderate';
  if (!IMPACTS.includes(severityThreshold)) {
    throw new BeehiivScanError('E_INPUT', `Unsupported severity threshold: ${severityThreshold}`);
  }
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new BeehiivScanError(
      'E_INPUT',
      'timeoutMs must be a safe integer between 1000 and 120000'
    );
  }
  return {
    outputDir: resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR),
    browser,
    severityThreshold,
    timeoutMs,
    allowCustomDomain: options.allowCustomDomain ?? false
  };
}

function plainHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

export function normalizeBeehiivUrl(input: string, allowCustomDomain = false): string {
  if (input.length === 0 || input.length > 2_048) {
    throw new BeehiivScanError('E_INPUT', 'URL must contain 1 to 2048 characters');
  }
  let url: URL;
  try {
    url = new URL(input);
  }
  catch (error) {
    throw new BeehiivScanError('E_INPUT', 'URL is not parseable', error);
  }
  if (url.protocol !== 'https:') {
    throw new BeehiivScanError('E_INPUT', 'Live Beehiiv scans require HTTPS');
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new BeehiivScanError('E_INPUT', 'URL credentials are forbidden');
  }
  if (url.port !== '' && url.port !== '443') {
    throw new BeehiivScanError('E_INPUT', 'Non-default URL ports are forbidden');
  }
  const hostname = url.hostname.toLowerCase();
  const hostForIpCheck = plainHostname(hostname);
  if (isIP(hostForIpCheck) !== 0) {
    throw new BeehiivScanError('E_INPUT', 'IP-literal hosts are forbidden');
  }
  const hostedByBeehiiv = hostname.endsWith('.beehiiv.com');
  if (hostedByBeehiiv) {
    const publicationLabel = hostname.slice(0, -'.beehiiv.com'.length);
    if (
      publicationLabel.length === 0 ||
      publicationLabel.includes('.') ||
      RESERVED_BEEHIIV_LABELS.has(publicationLabel)
    ) {
      throw new BeehiivScanError('E_INPUT', 'Expected a Beehiiv publication subdomain');
    }
  }
  else {
    if (!allowCustomDomain) {
      throw new BeehiivScanError('E_INPUT', 'Custom publication domains require allowCustomDomain');
    }
    if (
      hostname.length > 253 ||
      !hostname.includes('.') ||
      RESERVED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
    ) {
      throw new BeehiivScanError('E_INPUT', 'Unsafe custom publication hostname');
    }
  }
  url.hash = '';
  return url.href;
}

// The return type is inferred rather than written. What the scanner hands back
// is the scanner's own shape, and naming it here loosely — as merely "something"
// — is not a widening the caller accepts: it expects a report, and an annotation
// that promises less than the value actually carries makes the call fail to
// compile while the code is perfectly correct.
async function localCoreScan(url: string, options: Record<string, unknown>) {
  const { scan } = await import('@ariada-org/core-playwright');
  const result = await scan(url, { ...options, allowPrivate: true });
  return result;
}

export const actualCliScannerRuntime: CliScannerRuntime = {
  async run(invocation) {
    const stdout = captureStream();
    const stderr = captureStream();
    const exitCode = await runScan(
      invocation.targetUrl,
      {
        outputDir: invocation.outputDir,
        browser: invocation.browser,
        format: 'json',
        severityThreshold: invocation.severityThreshold,
        timeoutMs: invocation.timeoutMs
      },
      stdout.stream,
      stderr.stream,
      invocation.allowPrivate ? localCoreScan : undefined
    );
    if (exitCode !== 0 && exitCode !== 1) {
      const detail = stderr.text().trim() || stdout.text().trim();
      throw new BeehiivScanError(
        'E_RUNTIME',
        `Ariada CLI failed with exit ${exitCode}${detail ? `: ${detail}` : ''}`
      );
    }
    return exitCode;
  }
};

async function invokeAndParse(
  targetUrl: string,
  source: BeehiivScanSource,
  options: NormalizedOptions,
  dependencies: BeehiivScanDependencies,
  allowPrivate: boolean
): Promise<BeehiivScanResult> {
  await mkdir(options.outputDir, { recursive: true });
  const artifactPath = join(options.outputDir, 'scan.json');
  await rm(artifactPath, { force: true });
  let exitCode: CliPolicyExitCode;
  try {
    exitCode = await dependencies.runtime.run({
      targetUrl,
      outputDir: options.outputDir,
      browser: options.browser,
      severityThreshold: options.severityThreshold,
      timeoutMs: options.timeoutMs,
      allowPrivate
    });
  }
  catch (error) {
    if (error instanceof BeehiivScanError) {
      throw error;
    }
    throw new BeehiivScanError('E_RUNTIME', 'Ariada runtime failed', error);
  }
  let rawArtifact: string;
  try {
    rawArtifact = await readFile(artifactPath, 'utf8');
  }
  catch (error) {
    throw new BeehiivScanError('E_ARTIFACT', `Ariada did not produce ${artifactPath}`, error);
  }
  try {
    const artifact = parseCliScanV1(rawArtifact, { url: targetUrl, exitCode });
    return {
      source,
      artifactPath,
      artifact,
      findings: flattenCliFindings(artifact.report.findings),
      exitCode
    };
  }
  catch (error) {
    throw new BeehiivScanError(
      'E_ARTIFACT',
      'Ariada produced an invalid or mismatched cli-scan.v1 artifact',
      error
    );
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) {
        rejectClose(error);
      }
      else {
        resolveClose();
      }
    });
    server.closeAllConnections();
  });
}

async function serveExportedHtml(html: Buffer): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    if (
      (request.method !== 'GET' && request.method !== 'HEAD') ||
      request.url !== '/beehiiv-export.html'
    ) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-length': String(html.byteLength),
      'content-security-policy':
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; object-src 'none'; base-uri 'none'",
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : html);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null) {
    await closeServer(server);
    throw new BeehiivScanError('E_EXPORT', 'Loopback HTML server has no address');
  }
  return {
    url: `http://127.0.0.1:${(address as { port: number }).port}/beehiiv-export.html`,
    close: () => closeServer(server)
  };
}

async function readExportedHtml(inputPath: string): Promise<{ path: string; html: Buffer }> {
  const absolutePath = resolve(inputPath);
  const extension = extname(absolutePath).toLowerCase();
  if (extension !== '.html' && extension !== '.htm') {
    throw new BeehiivScanError('E_EXPORT', 'Export path must end in .html or .htm');
  }
  let stats;
  try {
    stats = await lstat(absolutePath);
  }
  catch (error) {
    throw new BeehiivScanError('E_EXPORT', 'Export file is not readable', error);
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new BeehiivScanError('E_EXPORT', 'Export path must be a regular non-symlink file');
  }
  if (stats.size === 0 || stats.size > MAX_HTML_BYTES) {
    throw new BeehiivScanError(
      'E_EXPORT',
      `Export HTML must contain 1 to ${MAX_HTML_BYTES} bytes`
    );
  }
  const canonicalPath = await realpath(absolutePath);
  const html = await readFile(canonicalPath);
  const textSample = html.subarray(0, Math.min(html.byteLength, 64 * 1024)).toString('utf8');
  if (textSample.includes('\0')) {
    throw new BeehiivScanError('E_EXPORT', 'Export HTML contains NUL bytes');
  }
  if (/http-equiv\s*=\s*["']?\s*refresh/i.test(textSample)) {
    throw new BeehiivScanError('E_EXPORT', 'Export HTML meta refresh is forbidden');
  }
  return { path: canonicalPath, html };
}

const ACTUAL_DEPENDENCIES: BeehiivScanDependencies = {
  runtime: actualCliScannerRuntime
};

export async function scanBeehiivUrl(
  inputUrl: string,
  options: BeehiivScanOptions = {},
  dependencies: BeehiivScanDependencies = ACTUAL_DEPENDENCIES
): Promise<BeehiivScanResult> {
  const normalized = normalizedOptions(options);
  const targetUrl = normalizeBeehiivUrl(inputUrl, normalized.allowCustomDomain);
  return invokeAndParse(targetUrl, { kind: 'url', url: targetUrl }, normalized, dependencies, false);
}

export async function scanBeehiivExport(
  inputPath: string,
  options: BeehiivScanOptions = {},
  dependencies: BeehiivScanDependencies = ACTUAL_DEPENDENCIES
): Promise<BeehiivScanResult> {
  const normalized = normalizedOptions(options);
  const exported = await readExportedHtml(inputPath);
  const served = await serveExportedHtml(exported.html);
  try {
    return await invokeAndParse(
      served.url,
      { kind: 'export', path: exported.path },
      normalized,
      dependencies,
      true
    );
  }
  finally {
    await served.close();
  }
}
