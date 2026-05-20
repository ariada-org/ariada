// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createCrossDomainDetector } from './cross-domain.js';
import { runElementIteration, type BoundingBoxResolver } from './element-iter.js';
import {
  createEventEmitter,
  type ScanEvent,
  type ScanEventEmitter,
} from './events.js';
import type { Logger } from './logger.js';
import { scoreFromCounts } from './scoring.js';
import type {
  AnalyzerContext,
  DomainAnalyzer,
  Finding,
  ScanResult,
  Severity,
  UnifiedReport,
  UnifiedSnapshot,
} from './types.js';

/**
 * Adapter-agnostic orchestrator. Both the Playwright adapter and the in-browser
 * adapter feed it a fresh `UnifiedSnapshot` plus a `BoundingBoxResolver` and
 * receive back an identical `ScanResult` shape. Keeps the locked ScanEvent
 * sequence (`scan_started → element_scan* → scan_complete`) in one place so
 * runtimes cannot drift.
 *
 */
export interface RunOrchestrationOpts {
  scanId: string;
  url: string;
  startedAt: number;
  snapshot: UnifiedSnapshot;
  analyzers: readonly DomainAnalyzer[];
  page: unknown;
  logger: Logger;
  bboxResolver: BoundingBoxResolver;
  emitter?: ScanEventEmitter;
  elementIter?: boolean;
}

/**
 *
 */
export async function runOrchestration(opts: RunOrchestrationOpts): Promise<ScanResult> {
  const emitter: ScanEventEmitter =
    opts.emitter ?? (opts.elementIter ? createEventEmitter() : nullEmitter());
  const replay: ScanEvent[] = [];
  const detach = emitter.on((e) => replay.push(e));
  let disposed = false;
  const ensureDisposed = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    await disposeAnalyzers(opts.analyzers, opts.logger);
  };

  try {
    const ctx: AnalyzerContext = {
      snapshot: opts.snapshot,
      page: opts.page,
      logger: opts.logger,
    };

    if (opts.elementIter) {
      emitter.emit({
        kind: 'scan_started',
        scan_id: opts.scanId,
        url: opts.url,
        element_count: opts.snapshot.domOutline.length,
      });

      await runElementIteration({
        scanId: opts.scanId,
        emitter,
        snapshot: opts.snapshot,
        analyzers: opts.analyzers,
        ctx,
        bboxResolver: opts.bboxResolver,
      });
    }

    const findings: Record<string, Finding[]> = {};
    const findingsByDomain = new Map<string, readonly Finding[]>();

    await Promise.all(
      opts.analyzers.map(async (a) => {
        try {
          const f = await a.analyze(ctx);
          const stamped = f.map((finding) => ({ ...finding, scanId: opts.scanId }));
          findings[a.domain] = stamped;
          findingsByDomain.set(a.domain, stamped);
        } catch (err) {
          opts.logger.error({ err, analyzer: a.domain }, 'analyzer failed');
          findings[a.domain] = [];
          findingsByDomain.set(a.domain, []);
        }
      }),
    );

    const detector = createCrossDomainDetector(opts.analyzers);
    const conflicts = detector.detect(findingsByDomain, opts.scanId);

    const totalViolations = Object.values(findings).reduce((sum, arr) => sum + arr.length, 0);
    const elementsScanned = opts.snapshot.domOutline.length;

    const report: UnifiedReport = {
      scanId: opts.scanId,
      url: opts.url,
      timestamp: opts.startedAt,
      snapshot: opts.snapshot,
      findings,
      conflicts,
      stats: {
        totalViolations,
        durationMs: Date.now() - opts.startedAt,
        analyzersRun: opts.analyzers.map((a) => a.domain),
        elementsScanned,
      },
    };

    if (opts.elementIter) {
      const counts = countBySeverity(Object.values(findings).flat());
      emitter.emit({
        kind: 'scan_complete',
        scan_id: opts.scanId,
        score: scoreFromCounts(counts),
        counts,
        top_categories: topCategories(Object.values(findings).flat(), 5),
      });
    }

    detach();
    await ensureDisposed();
    return {
      report,
      ...(opts.elementIter ? { events: replay } : {}),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      emitter.emit({ kind: 'scan_error', scan_id: opts.scanId, error: msg });
    } catch (emitErr) {
      opts.logger.error({ err: emitErr }, 'scan_error emit failed');
    }
    detach();
    await ensureDisposed();
    throw err;
  }
}

/**
 * Call `dispose()` exactly once on every analyzer that declares one. Per PRD
 * §3.1 (acceptance tests 12 + 13): dispose runs in a finally-like path even
 * when the scan throws, and must not crash the scan when it itself throws.
 */
async function disposeAnalyzers(
  analyzers: readonly DomainAnalyzer[],
  logger: Logger,
): Promise<void> {
  await Promise.all(
    analyzers.map(async (a) => {
      if (typeof a.dispose !== 'function') return;
      try {
        await a.dispose();
      } catch (err) {
        logger.error({ err, analyzer: a.domain }, 'analyzer dispose failed');
      }
    }),
  );
}

function countBySeverity(findings: Finding[]): {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
} {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const f of findings) {
    const sev: Severity = f.severity;
    counts[sev] += 1;
  }
  return counts;
}

function topCategories(
  findings: Finding[],
  limit: number,
): Array<{ rule_id: string; count: number }> {
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(f.ruleId, (counts.get(f.ruleId) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([rule_id, count]) => ({ rule_id, count }));
}

function nullEmitter(): ScanEventEmitter {
  return {
    emit(): void {
      // drop
    },
    on(): () => void {
      return (): void => undefined;
    },
  };
}
