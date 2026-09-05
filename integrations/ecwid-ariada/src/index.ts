// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/index.js` and `dist/index.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

export const ECWID_SOURCE = 'ecwid.control-panel';
export const ECWID_OAUTH_TOKEN_URL = 'https://my.ecwid.com/api/oauth/token';

export type EcwidPageKind = 'pdp' | 'plp' | 'cart' | 'checkout';
export type FindingSeverity = 'minor' | 'moderate' | 'serious' | 'critical' | 'unknown';

export interface EcwidOAuthCallback {
  code: string;
  storeId: number;
  redirectUri: string;
}

export interface EcwidOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenExchangeRequest {
  url: string;
  headers: { 'content-type': 'application/x-www-form-urlencoded' };
  body: URLSearchParams;
}

export interface EcwidStoreProfile {
  generalInfo?: {
    storeId?: number;
    storeUrl?: string;
    starterSite?: { generatedUrl?: string; customDomain?: string };
  };
}

export interface EcwidScanTarget {
  kind: EcwidPageKind;
  url: string;
}

export interface CliFinding {
  id?: string;
  ruleId?: string;
  message?: string;
  severity?: string;
  eaa?: boolean;
  en301549?: string | boolean;
  tags?: string[];
  element?: { selector?: string };
}

export interface CliReport {
  url?: string;
  report?: { grid?: Record<string, { accessibility?: CliFinding[] }> };
  grid?: Record<string, { accessibility?: CliFinding[] }>;
}

export interface EcwidPageResult {
  kind: EcwidPageKind;
  url: string;
  findings: CliFinding[];
}

export interface EcwidPanelResult {
  source: typeof ECWID_SOURCE;
  boundary: 'ecwid-storefront';
  pass: boolean;
  reportLink?: string;
  pages: EcwidPageResult[];
  totalFindings: number;
  topViolations: Array<{ ruleId: string; message: string; count: number; eaa: boolean }>;
}

/**
 * Read an install callback, refusing anything that is not a real store.
 *
 * The store identifier must be a positive safe integer: it goes into the token
 * exchange address, and a value that survives `Number()` without being one of
 * those is a value that would build a request to somewhere else.
 *
 * @param params - the callback parameters
 * @param redirectUri - the address the platform called back to
 * @returns the callback
 */
export function parseEcwidOAuthCallback(
  params: URLSearchParams,
  redirectUri: string,
): EcwidOAuthCallback {
  const code = params.get('code');
  const storeId = Number(params.get('store_id'));
  if (!code || !Number.isSafeInteger(storeId) || storeId <= 0) {
    throw new Error('Ecwid OAuth callback requires a code and positive store_id');
  }
  return { code, storeId, redirectUri };
}

/**
 * The token exchange request, built but not sent.
 *
 * Returning the request rather than performing it keeps the client secret out
 * of this module's control flow: whoever holds the secret decides when and from
 * where it travels.
 *
 * @param callback - the install callback
 * @param config - the app's credentials
 * @returns the request to send
 */
export function createEcwidTokenExchangeRequest(
  callback: EcwidOAuthCallback,
  config: EcwidOAuthConfig,
): TokenExchangeRequest {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: callback.code,
    redirect_uri: callback.redirectUri,
    grant_type: 'authorization_code',
  });
  return {
    url: `${ECWID_OAUTH_TOKEN_URL}/${callback.storeId}`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  };
}

/**
 * Where the storefront lives, from whichever of the three fields carries it.
 *
 * @param profile - the store profile
 * @returns the storefront root
 */
export function resolveEcwidStorefrontUrl(profile: EcwidStoreProfile): string {
  const candidate =
    profile.generalInfo?.storeUrl ??
    profile.generalInfo?.starterSite?.customDomain ??
    profile.generalInfo?.starterSite?.generatedUrl;
  if (!candidate) throw new Error('Ecwid store profile has no storefront URL');
  const url = new URL(candidate);
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('Ecwid storefront URL must be http(s)');
  return new URL('/', url).href;
}

