// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { runElementIteration, type BoundingBoxResolver } from '../src/element-iter.js';
import { createEventEmitter, type ScanEvent } from '../src/events.js';
import { createNullLogger } from '../src/logger.js';
import type {
  AnalyzerContext,
  DomainAnalyzer,
  ElementTarget,
  Finding,
  UnifiedSnapshot,
} from '../src/types.js';

function stubResolver(): BoundingBoxResolver {
  return {
    async resolve(_selector: string) {
      return { x: 10, y: 20, w: 100, h: 30 };
    },
  };
}

function snapshot(ids: string[]): UnifiedSnapshot {
  return {
    scanId: 'scan-test',
    url: 'http://test',
    timestamp: 0,
    axTree: [],
    domOutline: ids.map((id, i) => ({ backendNodeId: i + 1, nodeName: 'p', selector: id })),
    perfMetrics: {},
    networkResources: [],
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

const violatingAnalyzer: DomainAnalyzer = {
  domain: 'a11y',
  version: 'test',
  ruleIds: [],
  analyze: async (_ctx: AnalyzerContext) => [],
  async analyzeElement(_ctx: AnalyzerContext, t: ElementTarget): Promise<Finding[]> {
    if (t.selector.includes('bad')) {
      return [
        {
          id: `f-${t.selector}`,
          scanId: 'scan-test',
          domain: 'a11y',
          ruleId: 'color-contrast',
          severity: 'critical',
          element: { selector: t.selector },
          message: 'contrast too low',
          criterion: 'WCAG 2.2 1.4.3',
        },
      ];
    }
    return [];
  },
};

describe('runElementIteration', () => {
  it('emits scanning then passed/violated per element with monotonic seq', async () => {
    const emitter = createEventEmitter();
    const received: ScanEvent[] = [];
    emitter.on((e) => received.push(e));

    const ctx: AnalyzerContext = {
      snapshot: snapshot(['good1', 'bad1']),
      page: undefined,
      logger: createNullLogger(),
    };

    const violated = await runElementIteration({
      scanId: 'scan-test',
      emitter,
      snapshot: ctx.snapshot,
      analyzers: [violatingAnalyzer],
      ctx,
      bboxResolver: stubResolver(),
      minGapMs: 0,
    });

    expect(received).toHaveLength(4);
    const kinds = received.map((e) => e.kind);
    expect(kinds).toEqual(['element_scan', 'element_scan', 'element_scan', 'element_scan']);

    const statuses = received
      .filter((e): e is Extract<ScanEvent, { kind: 'element_scan' }> => e.kind === 'element_scan')
      .map((e) => e.status);
    expect(statuses).toEqual(['scanning', 'passed', 'scanning', 'violated']);

    const seqs = received
      .filter((e): e is Extract<ScanEvent, { kind: 'element_scan' }> => e.kind === 'element_scan')
      .map((e) => e.seq);
    expect(seqs).toEqual([0, 1, 2, 3]);
    expect(violated).toBe(1);
  });

  it('attaches violations array only when status is violated', async () => {
    const emitter = createEventEmitter();
    const received: ScanEvent[] = [];
    emitter.on((e) => received.push(e));

    const ctx: AnalyzerContext = {
      snapshot: snapshot(['bad-only']),
      page: undefined,
      logger: createNullLogger(),
    };

    await runElementIteration({
      scanId: 'scan-test',
      emitter,
      snapshot: ctx.snapshot,
      analyzers: [violatingAnalyzer],
      ctx,
      bboxResolver: stubResolver(),
      minGapMs: 0,
    });

    const violatedEvent = received.find(
      (e): e is Extract<ScanEvent, { kind: 'element_scan' }> =>
        e.kind === 'element_scan' && e.status === 'violated',
    );
    expect(violatedEvent).toBeDefined();
    expect(violatedEvent?.violations).toBeDefined();
    expect(violatedEvent?.violations?.[0]?.rule_id).toBe('color-contrast');
    expect(violatedEvent?.violations?.[0]?.severity).toBe('critical');

    const scanningEvent = received.find(
      (e): e is Extract<ScanEvent, { kind: 'element_scan' }> =>
        e.kind === 'element_scan' && e.status === 'scanning',
    );
    expect(scanningEvent).toBeDefined();
    expect(scanningEvent && 'violations' in scanningEvent).toBe(false);
  });

  it('paces emission when minGapMs > 0', async () => {
    const emitter = createEventEmitter();
    const timestamps: number[] = [];
    emitter.on(() => timestamps.push(Date.now()));

    const ctx: AnalyzerContext = {
      snapshot: snapshot(['a', 'b']),
      page: undefined,
      logger: createNullLogger(),
    };

    await runElementIteration({
      scanId: 'scan-test',
      emitter,
      snapshot: ctx.snapshot,
      analyzers: [violatingAnalyzer],
      ctx,
      bboxResolver: stubResolver(),
      minGapMs: 25,
    });

    expect(timestamps).toHaveLength(4);
    for (let i = 1; i < timestamps.length; i++) {
      const gap = (timestamps[i] ?? 0) - (timestamps[i - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(20);
    }
  });

  it('falls back to (0,0,0,0) bbox when resolver throws', async () => {
    const emitter = createEventEmitter();
    const received: ScanEvent[] = [];
    emitter.on((e) => received.push(e));

    const failingResolver: BoundingBoxResolver = {
      async resolve(_selector: string) {
        throw new Error('bbox unavailable');
      },
    };

    const ctx: AnalyzerContext = {
      snapshot: snapshot(['x']),
      page: undefined,
      logger: createNullLogger(),
    };

    await runElementIteration({
      scanId: 'scan-test',
      emitter,
      snapshot: ctx.snapshot,
      analyzers: [violatingAnalyzer],
      ctx,
      bboxResolver: failingResolver,
      minGapMs: 0,
    });

    const first = received.find(
      (e): e is Extract<ScanEvent, { kind: 'element_scan' }> => e.kind === 'element_scan',
    );
    expect(first?.bbox).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
