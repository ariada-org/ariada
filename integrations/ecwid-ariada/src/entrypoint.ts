// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/entrypoint.js` and `dist/entrypoint.d.ts`. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.

import {
  createEcwidTokenExchangeRequest,
  parseEcwidOAuthCallback,
  type EcwidOAuthConfig,
  type EcwidPanelResult,
} from './index.js';

export interface EcwidRedirectResponse {
  status: 302;
  location: string;
  tokenExchange: ReturnType<typeof createEcwidTokenExchangeRequest>;
}

/**
 * Handle the platform's install redirect.
 *
 * The token exchange is returned rather than performed, so the caller decides
 * where the client secret goes.
 *
 * @param searchParams - the callback parameters
 * @param config - the app's credentials
 * @param dashboardUrl - where to send the merchant next
 * @returns the redirect and the request to send
 */
export function handleEcwidRedirect(
  searchParams: URLSearchParams,
  config: EcwidOAuthConfig,
  dashboardUrl: string,
): EcwidRedirectResponse {
  const callback = parseEcwidOAuthCallback(searchParams, config.redirectUri);
  return {
    status: 302,
    location: `${dashboardUrl}?store_id=${callback.storeId}`,
    tokenExchange: createEcwidTokenExchangeRequest(callback, config),
  };
}

/**
 * Render the panel the merchant sees.
 *
 * @param result - the scan result
 * @returns a whole document
 */
export function renderEcwidControlPanel(result: EcwidPanelResult): string {
  const status = result.pass
    ? 'Pass'
    : `${result.totalFindings} finding${result.totalFindings === 1 ? '' : 's'}`;
  const rows = result.pages
    .map(
      (page) =>
        `<li><strong>${escapeHtml(page.kind.toUpperCase())}</strong>: ${
          page.findings.length
        } finding(s) <code>${escapeHtml(page.url)}</code></li>`,
    )
    .join('');
  const report = result.reportLink
    ? `<p><a href="${escapeHtml(result.reportLink)}">Open full Ariada report</a></p>`
    : '';
  return `<main><h1>Ecwid accessibility scan</h1><p>Status: ${status}</p><ul>${rows}</ul>${report}</main>`;
}

/**
 * Escape a value for placing in markup as text.
 *
 * The page addresses come from the merchant's own store, which means from the
 * merchant's own data.
 *
 * @param value - the text
 * @returns the escaped text
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
