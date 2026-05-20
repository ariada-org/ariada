// SPDX-License-Identifier: EUPL-1.2
//
// Barrel for the orchestrator surface.

export {
  combineLogits,
  DEFAULT_SIGNAL_WEIGHTS,
  UNIFORM_PRIOR,
} from './ensemble.js';
export {
  applyCalibration,
  DEFAULT_CALIBRATION,
  type CalibrationParams,
} from './calibration.js';
export { softmax, buildPosterior, computeConfidence } from './posterior.js';
