// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/brevo.js` and `dist/brevo.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies are
// the compiled ones. Checked with
// the rebuild check.
//
// FOUR WAYS IN, ONE WAY THROUGH. A caller names a landing page, a hosted
// campaign view, an exported HTML file, or a campaign held by the mail platform.
// The first two are addresses and are checked as addresses; the last two are
// documents, and a document cannot be scanned by a browser until something
// serves it. So they are served — on loopback, on an ephemeral port, at exactly
// one path, for exactly the length of the scan, and torn down in `finally`
// whether the scan succeeded or threw.
//
// WHY THE ADDRESS CHECK IS THIS LONG. The address arrives from whoever called
// this, and the scan runs on our side of whatever network this is. An address
// that resolves inward — loopback, link-local, the private ranges, the carrier
// range, the multicast space, and their IPv6 spellings including the addresses
// that map an IPv4 one — turns a scan request into a request for something the
// caller could not otherwise reach. Credentials embedded in the address are
// refused for a smaller reason: they would be handed to a browser subprocess and
// end up in its diagnostics.
//
// THE EXPORTED FILE IS CHECKED BEFORE IT IS OPENED, not after. Extension, then
// `lstat` — which does not follow a link — then regular-file, then size. A
// symbolic link passed here would otherwise read whatever it points at with this
// process's rights, and the size is bounded twice: once by what the file system
// reports and once by what was actually read, because those are two different
// numbers when the file changes underneath.
//
// THE PLATFORM'S OWN ANSWER IS NOT TAKEN ON TRUST EITHER. Redirects are refused
// rather than followed, the declared length and the delivered length are both
// bounded, and the campaign the response describes must be the campaign that was
// asked for — a body that answers about a different campaign is a wrong answer,
// not a smaller one.

import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';

import { type CliScanEnvelope, type Severity } from './cli-scan.js';
import { type ProcessRunner } from './process.js';
import { invokeScanner, type BrowserName, type ScannerInvocation } from './scanner.js';

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const BREVO_API_BASE = 'https://api.brevo.com/v3';

export type BrevoScanInput =
  | { readonly kind: 'landing-url'; readonly url: string }
  | { readonly kind: 'campaign-webview-url'; readonly url: string }
  | { readonly kind: 'campaign-html'; readonly path: string }
  | { readonly kind: 'campaign-api'; readonly campaignId: number; readonly apiKey: string };

export interface BrevoScanOptions {
  readonly browser?: BrowserName;
  readonly severityThreshold?: Severity;
  readonly timeoutMs?: number;
  readonly processTimeoutMs?: number;
  readonly outputDir?: string;
  readonly cwd?: string;
  readonly runner?: ProcessRunner;
  readonly fetchImpl?: FetchLike;
}

export interface BrevoScanResult {
  readonly platform: 'brevo';
  readonly mode: BrevoScanInput['kind'];
  readonly source: string;
  readonly scannedUrl: string;
  readonly envelope: CliScanEnvelope;
  readonly process: ScannerInvocation['process'];
  readonly artifactPath?: string;
  readonly gate: {
    readonly status: 'passed' | 'failed';
    readonly exitCode: 0 | 1;
    readonly findings: number;
    readonly severityThreshold: Severity;
  };
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface CampaignHtml {
  readonly html: string;
  readonly label: string;
}

export class BrevoRecipeError extends Error {
  override readonly name = 'BrevoRecipeError';
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0) {
    throw new BrevoRecipeError(`${name} must be a positive integer`);
  }
  return selected;
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  const first = parts[0];
  const second = parts[1];
  if (parts.length !== 4 || first === undefined || second === undefined) return true;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

export function normalizePublicBrevoUrl(value: string): string {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new BrevoRecipeError('Brevo URL input must be a valid absolute URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BrevoRecipeError('Brevo URL input must use http or https');
  }
  if (url.username !== '' || url.password !== '') {
    throw new BrevoRecipeError('Brevo URL input must not contain credentials');
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new BrevoRecipeError('Brevo URL input must be a public host');
  }
  const ipVersion = isIP(hostname.replace(/^\[|\]$/g, ''));
  if (
    (ipVersion === 4 && isPrivateIpv4(hostname)) ||
    (ipVersion === 6 && isPrivateIpv6(hostname))
  ) {
    throw new BrevoRecipeError('Brevo URL input must not target a private or reserved address');
  }
  return url.href;
}

async function readExportedCampaignHtml(path: string, cwd: string): Promise<CampaignHtml> {
  const absolutePath = resolve(cwd, path);
  const extension = extname(absolutePath).toLowerCase();
  if (extension !== '.html' && extension !== '.htm') {
    throw new BrevoRecipeError('Exported campaign path must end in .html or .htm');
  }
  let info;
  try {
    info = await lstat(absolutePath);
  } catch (error) {
    throw new BrevoRecipeError(`Cannot read exported campaign HTML at ${absolutePath}`, {
      cause: error,
    });
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new BrevoRecipeError('Exported campaign path must be a regular, non-symlink file');
  }
  if (info.size <= 0 || info.size > MAX_HTML_BYTES) {
    throw new BrevoRecipeError('Exported campaign HTML must be between 1 byte and 5 MiB');
  }
  const html = await readFile(absolutePath, 'utf8');
  if (Buffer.byteLength(html) > MAX_HTML_BYTES) {
    throw new BrevoRecipeError('Exported campaign HTML exceeds 5 MiB');
  }
  return { html, label: absolutePath };
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BrevoRecipeError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

export async function fetchBrevoCampaignHtml(
  campaignId: number,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<CampaignHtml> {
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
    throw new BrevoRecipeError('Brevo campaign ID must be a positive integer');
  }
  if (
    apiKey.length === 0 ||
    apiKey.length > 4096 ||
    apiKey.trim() !== apiKey ||
    /[\r\n]/.test(apiKey)
  ) {
    throw new BrevoRecipeError('Brevo API key is missing or malformed');
  }
  const endpoint = `${BREVO_API_BASE}/emailCampaigns/${campaignId}?excludeHtmlContent=false`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { accept: 'application/json', 'api-key': apiKey },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new BrevoRecipeError(
      `Brevo campaign API request failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new BrevoRecipeError(
      `Brevo campaign API returned HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES * 2) {
    throw new BrevoRecipeError('Brevo campaign API response exceeds the 10 MiB limit');
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_HTML_BYTES * 2) {
    throw new BrevoRecipeError('Brevo campaign API response exceeds the 10 MiB limit');
  }
  let payload;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new BrevoRecipeError('Brevo campaign API did not return JSON');
  }
  const campaign = recordAt(payload, 'Brevo campaign response');
  if (campaign['id'] !== campaignId) {
    throw new BrevoRecipeError('Brevo campaign response ID does not match the request');
  }
  const html = campaign['htmlContent'];
  if (typeof html !== 'string' || html.length === 0) {
    throw new BrevoRecipeError('Brevo campaign response has no htmlContent');
  }
  if (Buffer.byteLength(html) > MAX_HTML_BYTES) {
    throw new BrevoRecipeError('Brevo campaign htmlContent exceeds 5 MiB');
  }
  const name = campaign['name'];
  return {
    html,
    label:
      typeof name === 'string' && name.length > 0
        ? `Brevo campaign ${campaignId}: ${name}`
        : `Brevo campaign ${campaignId}`,
  };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error === undefined ? resolveClose() : rejectClose(error)));
  });
}

