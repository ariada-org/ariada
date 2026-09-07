// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/remote/handler.js` and its declaration. The source this
// was built from was never committed; the compiled output is `tsc` with the
// types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// TWO TOKENS, TWO DIFFERENT THINGS. The invocation token says which app is
// calling and is verified against the platform's keys; the user token says who
// is asking, and is passed on so the export happens with that person's own
// permission. Neither substitutes for the other, and both are required before
// anything is read.
//
// THE ERROR IS TRANSLATED RATHER THAN FORWARDED, AND THAT IS DELIBERATE. A
// failed verification answers 401 without saying which of the five checks failed
// — the difference between "wrong audience" and "wrong content identifier" is
// useful mostly to somebody probing. A refused export answers 403 as a page the
// user cannot read, which is the true answer and not an error. Everything else
// is 502 with the message clipped, because a message that came from somewhere
// else is not this service's to publish at length.
//
// The dependencies are a parameter with a default, which is how anything here
// can be tested at all: the platform's keys, a live Confluence and a browser are
// three things a test cannot have.

import type { ForgeClaims, ScanResult, Severity } from '../shared/types.js';

import { verifyForgeInvocation } from './auth.js';
import { fetchRenderedPage } from './confluence.js';
import type { RenderedPage } from './confluence.js';
import { scanHtmlDocument } from './scanner.js';



export interface RemoteRequest {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface RemoteResponse {
  status: number;
  body: ScanResult | { error: string; code: string };
}

export interface HandlerDependencies {
  verify(token: string, appId: string): Promise<ForgeClaims>;
  fetchPage(claims: ForgeClaims, userToken: string): Promise<RenderedPage>;
  scan(page: RenderedPage, threshold: Severity): Promise<ScanResult>;
}

const defaults: HandlerDependencies = {
  verify: verifyForgeInvocation,
  fetchPage: fetchRenderedPage,
  scan: (page, threshold) => scanHtmlDocument(page.descriptor, page.html, { severityThreshold: threshold }),
};

function header(request: RemoteRequest, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function threshold(body: unknown): Severity {
  if (!body || typeof body !== 'object') return 'moderate';
  const value = (body as Record<string, unknown>)['severityThreshold'];
  return value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor' ? value : 'moderate';
}

export async function handleScanRequest(
  request: RemoteRequest,
  appId: string,
  dependencies: HandlerDependencies = defaults,
): Promise<RemoteResponse> {
  const authorization = header(request, 'authorization');
  const userToken = header(request, 'x-forge-oauth-user');
  if (!authorization?.startsWith('Bearer ') || !userToken) {
    return { status: 401, body: { code: 'FORGE_AUTH_REQUIRED', error: 'A verified Forge invocation and user token are required.' } };
  }
  try {
    const claims = await dependencies.verify(authorization.slice(7), appId);
    const page = await dependencies.fetchPage(claims, userToken);
    return { status: 200, body: await dependencies.scan(page, threshold(request.body)) };
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Remote scan failed';
    if (/FIT|token|invocation|app ID/i.test(message)) {
      return { status: 401, body: { code: 'FORGE_AUTH_INVALID', error: 'Forge invocation validation failed.' } };
    }
    if (/Confluence page export failed with HTTP 40[134]/.test(message)) {
      return { status: 403, body: { code: 'PAGE_NOT_ACCESSIBLE', error: 'The invoking user cannot export this Confluence page.' } };
    }
    return { status: 502, body: { code: 'SCAN_FAILED', error: message.slice(0, 500) } };
  }
}
