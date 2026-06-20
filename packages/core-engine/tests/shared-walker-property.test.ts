// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Property-based tests for the single-pass shared walker.
//
// These tests use fast-check to assert the fundamental invariant:
// the traversal count is always exactly 1 regardless of the number
// of domains or elements registered in the shared walker.

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type {
  DomainModule,
  ElementHandle,
  ExtractedFeatures,
  FeatureSink,
  PropertySnapshot,
} from '../src/domain-contract.js';
import { createSharedWalker } from '../src/shared-walker.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a PropertySnapshot with N synthetic elements. */
function snapshotArb(): fc.Arbitrary<PropertySnapshot> {
  return fc.integer({ min: 0, max: 20 }).chain((elementCount) => {
    const selectors = Array.from({ length: elementCount }, (_, i) => `el-${i}`);
    return fc.constant({
      scanId: 'prop-test',
      url: 'http://prop.test/',
      timestamp: 0,
      html: selectors.map((s) => `<div class="${s}"></div>`).join(''),
      headers: {},
      cookies: [],
      networkResources: [],
      axTree: [],
      domOutline: selectors.map((sel, idx) => ({
        backendNodeId: idx + 1,
        nodeName: 'DIV',
        selector: sel,
      })),
      perfMetrics: {},
      timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
    } satisfies PropertySnapshot);
  });
}

/** Generate an array of 1–10 counting domain modules. */
function domainsArb(): fc.Arbitrary<Array<DomainModule & { visits: number[] }>> {
  return fc.integer({ min: 1, max: 10 }).map((count) =>
    Array.from({ length: count }, (_, i) => {
      const visits: number[] = [];
      const module: DomainModule & { visits: number[] } = {
        id: `prop-domain-${i}`,
        title: `Domain ${i}`,
        version: '0',
        extractors: {
          perElement(el: ElementHandle, _acc: FeatureSink): void {
            visits.push(el.backendNodeId ?? -1);
          },
        },
        evaluate: (_features: ExtractedFeatures) => [],
        visits,
      };
      return module;
    }),
  );
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('Shared walker property: traversal count is always 1', () => {
  it('traversalCount == 1 for any combination of elements and domains', async () => {
    await fc.assert(
      fc.asyncProperty(snapshotArb(), domainsArb(), async (snap, domains) => {
        const result = await createSharedWalker({ snapshot: snap, domains });
        expect(result.traversalCount).toBe(1);
      }),
      { numRuns: 50 },
    );
  });

  it('each domain sees every element exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(snapshotArb(), domainsArb(), async (snap, domains) => {
        await createSharedWalker({ snapshot: snap, domains });
        const expectedCount = snap.domOutline.length;
        for (const domain of domains) {
          expect(domain.visits).toHaveLength(expectedCount);
          // Visits must cover the same set of backendNodeIds as domOutline.
          const visitedIds = new Set(domain.visits);
          const expectedIds = new Set(snap.domOutline.map((el) => el.backendNodeId));
          expect(visitedIds).toEqual(expectedIds);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('traversalCount does not grow when N domains → N+1 domains', async () => {
    await fc.assert(
      fc.asyncProperty(snapshotArb(), fc.integer({ min: 1, max: 8 }), async (snap, n) => {
        const makeN = (count: number): DomainModule[] =>
          Array.from({ length: count }, (_, i) => ({
            id: `d-${i}`,
            title: `D ${i}`,
            version: '0',
            extractors: { perElement: () => {} },
            evaluate: () => [],
          }));

        const resultN = await createSharedWalker({ snapshot: snap, domains: makeN(n) });
        const resultN1 = await createSharedWalker({ snapshot: snap, domains: makeN(n + 1) });

        expect(resultN.traversalCount).toBe(1);
        expect(resultN1.traversalCount).toBe(1);
      }),
      { numRuns: 30 },
    );
  });
});

describe('Shared walker property: FeatureSink accumulation', () => {
  it('ExtractedFeatures retains all writes from all domains', async () => {
    await fc.assert(
      fc.asyncProperty(
        snapshotArb().filter((s) => s.domOutline.length > 0),
        async (snap) => {
          const featKey = 'test:flag';
          const domain: DomainModule = {
            id: 'feat-writer',
            title: 'Feature writer',
            version: '0',
            extractors: {
              perElement(el: ElementHandle, acc: FeatureSink): void {
                acc.set(el.selector, featKey, true);
              },
            },
            evaluate: () => [],
          };

          const result = await createSharedWalker({ snapshot: snap, domains: [domain] });

          // Every element in domOutline must have a feature entry written.
          for (const entry of snap.domOutline) {
            const elFeatures = result.features.byElement.get(entry.selector);
            expect(elFeatures).toBeDefined();
            expect(elFeatures?.domainFeatures['feat-writer']?.get(featKey)).toBe(true);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
