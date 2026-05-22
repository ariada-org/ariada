// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * EAA / national-law penalty exposure estimator —
 * re-export from `@ariada-org/penalty-estimator`.
 *
 * As of 2026-05-16 the penalty estimator lives in a standalone package,
 * `@ariada-org/penalty-estimator`. This module preserves the public API of
 * `@ariada-org/wcag-rules-extended` v0.1.0 for backwards compatibility.
 *
 * New consumers should depend on `@ariada-org/penalty-estimator` directly.
 */

export {
  estimatePenalty,
  listJurisdictions,
  JURISDICTION_PROFILES,
} from '@ariada-org/penalty-estimator';

export type {
  Jurisdiction,
  JurisdictionProfile,
  EstimateOptions,
  EstimateResult,
} from '@ariada-org/penalty-estimator';
