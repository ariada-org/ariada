// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createMLCrossDomainDetector } from './ml-cross-domain.js';
import type {
  CrossSiteAxis,
  Divergence,
  DomainModule,
  InteractionRecord,
  MultiDomainReport,
  PropertySnapshot,
  SystemicIssue,
} from './domain-contract.js';
import { createSharedWalker } from './shared-walker.js';
import type { Finding } from './types.js';

/**
 *
 */
export interface MultiDomainScanInput {
  /** One captured snapshot per scanned site. */
  snapshots: readonly PropertySnapshot[];
  /** The domains to evaluate against every site. */
  domains: readonly DomainModule[];
}

/**
 * Run a multi-domain scan over several sites. For each site, one shared pass
 * produces the feature set; every domain then evaluates it deterministically into
 * findings. The cross-domain detector predicts interactions per site, and the
 * cross-site axis compares the same domain across sites (systemic vs divergent
 * failures). The result is the unified {@link MultiDomainReport} every renderer
 * and platform plugin consumes.
 */
export async function runMultiDomainScan(
  input: MultiDomainScanInput,
): Promise<MultiDomainReport> {
  const { snapshots, domains } = input;
  const detector = createMLCrossDomainDetector();

  const sites: string[] = [];
  const domainIds = domains.map((d) => d.id);
  const grid: Record<string, Record<string, Finding[]>> = {};
  const interactions: InteractionRecord[] = [];

  for (const snapshot of snapshots) {
    const site = snapshot.url;
    sites.push(site);

    const { features } = await createSharedWalker({ snapshot, domains });

    const perDomain: Record<string, Finding[]> = {};
    for (const domain of domains) {
      const findings = domain
        .evaluate(features)
        .map((f) => ({ ...f, scanId: snapshot.scanId }));
      perDomain[domain.id] = findings;
    }
    grid[site] = perDomain;

    interactions.push(...detector.detect(features, snapshot.scanId));
  }

  const crossSite = buildCrossSiteAxis(sites, domainIds, grid);

  return {
    sites,
    domains: domainIds,
    grid,
    interactions,
    crossSite,
  };
}

/**
 * Compare each (domain, ruleId) pair across all scanned sites. A pair that fails
 * on every site is systemic; a pair that fails on some sites and passes on others
 * is a divergence (e.g. `.de` fails where `.com` passes).
 */
function buildCrossSiteAxis(
  sites: readonly string[],
  domainIds: readonly string[],
  grid: Record<string, Record<string, Finding[]>>,
): CrossSiteAxis {
  const systemic: SystemicIssue[] = [];
  const divergence: Divergence[] = [];

  for (const domain of domainIds) {
    // Collect every ruleId this domain produced on any site.
    const ruleIds = new Set<string>();
    for (const site of sites) {
      for (const f of grid[site]?.[domain] ?? []) ruleIds.add(f.ruleId);
    }

    for (const ruleId of ruleIds) {
      const failingSites: string[] = [];
      const passingSites: string[] = [];
      for (const site of sites) {
        const fails = (grid[site]?.[domain] ?? []).some((f) => f.ruleId === ruleId);
        if (fails) failingSites.push(site);
        else passingSites.push(site);
      }

      if (passingSites.length === 0) {
        systemic.push({ domain, ruleId, affectedSites: failingSites });
      } else if (failingSites.length > 0) {
        divergence.push({ domain, ruleId, failingSites, passingSites });
      }
    }
  }

  return { systemic, divergence };
}
