// SPDX-License-Identifier: EUPL-1.2
/**
 * EAA / national-law penalty exposure estimator — public entry point.
 *
 * @see ./README.md
 */

export {
  estimatePenalty,
  listJurisdictions,
  JURISDICTION_PROFILES,
  type Jurisdiction,
  type JurisdictionProfile,
  type EstimateOptions,
  type EstimateResult,
} from './estimate.js';