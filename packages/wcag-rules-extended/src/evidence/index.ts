// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Compliance evidence emitters — re-export from `@ariada-org/evidence-emitter`.
 *
 * As of 2026-05-16 the evidence emitters live in a standalone package,
 * `@ariada-org/evidence-emitter`. This module preserves the public API of
 * `@ariada-org/wcag-rules-extended` v0.1.0 for backwards compatibility.
 *
 * New consumers should depend on `@ariada-org/evidence-emitter` directly.
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
  DosLagenOptions,
} from '@ariada-org/evidence-emitter';

export {
  emitVpat,
  emitEn301549,
  emitDosLagen,
  WCAG_22_CRITERIA,
  WCAG_BY_SC,
} from '@ariada-org/evidence-emitter';
