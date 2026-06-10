// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { accessibilityDomain } from './domains/accessibility.js';
import type { DomainModule } from './domain-contract.js';

/**
 * Options controlling which discovery paths run inside the engine.
 *
 * Built-in domains (the bundled reference domains) and `modules` (the config
 * path) are resolved here without touching the filesystem, so this stays usable
 * in browser surfaces. The npm-convention filesystem path — scanning for
 * `ariada-domain-*` packages — lives in the Node-capable multi-domain package
 * and feeds its results in through `modules`.
 *
 * Results are de-duplicated by `id`: built-in first, then config — the first
 * occurrence of an id wins.
 */
export interface DomainDiscoveryOptions {
  /**
   * Pre-resolved domain modules to include: config-supplied domains and any
   * modules a Node-side scanner already imported from `ariada-domain-*` packages.
   */
  modules?: readonly DomainModule[];
  /** Set false to skip the bundled built-in domains (default true). */
  includeBuiltins?: boolean;
}

/** The bundled, always-available domains. */
const BUILTIN_DOMAINS: readonly DomainModule[] = [accessibilityDomain];

/** Matches the npm package-naming convention for a third-party domain. */
export const DOMAIN_PACKAGE_CONVENTION = /^(@[^/]+\/)?ariada-domain-/;

/**
 * Decide whether a module value implements the {@link DomainModule} contract.
 * Exported so a Node-side package scanner can reuse the same shape check when
 * importing third-party `ariada-domain-*` packages.
 */
export function isDomainModule(value: unknown): value is DomainModule {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['title'] === 'string' &&
    typeof v['version'] === 'string' &&
    typeof v['extractors'] === 'object' &&
    v['extractors'] !== null &&
    typeof v['evaluate'] === 'function'
  );
}

/**
 * De-duplicate domain modules by id, keeping the first occurrence. Exported so a
 * Node-side scanner can merge filesystem-discovered modules with built-ins and
 * config under the same dedup rule.
 */
export function dedupeDomainsById(modules: readonly DomainModule[]): DomainModule[] {
  const seen = new Set<string>();
  const out: DomainModule[] = [];
  for (const m of modules) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/**
 * Discover the domain modules to run from the built-in set and the config path.
 * The npm-convention filesystem path is handled by the Node-capable multi-domain
 * package, which passes its imported modules in through `modules`. The returned
 * list is de-duplicated by id.
 */
export function discoverDomains(opts: DomainDiscoveryOptions): DomainModule[] {
  const collected: DomainModule[] = [];

  if (opts.includeBuiltins ?? true) {
    collected.push(...BUILTIN_DOMAINS);
  }

  if (opts.modules) {
    collected.push(...opts.modules);
  }

  return dedupeDomainsById(collected);
}
