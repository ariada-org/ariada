// SPDX-License-Identifier: EUPL-1.2
//
// Calibration layer — applies a temperature + per-agent bias correction to
// the raw ensemble logits. The OSS reference implementation ships a
// temperature of 1.0 and zero biases (no-op); the hosted classifier ships
// the actual Platt-scaling + isotonic-regression overlay that achieves the
// Brier ≤ 0.15 target documented in the package calibration spec.
//
// Exposing this layer as its own pure function lets downstream consumers
// (notably the offline-mode pathway, the validation harness, and the
// reproducibility receipt builder) swap in a different calibration without
// touching the ensemble combiner.

import {
  ALL_AGENTS,
  type AIAgentId,
} from '../types.js';

/**
 *
 */
export interface CalibrationParams {
  /** Softmax temperature. Higher values flatten the distribution. */
  temperature: number;
  /** Per-agent additive bias on logits. */
  biases: Record<AIAgentId, number>;
  /** Version pin reflecting the calibration coefficients in use. */
  version: string;
}

/** Default (no-op) calibration shipped with the OSS reference implementation. */
export const DEFAULT_CALIBRATION: CalibrationParams = (() => {
  const biases = {} as Record<AIAgentId, number>;
  for (const agent of ALL_AGENTS) biases[agent] = 0;
  return {
    temperature: 1.0,
    biases,
    version: '0.1.0-oss-default',
  };
})();

/** Apply temperature scaling + biases to a logit vector. */
export function applyCalibration(
  logits: Record<AIAgentId, number>,
  params: CalibrationParams = DEFAULT_CALIBRATION,
): Record<AIAgentId, number> {
  const safeTemp = params.temperature <= 0 ? 1.0 : params.temperature;
  const out = {} as Record<AIAgentId, number>;
  for (const agent of ALL_AGENTS) {
    out[agent] = logits[agent] / safeTemp + (params.biases[agent] ?? 0);
  }
  return out;
}
