// SPDX-License-Identifier: EUPL-1.2
/**
 * Compliance evidence emitters — public entry point.
 *
 * Three machine-readable JSON formats are produced from a normalized
 * violation list:
 *
 *   - VPAT 2.5 (US Section 508 / ITI) — `emitVpat`
 *   - EN 301 549 v3.2.1 §11 Conformance Statement — `emitEn301549`
 *   - Swedish DOS-lagen accessibility statement (DIGG guidelines) — `emitDosLagen`
 *
 * The Violation input shape is axe-core-compatible — see {@link Violation}.
 */

export type {
  Violation,
  ReportMeta,
  VpatConformanceLevel,
  VpatCriterion,
  VpatReport,
  En301549Status,
  En301549Row,
  En301549Report,
  DosLagenStatus,
  DosLagenReport,
} from './types.js';

export { emitVpat } from './emit-vpat.js';
export { emitEn301549 } from './emit-en301549.js';
export { emitDosLagen, type DosLagenOptions } from './emit-dos-lagen.js';
export { WCAG_22_CRITERIA, WCAG_BY_SC } from './wcag-22-catalog.js';
export {
  allFindings,
  canonicalCriterion,
  countUnmapped,
  criteriaOf,
  europeanClausesOf,
  findingsToViolations,
  type ScanLikeFinding,
  type ScanLikeReport,
} from './from-scan.js';
export {
  toRenderableVpat,
  type RenderableVpat,
  type RenderableCriterion,
  type RenderableStatus,
} from './to-renderable.js';