async function serveCampaignHtml(
  html: string,
): Promise<{ readonly url: string; readonly close: () => Promise<void> }> {
  const content = Buffer.from(html, 'utf8');
  const server = createServer((request, response) => {
    if ((request.method !== 'GET' && request.method !== 'HEAD') || request.url !== '/campaign.html') {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-length': String(content.byteLength),
      'content-security-policy':
        "default-src 'self' data: https:; script-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:",
      'x-content-type-options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    await closeServer(server);
    throw new BrevoRecipeError('Unable to determine loopback HTML server address');
  }
  return {
    url: `http://127.0.0.1:${address.port}/campaign.html`,
    close: async () => await closeServer(server),
  };
}

export async function scanBrevo(
  input: BrevoScanInput,
  options: BrevoScanOptions = {},
): Promise<BrevoScanResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const timeoutMs = positiveInteger(options.timeoutMs, 30_000, 'timeoutMs');
  const processTimeoutMs = positiveInteger(
    options.processTimeoutMs,
    timeoutMs + 30_000,
    'processTimeoutMs',
  );
  const browser = options.browser ?? 'chromium';
  const severityThreshold = options.severityThreshold ?? 'moderate';
  const persistentOutput = options.outputDir !== undefined;
  const outputDir = persistentOutput
    ? resolve(cwd, options.outputDir as string)
    : await mkdtemp(join(tmpdir(), 'brevo-ariada-'));
  await mkdir(outputDir, { recursive: true });

  let htmlServer;
  try {
    let targetUrl;
    let source;
    if (input.kind === 'landing-url' || input.kind === 'campaign-webview-url') {
      targetUrl = normalizePublicBrevoUrl(input.url);
      source = targetUrl;
    } else {
      const campaign =
        input.kind === 'campaign-html'
          ? await readExportedCampaignHtml(input.path, cwd)
          : await fetchBrevoCampaignHtml(input.campaignId, input.apiKey, options.fetchImpl);
      htmlServer = await serveCampaignHtml(campaign.html);
      targetUrl = htmlServer.url;
      source = input.kind === 'campaign-html' ? basename(campaign.label) : campaign.label;
    }

    const invocation = await invokeScanner({
      targetUrl,
      outputDir,
      cwd,
      browser,
      severityThreshold,
      timeoutMs,
      processTimeoutMs,
      ...(options.runner === undefined ? {} : { runner: options.runner }),
    });

    return {
      platform: 'brevo',
      mode: input.kind,
      source,
      scannedUrl: targetUrl,
      envelope: invocation.envelope,
      process: invocation.process,
      ...(persistentOutput ? { artifactPath: invocation.artifactPath } : {}),
      gate: {
        status: invocation.envelope.exitCode === 0 ? 'passed' : 'failed',
        exitCode: invocation.envelope.exitCode,
        findings: invocation.envelope.summary.total,
        severityThreshold,
      },
    };
  } finally {
    await htmlServer?.close();
    if (!persistentOutput) await rm(outputDir, { recursive: true, force: true });
  }
}
