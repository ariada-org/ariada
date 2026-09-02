// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
  discoverDomains,
  runMultiDomainScan,
  type DomainModule,
  type MultiDomainReport,
  type PropertySnapshot,
} from '@ariada-org/core-engine';

/**
 * Domains that cannot run truthfully from a page-context snapshot. A content
 * script cannot read HTTP response headers or transport-security metadata, so
 * the security domain — which decides solely from those headers — would flag
 * "CSP absent" / "HSTS absent" on every page even when the site sets them. That
 * is a false accusation, not a missing result, so we do not run it here. The
 * command-line tool (real CDP + network) runs the full domain set unchanged.
 */
const BROWSER_UNAVAILABLE_DOMAINS = new Set<string>(['security']);

/**
 * Resolve the domains to run. Built-in domains are always available; additional
 * config-path modules (user-pluggable, trusted) are merged in by id, the first
 * occurrence winning, exactly as the engine's discovery contract specifies.
 * Domains that cannot be evaluated truthfully from a page-context snapshot are
 * excluded (see {@link BROWSER_UNAVAILABLE_DOMAINS}).
 */
export function resolveDomains(extraModules: readonly DomainModule[] = []): DomainModule[] {
  return discoverDomains({ includeBuiltins: true, modules: extraModules }).filter(
    (d) => !BROWSER_UNAVAILABLE_DOMAINS.has(d.id),
  );
}

/**
 * Run a multi-domain scan over one or more captured snapshots and return the
 * unified report the side-panel grid renders. The engine performs exactly one
 * shared DOM pass per snapshot regardless of how many domains are registered.
 */
export async function scanSnapshots(
  snapshots: readonly PropertySnapshot[],
  extraModules: readonly DomainModule[] = [],
): Promise<MultiDomainReport> {
  const domains = resolveDomains(extraModules);
  return runMultiDomainScan({ snapshots, domains });
}
