// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Two translations, kept apart from everything that decides anything.

import type { AriadaCliResult, AriadaStatus, StatusComponentState } from './types.js';

const COMPONENT_STATE_BY_ARIADA_STATUS: Readonly<Record<AriadaStatus, StatusComponentState>> = {
  pass: 'operational',
  partial: 'degraded_performance',
  fail: 'major_outage',
};

/**
 * A scan that ended over the threshold is a failure whatever it found. Under
 * it, findings still mean something is wrong — just not enough to stop anyone,
 * which is exactly what the middle state on a board is for.
 */
export function classifyAriadaResult(result: AriadaCliResult): AriadaStatus {
  if (result.exitCode === 1) {
    return 'fail';
  }
  return result.summary.total === 0 ? 'pass' : 'partial';
}

/** The board's word for our word. */
export function mapAriadaStatusToComponentState(status: AriadaStatus): StatusComponentState {
  return COMPONENT_STATE_BY_ARIADA_STATUS[status];
}
