// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import type { DomainAnalyzer } from '@ariada-org/core-engine';

/**
 * Returns true when the current window origin matches the document's URL
 * origin — indicating a same-origin (first-party) scan context.
 *
 * When the two origins differ, only built-in domains shipped at package
 * build time should be active. This prevents a cross-origin script from
 * dynamically importing user-supplied analyzer paths.
 */
export function isSameOrigin(windowOrigin: string, documentUrl: string): boolean {
  try {
    const docOrigin = new URL(documentUrl).origin;
    return windowOrigin === docOrigin;
  } catch {
    // Unparseable URL (e.g. about:blank) — treat as cross-origin for safety.
    return false;
  }
}

/**
 * When the scan context is cross-origin, reduce the `analyzers` list to only
 * those that are built-in (shipped with the package). Built-in analyzers are
 * identified by the `builtIn` property being `true`.
 *
 * @param analyzers - The full list of requested analyzers.
 * @param crossOrigin - Whether the scan is running in a cross-origin context.
 * @returns The filtered (or original) list, and a flag indicating whether
 *   filtering was applied.
 */
export function applyFirstPartyGuard(
  analyzers: DomainAnalyzer[],
  crossOrigin: boolean,
): { filtered: DomainAnalyzer[]; firstPartyOnly: boolean } {
  if (!crossOrigin) {
    return { filtered: analyzers, firstPartyOnly: false };
  }
  // In cross-origin context, keep only built-in analyzers.
  const filtered = analyzers.filter(
    (a): boolean => (a as DomainAnalyzer & { builtIn?: boolean }).builtIn === true,
  );
  return { filtered, firstPartyOnly: true };
}
