// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { createNullLogger } from './logger.js';
import type { DomainModule, PropertySnapshot, SiteContext } from './domain-contract.js';
import type {
  AnalyzerContext,
  DomainAnalyzer,
  Finding,
  UnifiedSnapshot,
} from './types.js';

/**
 * Options for adapting a legacy analyzer to the {@link DomainModule} contract.
 */
export interface AnalyzerBridgeOptions {
  /** Title shown in reports; defaults to the analyzer's domain. */
  title?: string;
  /** Page handle passed through to analyzers that need page-context eval. */
  page?: unknown;
}

/**
 * Adapt a legacy {@link DomainAnalyzer} to the {@link DomainModule} contract so
 * existing analyzers run in the multi-domain pipeline without a rewrite.
 *
 * Legacy analyzers do their own (asynchronous) analysis in `analyze()`, which the
 * new contract splits into a synchronous, I/O-free extractor pass plus a
 * synchronous `evaluate`. The bridge resolves that mismatch by running the
 * analyzer once per site during `applicability` — the one async hook the walker
 * awaits before the shared pass — and keeping that site's findings until
 * `evaluate` returns them. Because the orchestrator processes one site to
 * completion before the next, a single current-findings slot is sufficient. The
 * bridge registers no extractors: a legacy analyzer reads the snapshot directly
 * rather than contributing to the shared feature set.
 */
export function analyzerToDomainModule(
  analyzer: DomainAnalyzer,
  opts: AnalyzerBridgeOptions = {},
): DomainModule {
  let currentFindings: Finding[] = [];

  return {
    id: analyzer.domain,
    title: opts.title ?? analyzer.domain,
    version: analyzer.version,

    async applicability(ctx: SiteContext): Promise<boolean> {
      const context: AnalyzerContext = {
        snapshot: toUnifiedSnapshot(ctx.snapshot),
        page: opts.page,
        logger: createNullLogger(),
      };
      currentFindings = await analyzer.analyze(context);
      // Always applicable — running here is the adaptation, not a gate.
      return true;
    },

    extractors: {},

    evaluate(): Finding[] {
      // `evaluate` runs after `applicability` for the same site, so
      // `currentFindings` holds this site's findings; a legacy analyzer's findings
      // come from its own analysis, replayed here.
      return currentFindings;
    },
  };
}

/**
 * Project a {@link PropertySnapshot} onto the legacy {@link UnifiedSnapshot} shape
 * a `DomainAnalyzer` expects. The multi-domain snapshot is a superset, so every
 * field the analyzer reads is present.
 */
function toUnifiedSnapshot(snap: PropertySnapshot): UnifiedSnapshot {
  return {
    scanId: snap.scanId,
    url: snap.url,
    timestamp: snap.timestamp,
    axTree: [...snap.axTree],
    domOutline: snap.domOutline.map((e) => ({
      backendNodeId: e.backendNodeId,
      nodeName: e.nodeName,
      selector: e.selector,
      ...(e.frameId !== undefined ? { frameId: e.frameId } : {}),
    })),
    perfMetrics: { ...snap.perfMetrics },
    networkResources: snap.networkResources.map((r) => ({ ...r })),
    timings: { ...snap.timings },
  };
}
