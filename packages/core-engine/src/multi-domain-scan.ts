// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createCrossDomainDetector } from './cross-domain-detector.js';
import type {
  CrossSiteAxis,
  Divergence,
  DomainModule,
  InteractionRecord,
  MultiDomainReport,
  PerSiteResult,
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
  const detector = createCrossDomainDetector();

  const sites: string[] = [];
  const domainIds = domains.map((d) => d.id);
  const grid: Record<string, Record<string, Finding[]>> = {};
  const interactions: InteractionRecord[] = [];
  const aggregateFindings: Finding[] = [];
  // Per-domain per-site results, used to drive the optional aggregate hook.
  const perDomainSites = new Map<string, PerSiteResult[]>();

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

      const siteResults = perDomainSites.get(domain.id) ?? [];
      siteResults.push({ site, features, findings });
      perDomainSites.set(domain.id, siteResults);
    }
    grid[site] = perDomain;

    interactions.push(...detector.detect(features, snapshot.scanId));
  }

  // Cross-site aggregate findings: domains that only emerge in aggregate get one
  // pass over every site's per-domain result at report assembly.
  for (const domain of domains) {
    if (!domain.aggregate) continue;
    const siteResults = perDomainSites.get(domain.id) ?? [];
    const aggregated = domain.aggregate(siteResults);
    if (aggregated.length === 0) continue;
    aggregateFindings.push(...aggregated);
  }

  const crossSite = buildCrossSiteAxis(sites, domainIds, grid);

  return {
    sites,
    domains: domainIds,
    grid,
    interactions,
    crossSite,
    ...(aggregateFindings.length > 0 ? { aggregateFindings } : {}),
  };
}

/**
 * Whether a finding is a decision or a request to look.
 *
 * An analyser marks `needsReview` when it could not determine the answer —
 * contrast against a background it cannot resolve, for instance. Those are
 * worth showing and worth a human's time, and they are not evidence that
 * anything is wrong.
 */
function isDecided(finding: Finding): boolean {
  return finding.needsReview !== true;
}

/**
 * Compare each (domain, ruleId) pair across all scanned sites. A pair that fails
 * on every site is systemic; a pair that fails on some sites and passes on others
 * is a divergence (e.g. `.de` fails where `.com` passes).
 *
 * Only decided findings count towards failing. This used to treat any finding as
 * one, so a site whose only findings needed review joined `failingSites`, and
 * when it was the only site scanned `passingSites` came out empty and the rule
 * was promoted to systemic — the strongest statement this engine makes, resting
 * on the weakest evidence it has.
 *
 * Measured on the project's own site: eleven contrast findings, every one of
 * them `needsReview` with a confidence of one half, reported as a systemic
 * failure. All eleven pass when the ratio is computed in a browser — nine at
 * 17.4:1 and two at 4.88:1 against a threshold of 4.5. Nothing was found to
 * fail; something could not be looked at properly, and the two were printed the
 * same way.
 *
 * The undecided findings stay in the grid and in the report. Dropping them would
 * trade one wrong answer for another: those are exactly the places a person
 * should look.
 */
function buildCrossSiteAxis(
  sites: readonly string[],
  domainIds: readonly string[],
  grid: Record<string, Record<string, Finding[]>>,
): CrossSiteAxis {
  const systemic: SystemicIssue[] = [];
  const divergence: Divergence[] = [];

  for (const domain of domainIds) {
    for (const ruleId of decidedRuleIds(sites, domain, grid)) {
      const { failingSites, passingSites } = splitSitesByVerdict(sites, domain, ruleId, grid);

      if (passingSites.length === 0) {
        systemic.push({ domain, ruleId, affectedSites: failingSites });
      } else if (failingSites.length > 0) {
        divergence.push({ domain, ruleId, failingSites, passingSites });
      }
    }
  }

  return { systemic, divergence };
}

/**
 * Every rule this domain decided against on at least one site.
 *
 * A rule that only ever produced undecided findings is not a cross-site question
 * yet: there is nothing to compare between sites, and asking would answer with
 * the confidence of a measurement nobody could take.
 */
function decidedRuleIds(
  sites: readonly string[],
  domain: string,
  grid: Record<string, Record<string, Finding[]>>,
): Set<string> {
  const ruleIds = new Set<string>();
  for (const site of sites) {
    for (const f of grid[site]?.[domain] ?? []) if (isDecided(f)) ruleIds.add(f.ruleId);
  }
  return ruleIds;
}

/**
 * Which sites this rule was decided against, and which it was not.
 *
 * "Not failing" covers both a site with no such finding and a site whose finding
 * needed review — deliberately, because the caller reads an empty passing list
 * as systemic, and an undecided finding is not evidence that everywhere fails.
 */
function splitSitesByVerdict(
  sites: readonly string[],
  domain: string,
  ruleId: string,
  grid: Record<string, Record<string, Finding[]>>,
): { failingSites: string[]; passingSites: string[] } {
  const failingSites: string[] = [];
  const passingSites: string[] = [];
  for (const site of sites) {
    const fails = (grid[site]?.[domain] ?? []).some((f) => f.ruleId === ruleId && isDecided(f));
    if (fails) failingSites.push(site);
    else passingSites.push(site);
  }
  return { failingSites, passingSites };
}
