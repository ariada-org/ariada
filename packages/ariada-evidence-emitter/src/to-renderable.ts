// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

/**
 * Bridge between the report this package emits and the shape the HTML renderer
 * reads.
 *
 * The two were built independently and never met: the emitter writes
 * `criterion` / `conformance: 'Does Not Support'`, the renderer reads `id` /
 * `status: 'does-not-support'`. Nothing produced the renderer's shape, so a
 * package of eighteen files sat unreachable and the only conformance output
 * anyone could get was a hand-rolled table in the command-line tool.
 *
 * The target type is declared structurally rather than imported, so neither
 * package depends on the other.
 */

import type { VpatReport } from './types.js';

/**
 *
 */
export type RenderableStatus =
  | 'supports'
  | 'partially-supports'
  | 'does-not-support'
  | 'not-applicable'
  | 'not-evaluated';

/**
 *
 */
export interface RenderableCriterion {
  readonly id: string;
  readonly name: string;
  readonly level: 'A' | 'AA' | 'AAA';
  readonly status: RenderableStatus;
  readonly remarks?: string;
}

/**
 *
 */
export interface RenderableVpat {
  readonly schemaVersion: '2.5';
  readonly meta: {
    readonly productName: string;
    readonly productVersion?: string;
    readonly evaluator: string;
    readonly evaluationDate: string;
    readonly scope: string;
    readonly methodology: string;
  };
  readonly applicableStandards: ReadonlyArray<{ id: string; title: string; url?: string }>;
  readonly criteria: readonly RenderableCriterion[];
  readonly summary: {
    readonly total: number;
    readonly supports: number;
    readonly partiallySupports: number;
    readonly doesNotSupport: number;
    readonly notApplicable: number;
    readonly notEvaluated: number;
  };
}

const STATUS: Record<string, RenderableStatus> = {
  Supports: 'supports',
  'Partially Supports': 'partially-supports',
  'Does Not Support': 'does-not-support',
  'Not Applicable': 'not-applicable',
  'Not Evaluated': 'not-evaluated',
};

const STANDARDS = [
  { id: 'wcag22aa', title: 'WCAG 2.2 Level AA', url: 'https://www.w3.org/TR/WCAG22/' },
  {
    id: 'en301549',
    title: 'EN 301 549 V3.2.1',
    url: 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/',
  },
];

/** Convert an emitted report into the renderer's input. */
export function toRenderableVpat(report: VpatReport): RenderableVpat {
  return {
    schemaVersion: '2.5',
    meta: {
      productName: report.meta.productName,
      ...(report.meta.productVersion ? { productVersion: report.meta.productVersion } : {}),
      evaluator: report.meta.evaluator,
      evaluationDate: report.meta.evaluationDate,
      scope: report.meta.scope,
      // Required by the renderer; the emitter treats it as optional. Saying the
      // method is unstated is better than rendering an empty section that reads
      // as though none was needed.
      methodology: report.meta.methodology ?? 'Methodology not stated.',
    },
    applicableStandards: STANDARDS,
    criteria: report.criteria.map((c) => ({
      id: c.criterion,
      name: c.name,
      level: c.level,
      status: STATUS[c.conformance] ?? 'not-evaluated',
      ...(c.remarks ? { remarks: c.remarks } : {}),
    })),
    summary: report.summary,
  };
}
