// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { createNullLogger } from '../src/logger.js';
import { runOrchestration } from '../src/orchestrator.js';
import type { AnalyzerContext, DomainAnalyzer, UnifiedSnapshot } from '../src/types.js';

function blankSnapshot(): UnifiedSnapshot {
  return {
    scanId: 'scan-1',
    url: 'https://example.com',
    timestamp: 0,
    axTree: [],
    domOutline: [],
    perfMetrics: {},
    networkResources: [],
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

function trackingAnalyzer(): {
  analyzer: DomainAnalyzer;
  disposeCalls: number;
} {
  let disposeCalls = 0;
  const analyzer: DomainAnalyzer = {
    domain: 'a11y',
    version: '0.0.1',
    ruleIds: [],
    analyze: async (_ctx: AnalyzerContext) => [],
    dispose: () => {
      disposeCalls += 1;
    },
  };
  return {
    analyzer,
    get disposeCalls() {
      return disposeCalls;
    },
  };
}

describe('orchestrator dispose lifecycle (dispose-on-success and dispose-on-throw)', () => {
  it('calls dispose() exactly once on scan success', async () => {
    const t = trackingAnalyzer();
    await runOrchestration({
      scanId: 'scan-1',
      url: 'https://example.com',
      startedAt: Date.now(),
      snapshot: blankSnapshot(),
      analyzers: [t.analyzer],
      page: undefined,
      logger: createNullLogger(),
      bboxResolver: { resolve: async () => ({ x: 0, y: 0, w: 0, h: 0 }) },
    });
    expect(t.disposeCalls).toBe(1);
  });

  it('calls dispose() exactly once even when scan throws', async () => {
    const t = trackingAnalyzer();
    // Force orchestrator into the catch path by handing it analyzers
    // whose downstream cross-domain detector receives no findings yet —
    // simulate failure by passing a throwing emitter.
    const throwingEmitter = {
      emit: () => {
        throw new Error('emitter blew up');
      },
      on: () => () => undefined,
    };
    await expect(
      runOrchestration({
        scanId: 'scan-1',
        url: 'https://example.com',
        startedAt: Date.now(),
        snapshot: blankSnapshot(),
        analyzers: [t.analyzer],
        page: undefined,
        logger: createNullLogger(),
        bboxResolver: { resolve: async () => ({ x: 0, y: 0, w: 0, h: 0 }) },
        emitter: throwingEmitter,
        elementIter: true,
      }),
    ).rejects.toThrow();
    expect(t.disposeCalls).toBe(1);
  });

  it('does not call dispose on analyzers that do not declare it', async () => {
    const noDispose: DomainAnalyzer = {
      domain: 'a11y',
      version: '0.0.1',
      ruleIds: [],
      analyze: async () => [],
    };
    const result = await runOrchestration({
      scanId: 'scan-1',
      url: 'https://example.com',
      startedAt: Date.now(),
      snapshot: blankSnapshot(),
      analyzers: [noDispose],
      page: undefined,
      logger: createNullLogger(),
      bboxResolver: { resolve: async () => ({ x: 0, y: 0, w: 0, h: 0 }) },
    });
    expect(result.report.scanId).toBe('scan-1');
  });

  it('isolates dispose throws (one analyzer dispose error does not block others)', async () => {
    let secondDisposeCalls = 0;
    const throwOnDispose: DomainAnalyzer = {
      domain: 'a11y',
      version: '0.0.1',
      ruleIds: [],
      analyze: async () => [],
      dispose: () => {
        throw new Error('dispose blew up');
      },
    };
    const second: DomainAnalyzer = {
      domain: 'cwv',
      version: '0.0.1',
      ruleIds: [],
      analyze: async () => [],
      dispose: () => {
        secondDisposeCalls += 1;
      },
    };
    await runOrchestration({
      scanId: 'scan-1',
      url: 'https://example.com',
      startedAt: Date.now(),
      snapshot: blankSnapshot(),
      analyzers: [throwOnDispose, second],
      page: undefined,
      logger: createNullLogger(),
      bboxResolver: { resolve: async () => ({ x: 0, y: 0, w: 0, h: 0 }) },
    });
    expect(secondDisposeCalls).toBe(1);
  });
});
