// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { isPrivateAddress, isLoopbackName, resolveAndGuard } from '@ariada-org/url-guard';
import type { Page } from 'playwright';

/** Options controlling how a navigation is guarded. */
export interface GuardedNavOptions {
  /** Allow private/loopback destinations (local development only). */
  allowPrivate?: boolean;
  /** Navigation timeout in milliseconds. */
  timeoutMs: number;
}

/**
 * Navigate the page to `url` only after the URL clears the SSRF guard, then
 * verify the page did not land on a private host via an in-page or HTTP
 * redirect. The guard resolves the hostname to all addresses and refuses if any
 * is loopback/private/link-local/reserved (including IPv4-mapped IPv6), so a
 * user cannot make the headless worker reach cloud metadata or internal
 * services. Throws on refusal so the scan aborts rather than silently
 * screenshotting an internal endpoint.
 */
export async function guardedGoto(
  page: Page,
  url: string,
  opts: GuardedNavOptions,
): Promise<{ initialHtml: string }> {
  const guarded = await resolveAndGuard(url, { allowPrivate: opts.allowPrivate === true });
  if (guarded.isErr()) {
    throw new Error(`Refused to scan URL (${guarded.error.kind}): ${url}`);
  }
  const response = await page.goto(url, { waitUntil: 'load', timeout: opts.timeoutMs });

  // The body as it arrived, before any script ran. Whether a page assembles
  // itself in the browser can only be answered by comparing this with what the
  // browser ended up with — the rendered document alone cannot tell you, and a
  // rule that guessed from its length called every short page script-built.
  let initialHtml = '';
  try {
    initialHtml = (await response?.text()) ?? '';
  } catch {
    initialHtml = ''; // a body that cannot be re-read is not a reason to fail
  }

  if (opts.allowPrivate === true) return { initialHtml };
  // A redirect (HTTP or client-side) may have moved us onto a private host that
  // the pre-navigation resolution could not see. Re-check the final location.
  const landedHost = safeHostname(page.url());
  if (landedHost && (isLoopbackName(landedHost) || isPrivateAddress(landedHost))) {
    throw new Error(`Refused: navigation redirected to a private host: ${landedHost}`);
  }
  return { initialHtml };
}

/** Parse a hostname from a URL string, or return null when it is not parseable. */
function safeHostname(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
