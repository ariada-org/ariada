// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { ScanEvent, ScanEventEmitter } from './events.js';
import type {
  AnalyzerContext,
  BoundingBox,
  DomainAnalyzer,
  Finding,
  UnifiedSnapshot,
} from './types.js';

const MIN_EMIT_GAP_MS = 20;

/**
 * Runtime-supplied bounding-box lookup. Keeps `runElementIteration` free of
 * Playwright/DOM dependencies — the Node Playwright adapter wraps
 * `page.locator(sel).boundingBox()`, the in-browser adapter wraps
 * `document.querySelector(sel)?.getBoundingClientRect()`.
 */
export interface BoundingBoxResolver {
  resolve(selector: string): Promise<BoundingBox>;
}

/**
 *
 */
export interface IterOptions {
  scanId: string;
  emitter: ScanEventEmitter;
  snapshot: UnifiedSnapshot;
  analyzers: readonly DomainAnalyzer[];
  ctx: AnalyzerContext;
  bboxResolver: BoundingBoxResolver;
  minGapMs?: number;
}

/**
 * Element-iteration emitter. Emit scanning then
 * passed/violated per element, paced ≥20ms apart so downstream SSE consumers
 * can render incremental state.
 */
export async function runElementIteration(opts: IterOptions): Promise<number> {
  const gap = opts.minGapMs ?? MIN_EMIT_GAP_MS;
  let seq = 0;
  let violatedCount = 0;

  for (const el of opts.snapshot.domOutline) {
    const bbox = await safeBoundingBox(opts.bboxResolver, el.selector);

    await emitAndWait(
      opts.emitter,
      {
        kind: 'element_scan',
        scan_id: opts.scanId,
        seq: seq++,
        selector: el.selector,
        bbox,
        status: 'scanning',
      },
      gap,
    );

    const violations = await collectElementViolations(
      opts.analyzers,
      opts.ctx,
      el.selector,
      el.backendNodeId,
    );

    const hasViolations = violations.length > 0;
    if (hasViolations) violatedCount++;

    await emitAndWait(
      opts.emitter,
      {
        kind: 'element_scan',
        scan_id: opts.scanId,
        seq: seq++,
        selector: el.selector,
        bbox,
        status: hasViolations ? 'violated' : 'passed',
        ...(hasViolations ? { violations } : {}),
      },
      gap,
    );
  }

  return violatedCount;
}

async function safeBoundingBox(
  resolver: BoundingBoxResolver,
  selector: string,
): Promise<BoundingBox> {
  try {
    const box = await resolver.resolve(selector);
    return box;
  } catch {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
}

async function collectElementViolations(
  analyzers: readonly DomainAnalyzer[],
  ctx: AnalyzerContext,
  selector: string,
  backendNodeId: number | undefined,
): Promise<
  Array<{ rule_id: string; severity: Finding['severity']; criterion: string; message: string }>
> {
  const out: Array<{
    rule_id: string;
    severity: Finding['severity'];
    criterion: string;
    message: string;
  }> = [];

  for (const a of analyzers) {
    if (!a.analyzeElement) continue;
    try {
      const findings = await a.analyzeElement(ctx, {
        selector,
        ...(backendNodeId !== undefined ? { backendNodeId } : {}),
      });
      for (const f of findings) {
        out.push({
          rule_id: f.ruleId,
          severity: f.severity,
          criterion: f.criterion ?? f.wcagMapping?.[0] ?? '',
          message: f.message,
        });
      }
    } catch {
      // isolate analyzer failure
    }
  }

  return out;
}

async function emitAndWait(
  emitter: ScanEventEmitter,
  event: ScanEvent,
  gapMs: number,
): Promise<void> {
  emitter.emit(event);
  if (gapMs > 0) await new Promise<void>((r) => setTimeout(r, gapMs));
}
