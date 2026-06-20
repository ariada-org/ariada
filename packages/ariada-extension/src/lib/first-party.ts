// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// First-party URL guard. When the user adds a URL to the scan queue whose
// registered domain (TLD+1) matches the extension's own origin, the guard
// triggers a confirmation step to avoid accidental scanning of the user's own
// properties without explicit intent.
//
// The implementation uses a simple TLD+1 heuristic (last two dot-separated
// parts of the hostname) rather than the Public Suffix List, which adds ~50 KB
// to the bundle. A fuller implementation using the Public Suffix List is
// deferred to a future release.

/**
 * Extract the registered domain (TLD+1) from a URL string using the simple
 * last-two-parts heuristic. Returns null for non-http/https URLs or URLs whose
 * hostname cannot be parsed.
 *
 * Examples:
 *   'https://www.example.co.uk/path' → 'co.uk' (heuristic; PSL would give 'example.co.uk')
 *   'https://brand.example.com/'    → 'example.com'
 *   'https://sub.brand.example.com' → 'example.com'
 */
export function registeredDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    const parts = parsed.hostname.split('.');
    if (parts.length < 2) return null;
    return parts.slice(-2).join('.');
  } catch {
    return null;
  }
}

/**
 * Returns true when the two URLs share the same registered domain (TLD+1) —
 * i.e. both are "first-party" relative to each other.
 *
 * Used to detect when a queued URL belongs to the same property as the one
 * already being scanned, or when the anchor URL's registered domain matches
 * a queued URL. The caller presents a confirmation prompt when this returns
 * true.
 */
export function isSameRegisteredDomain(urlA: string, urlB: string): boolean {
  const a = registeredDomain(urlA);
  const b = registeredDomain(urlB);
  if (a === null || b === null) return false;
  return a === b;
}

/**
 * Filter a list of URLs into those that share the registered domain of the
 * anchor URL (first-party) and those that do not (third-party). The result
 * lets the side panel present a targeted confirmation only for first-party
 * additions.
 */
export function partitionByRegisteredDomain(
  anchorUrl: string,
  candidates: readonly string[],
): { firstParty: string[]; thirdParty: string[] } {
  const firstParty: string[] = [];
  const thirdParty: string[] = [];
  for (const url of candidates) {
    if (isSameRegisteredDomain(anchorUrl, url)) {
      firstParty.push(url);
    } else {
      thirdParty.push(url);
    }
  }
  return { firstParty, thirdParty };
}
