// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Rebuilding produces the same declaration, which is how
// the recovery was checked.

import { spawn } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type BigCommercePageType = 'pdp' | 'plp' | 'cart' | 'checkout';
export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface BigCommerceAppManifest {
  schemaVersion: '1.0';
  kind: 'bigcommerce-embedded-app-manifest';
  name: string;
  description: string;
  embedded: true;
  callbacks: { auth: string; load: string; uninstall: string };
  scopes: string[];
}

export interface BigCommerceInstallRequest {
  code: string;
  scope: string;
  context: string;
}

export interface BigCommerceOAuthToken {
  accessToken: string;
  storeHash: string;
  context: string;
}

export interface BigCommerceSessionStore {
  save(token: BigCommerceOAuthToken): Promise<void>;
  delete(storeHash: string): Promise<void>;
}

export interface BigCommerceOAuthClient {
  exchange(input: BigCommerceInstallRequest): Promise<BigCommerceOAuthToken>;
}

export interface StoreInformation {
  secure_url?: unknown;
  domain?: unknown;
}

export type JsonFetcher = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface AriadaFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  eaaRelevant: boolean;
}

export interface PageScanResult {
  pageType: BigCommercePageType;
  url: string;
  findings: AriadaFinding[];
  raw: unknown;
}

export interface BigCommerceScanReport {
  pages: PageScanResult[];
  reportUrl?: string;
}

export type AriadaRunner = (url: string) => Promise<unknown>;

const pageTypes: BigCommercePageType[] = ['pdp', 'plp', 'cart', 'checkout'];
const severities: Severity[] = ['minor', 'moderate', 'serious', 'critical'];

/**
 * The value as a trimmed non-empty string, or an error naming which one it was.
 *
 * @param value - the candidate
 * @param label - what to call it if it is missing
 * @returns the trimmed value
 */
function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

/**
 * Read an install callback's parameters, from a query string or a plain object.
 *
 * @param input - the callback parameters
 * @returns the three fields BigCommerce sends on install
 */
export function parseInstallRequest(
  input: URLSearchParams | Record<string, unknown>,
): BigCommerceInstallRequest {
  const get = (key: string): unknown =>
    input instanceof URLSearchParams ? input.get(key) : input[key];
  return {
    code: nonEmpty(get('code'), 'code'),
    scope: nonEmpty(get('scope'), 'scope'),
    context: nonEmpty(get('context'), 'context'),
  };
}

/**
 * Decode one base64url segment.
 *
 * @param value - the segment
 * @returns its bytes
 */
function decodeBase64Url(value: string): Buffer {
  return Buffer.from(
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4),
    'base64',
  );
}

/**
 * Verify a BigCommerce signed payload and return what it carries.
 *
 * The comparison is time-constant and the algorithm is pinned: a token that
 * names its own algorithm is a token that can ask to be trusted for free.
 *
 * @param token - the signed payload
 * @param secret - the app's client secret
 * @returns the decoded payload
 */
export function verifySignedPayloadJwt(token: string, secret: string): Record<string, unknown> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature)
    throw new Error('Invalid BigCommerce signed payload JWT');
  const header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8')) as {
    alg?: string;
  };
  if (header.alg !== 'HS256') throw new Error('BigCommerce signed payload must use HS256');
  const expected = createHmac('sha256', nonEmpty(secret, 'client secret'))
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actual = decodeBase64Url(encodedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error('Invalid BigCommerce signed payload signature');
  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8')) as Record<
    string,
    unknown
  >;
  if (!payload || typeof payload !== 'object')
    throw new Error('Invalid BigCommerce signed payload');
  return payload;
}

/**
 * The store hash out of a `stores/{hash}` context.
 *
 * @param context - the context string
 * @returns the store hash
 */
export function storeHashFromContext(context: string): string {
  const match = /^stores\/([a-z0-9]+)$/i.exec(nonEmpty(context, 'context'));
  const storeHash = match?.[1];
  if (!storeHash) throw new Error('BigCommerce context must be stores/{store_hash}');
  return storeHash;
}