/**
 * The four storefront pages to scan.
 *
 * @param profile - the store profile
 * @param paths - overrides, when the store uses different paths
 * @returns one target per page kind
 */
export function createEcwidScanTargets(
  profile: EcwidStoreProfile,
  paths: Partial<Record<EcwidPageKind, string>> = {},
): EcwidScanTarget[] {
  const base = resolveEcwidStorefrontUrl(profile);
  const defaults: Record<EcwidPageKind, string> = {
    pdp: 'products',
    plp: 'products',
    cart: 'cart',
    checkout: 'checkout',
  };
  return (Object.keys(defaults) as EcwidPageKind[]).map((kind) => ({
    kind,
    url: new URL(paths[kind] ?? defaults[kind], base).href,
  }));
}

/**
 * The command line for one page.
 *
 * @param target - the page
 * @param outputDir - where the scanner should write
 * @returns the arguments
 */
export function buildEcwidCliArgs(target: EcwidScanTarget, outputDir = './ariada-output'): string[] {
  return [
    'scan',
    target.url,
    '--domains',
    'accessibility',
    '--browser',
    'chromium',
    '--format',
    'json',
    '--severity-threshold',
    'serious',
    '--timeout-ms',
    '30000',
    '--output-dir',
    outputDir,
  ];
}

export type CliRunner = (
  binary: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

/**
 * Scan every target, one after another.
 *
 * In sequence rather than together: these are four pages of one merchant's
 * shop, and four browsers at once against a small store is a load test nobody
 * asked for.
 *
 * @param targets - the pages
 * @param runner - how commands are run
 * @param outputDir - where the scanner should write
 * @returns the panel result
 */
export async function runEcwidScan(
  targets: EcwidScanTarget[],
  runner: CliRunner,
  outputDir = './ariada-output',
): Promise<EcwidPanelResult> {
  const pages: EcwidPageResult[] = [];
  for (const target of targets) {
    const result = await runner('ariada', buildEcwidCliArgs(target, outputDir));
    pages.push({
      kind: target.kind,
      url: target.url,
      findings: parseEcwidCliFindings(JSON.parse(result.stdout) as CliReport, target.url),
    });
  }
  return renderEcwidFindings(pages);
}

/**
 * The findings for one page out of a report's grid.
 *
 * @param report - the report
 * @param url - the page
 * @returns its findings, or none
 */
export function parseEcwidCliFindings(report: CliReport, url: string): CliFinding[] {
  const grid = report.report?.grid ?? report.grid ?? {};
  return grid[url]?.accessibility ?? [];
}

/**
 * Gather the pages into one result, with the rules ranked by how often they
 * were broken.
 *
 * Ties break on the rule identifier so the order is the same every run: a
 * merchant comparing two scans should see a list that moved because the site
 * moved.
 *
 * @param pages - the per-page results
 * @param reportLink - an optional link to the full report
 * @returns the panel result
 */
export function renderEcwidFindings(
  pages: EcwidPageResult[],
  reportLink?: string,
): EcwidPanelResult {
  const allFindings = pages.flatMap((page) => page.findings);
  const counts = new Map<string, { ruleId: string; message: string; count: number; eaa: boolean }>();
  for (const finding of allFindings) {
    const ruleId = finding.ruleId ?? finding.id ?? 'unknown-rule';
    const current = counts.get(ruleId) ?? {
      ruleId,
      message: finding.message ?? 'Accessibility finding',
      count: 0,
      eaa: false,
    };
    current.count += 1;
    current.eaa ||=
      finding.eaa === true ||
      finding.en301549 === true ||
      finding.en301549 !== undefined ||
      finding.tags?.includes('eaa') === true;
    counts.set(ruleId, current);
  }
  return {
    source: ECWID_SOURCE,
    boundary: 'ecwid-storefront',
    pass: allFindings.length === 0,
    ...(reportLink ? { reportLink } : {}),
    pages,
    totalFindings: allFindings.length,
    topViolations: [...counts.values()].sort(
      (left, right) => right.count - left.count || left.ruleId.localeCompare(right.ruleId),
    ),
  };
}
