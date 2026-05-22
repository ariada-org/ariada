// SPDX-License-Identifier: EUPL-1.2
//
// Offline-mode classifier — runs the full pipeline locally without any
// hosted-API dependency. Confidence is capped at 0.6 to mark
// that the offline-mode posterior is materially lower-fidelity than the
// hosted-mode posterior. Suitable for air-gapped CI, on-premise compliance,
// and the reproducibility receipt builder.

import {
  applyCalibration,
  buildPosterior,
  combineLogits,
  computeConfidence,
  DEFAULT_CALIBRATION,
  softmax,
} from '../orchestrator/index.js';
import {
  extractAstShape,
  extractEditHistoryRhythm,
  extractLexicalEntropy,
  extractNamingCadence,
} from '../signals/index.js';
import {
  err,
  ok,
  type AttributionError,
  type AttributionInput,
  type AttributionPosterior,
  type Result,
  type SignalContribution,
} from '../types.js';

/** Maximum confidence permitted by offline-mode (the offline-mode confidence cap). */
export const OFFLINE_CONFIDENCE_CAP = 0.6;

/** Classifier-weights version pin shipped with this OSS reference. */
export const OSS_CLASSIFIER_VERSION = '0.1.0-oss-default';

/** Validate that an `AttributionInput` is well-formed enough to classify. */
export function validateInput(
  input: AttributionInput,
): Result<true, AttributionError> {
  if (typeof input.code !== 'string') {
    return err({ kind: 'input_invalid', reason: 'code must be a string' });
  }
  if (typeof input.language !== 'string' || input.language.length === 0) {
    return err({ kind: 'input_invalid', reason: 'language must be a non-empty string' });
  }
  const meta = input.commit_metadata;
  if (meta === undefined || meta === null) {
    return err({ kind: 'input_invalid', reason: 'commit_metadata required' });
  }
  if (Number.isNaN(Date.parse(meta.timestamp_utc))) {
    return err({ kind: 'input_invalid', reason: 'timestamp_utc must be an RFC 3339 / ISO 8601 string' });
  }
  if (!/^[0-9a-f]{64}$/u.test(meta.git_author_email)) {
    return err({
      kind: 'input_invalid',
      reason: 'git_author_email must be the SHA-256 hex of the original email',
    });
  }
  return ok(true);
}

/** Extract all four signals from an input in canonical order. */
export function extractAllSignals(input: AttributionInput): SignalContribution[] {
  return [
    extractLexicalEntropy(input),
    extractAstShape(input),
    extractNamingCadence(input),
    extractEditHistoryRhythm(input),
  ];
}

/**
 * Run the full offline-mode pipeline:
 *   1. Validate input.
 *   2. Extract all four signal contributions.
 *   3. Combine into logits, apply default calibration.
 *   4. Softmax → posterior.
 *   5. Compute confidence, cap at `OFFLINE_CONFIDENCE_CAP`.
 *   6. Build sorted-descending posterior array.
 */
export function classifyOffline(
  input: AttributionInput,
  now: () => Date = () => new Date(),
): Result<AttributionPosterior, AttributionError> {
  const validation = validateInput(input);
  if (!validation.ok) return validation;
  const contributions = extractAllSignals(input);
  const logits = combineLogits(contributions);
  const calibrated = applyCalibration(logits, DEFAULT_CALIBRATION);
  const probs = softmax(calibrated);
  const posterior = buildPosterior(probs);
  const rawConfidence = computeConfidence(probs);
  const confidence = Math.min(OFFLINE_CONFIDENCE_CAP, rawConfidence);
  return ok({
    posterior,
    confidence,
    signal_contributions: contributions,
    classifier_version: OSS_CLASSIFIER_VERSION,
    calibration_version: DEFAULT_CALIBRATION.version,
    inferred_at_utc: now().toISOString(),
    inference_mode: 'offline',
  });
}