/**
 * Exchange the install code for a token and remember it.
 *
 * @param input - the install callback parameters
 * @param oauth - the token exchange
 * @param sessions - where tokens are kept
 * @returns the token
 */
export async function handleInstall(
  input: BigCommerceInstallRequest,
  oauth: BigCommerceOAuthClient,
  sessions: BigCommerceSessionStore,
): Promise<BigCommerceOAuthToken> {
  const token = await oauth.exchange(input);
  if (storeHashFromContext(token.context) !== token.storeHash)
    throw new Error('OAuth token store does not match context');
  await sessions.save(token);
  return token;
}

/**
 * Ask the platform where the storefront lives.
 *
 * @param storeHash - the store
 * @param accessToken - its token
 * @param fetcher - how to make the request
 * @returns the storefront URL without a trailing slash
 */
export async function resolveStorefrontUrl(
  storeHash: string,
  accessToken: string,
  fetcher: JsonFetcher,
): Promise<string> {
  const response = await fetcher(
    `https://api.bigcommerce.com/stores/${encodeURIComponent(
      nonEmpty(storeHash, 'store hash'),
    )}/v2/store/information`,
    {
      headers: {
        'X-Auth-Token': nonEmpty(accessToken, 'access token'),
        Accept: 'application/json',
      },
    },
  );
  if (!response.ok)
    throw new Error(`BigCommerce Store Information request failed (${response.ok ? 200 : 502})`);
  const body = (await response.json()) as StoreInformation;
  const candidate = typeof body.secure_url === 'string' ? body.secure_url : body.domain;
  const url = new URL(nonEmpty(candidate, 'storefront URL'));
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('BigCommerce storefront URL must use http(s)');
  return url.toString().replace(/\/$/, '');
}

/**
 * A runner that shells out to the command-line scanner.
 *
 * Exit code one is a scan that found something, not a scan that failed, so both
 * zero and one are read as an answer.
 *
 * @param binary - the executable to call
 * @returns a runner
 */
export function createAriadaCliRunner(
  binary: string = process.env['ARIADA_CLI'] ?? 'ariada',
): AriadaRunner {
  return (url: string) =>
    new Promise((resolve, reject) => {
      const child = spawn(
        binary,
        ['scan', url, '--domains', 'accessibility', '--format', 'json'],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0 && code !== 1)
          return reject(new Error(`Ariada CLI failed (${code}): ${stderr.trim()}`));
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error('Ariada CLI returned invalid JSON'));
        }
      });
    });
}

/**
 * The findings array out of whatever shape the scanner returned.
 *
 * @param raw - the scanner's output
 * @returns the findings, or none
 */
function rawFindings(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'object') return [];
  const value = raw as { findings?: unknown; report?: { findings?: unknown } };
  return Array.isArray(value.findings)
    ? value.findings
    : Array.isArray(value.report?.findings)
      ? value.report.findings
      : [];
}

/**
 * Normalise scanner output into findings this app can render.
 *
 * @param raw - the scanner's output
 * @returns the findings
 */
export function parseFindings(raw: unknown): AriadaFinding[] {
  return rawFindings(raw).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const finding = item as Record<string, unknown>;
    const severity = severities.includes(finding['severity'] as Severity)
      ? (finding['severity'] as Severity)
      : 'moderate';
    const ruleId =
      typeof finding['ruleId'] === 'string'
        ? finding['ruleId']
        : typeof finding['id'] === 'string'
          ? finding['id']
          : 'unknown';
    return [
      {
        ruleId,
        severity,
        message: typeof finding['message'] === 'string' ? finding['message'] : ruleId,
        eaaRelevant: finding['eaaRelevant'] === true || finding['eaa'] === true,
      },
    ];
  });
}

