// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type {
  ConflictFinding,
  ConflictSignature,
  Domain,
  DomainAnalyzer,
  Finding,
} from './types.js';

/**
 * Cross-domain interaction detector. For MVP (a11y only) this returns [] —
 * the code path is exercised so adding more analyzers light up matches.
 */
export interface CrossDomainDetector {
  detect(
    findingsByDomain: ReadonlyMap<Domain, readonly Finding[]>,
    scanId: string,
  ): ConflictFinding[];
}

/**
 *
 */
export function createCrossDomainDetector(
  analyzers: readonly DomainAnalyzer[],
): CrossDomainDetector {
  const signatures: ConflictSignature[] = [];
  for (const a of analyzers) {
    if (a.conflictSignatures) signatures.push(...a.conflictSignatures);
  }

  return {
    detect(
      findingsByDomain: ReadonlyMap<Domain, readonly Finding[]>,
      scanId: string,
    ): ConflictFinding[] {
      const out: ConflictFinding[] = [];
      for (const sig of signatures) {
        const hits = sig.match(findingsByDomain);
        if (!hits || hits.length === 0) continue;
        for (const hit of hits) {
          out.push({
            ...hit,
            scanId,
            domain: 'cross' as const,
            conflictingDomains: [...sig.domains],
            participants: [hit.element],
          });
        }
      }
      return out;
    },
  };
}
