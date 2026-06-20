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
 * Resolve the domains to run. Built-in domains are always available; additional
 * config-path modules (user-pluggable, trusted) are merged in by id, the first
 * occurrence winning, exactly as the engine's discovery contract specifies.
 */
export function resolveDomains(extraModules: readonly DomainModule[] = []): DomainModule[] {
  return discoverDomains({ includeBuiltins: true, modules: extraModules });
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