/**
 * Scan the four storefront page types.
 *
 * @param pageUrls - one URL per page type
 * @param runner - how to scan
 * @param reportUrl - an optional link to the full report
 * @returns the per-page results
 */
export async function scanPages(
  pageUrls: Record<BigCommercePageType, string>,
  runner: AriadaRunner,
  reportUrl?: string,
): Promise<BigCommerceScanReport> {
  const pages = await Promise.all(
    pageTypes.map(async (pageType) => {
      const url = new URL(nonEmpty(pageUrls[pageType], `${pageType} URL`));
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error(`${pageType} URL must use http(s)`);
      const raw = await runner(url.toString());
      return { pageType, url: url.toString(), findings: parseFindings(raw), raw };
    }),
  );
  return { pages, ...(reportUrl ? { reportUrl } : {}) };
}

/**
 * Escape a value for placing in markup as text.
 *
 * @param value - the text
 * @returns the escaped text
 */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );
}

/**
 * Render the panel the merchant sees inside the platform.
 *
 * @param report - the scan results
 * @returns a whole HTML document
 */
export function renderFindingsPanel(report: BigCommerceScanReport): string {
  const sections = report.pages
    .map(
      (page) =>
        `<section><h2>${page.pageType.toUpperCase()} <span>${
          page.findings.length ? 'FAIL' : 'PASS'
        }</span></h2>${
          page.findings.length
            ? `<ul>${page.findings
                .slice(0, 5)
                .map(
                  (finding) =>
                    `<li><strong>${escapeHtml(finding.ruleId)}</strong> (${
                      finding.severity
                    }) ${escapeHtml(finding.message)}${
                      finding.eaaRelevant ? ' <em>EAA / EN 301 549</em>' : ''
                    }</li>`,
                )
                .join('')}</ul>`
            : '<p>No findings.</p>'
        }</section>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ariada for BigCommerce</title></head><body><main><h1>Storefront accessibility</h1>${sections}${
    report.reportUrl
      ? `<p><a href="${escapeHtml(report.reportUrl)}">Open full Ariada report</a></p>`
      : ''
  }</main></body></html>`;
}

export type AppRequest = { path: '/auth' | '/load' | '/uninstall' | '/app'; query?: URLSearchParams };
export type AppResponse = { status: number; headers: Record<string, string>; body: string };

/**
 * The app's four callbacks behind one entry point.
 *
 * @param deps - the token exchange, the session store, the client secret and an
 *   optional report to render
 * @returns a request handler
 */
export function createEntrypoint(deps: {
  oauth: BigCommerceOAuthClient;
  sessions: BigCommerceSessionStore;
  clientSecret: string;
  report?: BigCommerceScanReport;
}): (request: AppRequest) => Promise<AppResponse> {
  return async (request: AppRequest): Promise<AppResponse> => {
    if (request.path === '/auth') {
      const token = await handleInstall(
        parseInstallRequest(request.query ?? new URLSearchParams()),
        deps.oauth,
        deps.sessions,
      );
      return {
        status: 302,
        headers: { location: `/app?store_hash=${encodeURIComponent(token.storeHash)}` },
        body: '',
      };
    }
    if (request.path === '/load') {
      verifySignedPayloadJwt(
        nonEmpty(request.query?.get('signed_payload_jwt'), 'signed_payload_jwt'),
        deps.clientSecret,
      );
      return {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: renderFindingsPanel(deps.report ?? { pages: [] }),
      };
    }
    if (request.path === '/uninstall') {
      const payload = verifySignedPayloadJwt(
        nonEmpty(request.query?.get('signed_payload_jwt'), 'signed_payload_jwt'),
        deps.clientSecret,
      );
      await deps.sessions.delete(storeHashFromContext(nonEmpty(payload['context'], 'context')));
      return { status: 204, headers: {}, body: '' };
    }
    return {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: renderFindingsPanel(deps.report ?? { pages: [] }),
    };
  };
}
