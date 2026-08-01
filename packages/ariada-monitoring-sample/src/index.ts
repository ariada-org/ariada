// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * @ariada-org/monitoring-sample — page-sample selection for the EU
 * public-sector accessibility monitoring methodology.
 *
 * Commission Implementing Decision (EU) 2018/1524, Annex I, points 3.2 to 3.4.
 * Pure functions only: discovery is the caller's, judgement is theirs too where
 * the methodology reserves it for a human body.
 */

export { selectInDepthSample, selectSimplifiedSample } from './select.js';
export { classifyRole, isDocument, ROLE_VOCABULARY } from './classify.js';
export type {
  DiscoveredPage,
  MonitoringSample,
  PageRole,
  SampleClause,
  SampledPage,
  SelectSampleOptions,
} from './types.js';
