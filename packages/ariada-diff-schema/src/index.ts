// SPDX-License-Identifier: EUPL-1.2
//
// `@ariada-org/diff-schema` public entry point.
//
// Exports the canonical TypeScript types + runtime validators + the
// reference fingerprint + selector-normalisation algorithms for the
// differential accessibility CI gate.

export {
  computeFindingFingerprint,
  computeFingerprints,
  type Finding,
  type FingerprintOptions,
  type Severity,
} from './fingerprint.js';

export {
  normaliseSelector,
  type SelectorNormaliseOptions,
} from './selector-normalise.js';

export {
  DIFF_SCHEMA_VERSION,
  CLASSIFICATIONS,
  SEVERITIES,
  computeCounts,
  validateDiffResult,
  type Classification,
  type ClassificationCounts,
  type DiffResult,
  type DiffResultBase,
  type DiffResultHead,
  type EngineInfo,
  type FindingWithFingerprint,
  type FindingWithFingerprintAndConfidence,
  type ValidationResult,
} from './diff-result.js';

export {
  defaultPolicy,
  resolvePolicy,
  validateBaselinePolicy,
  type ActionRule,
  type BaselinePolicy,
  type ClassificationRules,
  type Exemption,
  type JurisdictionOverride,
  type PathOverride,
  type PolicyAction,
  type ResolveInput,
  type ResolvedRule,
  type SeverityRuleMap,
} from './baseline-policy.js';

export {
  GATE_DECISION_VERSION,
  buildGateDecision,
  gateDecisionHash,
  validateGateDecision,
  type BuildGateDecisionInput,
  type DecisionReason,
  type ExemptionApplied,
  type ExemptionInvalidated,
  type GateDecision,
} from './gate-decision.js';

export {
  EXIT_GATE_PASS,
  EXIT_GATE_FAIL,
  EXIT_CONFIG_ERROR,
  EXIT_NETWORK_ERROR,
  EXIT_AUTH_ERROR,
  EXIT_RATE_LIMITED,
  EXIT_INTERNAL_ERROR,
  EXIT_CODE_LABELS,
  exitCodeFromLabel,
  type ExitCode,
} from './exit-codes.js';

export {
  emitSarif,
  validateSarifShape,
  type SarifDocument,
} from './sarif.js';

export { canonicalize } from './internal/jcs-encode.js';
export { sha256Hex, sha256BytesHex } from './internal/hash.js';
export {
  matchesGlob,
  matchesAnyGlob,
  longestMatchingGlob,
} from './internal/glob-match.js';
