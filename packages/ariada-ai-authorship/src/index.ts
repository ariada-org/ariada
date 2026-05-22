// SPDX-License-Identifier: EUPL-1.2
//
// `@ariada-org/ai-authorship` public entry point.
//
// Exports the canonical types + the public attribution surface:
//
//   1. `attribute(input)`            — single-input inference. Hosted by
//      default; falls back to offline mode when `ARIADA_ATTRIBUTION_OFFLINE`
//      is set or when no API key is configured.
//   2. `attributeBatch(inputs)`      — batched inference, preferred for CI.
//   3. `attributeOffline(input)`     — synchronous offline-only inference.
//   4. `extractSignals(input)`       — signal-extraction inspection.
//   5. `anchorPosterior(posterior, ...)` — convenience wrapper that
//      canonicalises a posterior via `@ariada-org/haes`, builds a payload, and
//      appends to a HAES chain. Mirrors the documented composition pattern.
//
// All async entry-points return a `Result<T, AttributionError>` rather than
// throwing on expected error paths.

import {
  classifyOffline,
  hostedAttributeBatch,
  validateInput,
  OSS_CLASSIFIER_VERSION,
  extractAllSignals,
  type HostedClientOptions,
} from './client/index.js';
import {
  err,
  ok,
  type AttributionError,
  type AttributionInput,
  type AttributionPosterior,
  type Result,
  type SignalContribution,
} from './types.js';

export {
  ALL_AGENTS,
  ALL_SIGNALS,
  ok,
  err,
} from './types.js';

export type {
  AIAgentId,
  AgentProbability,
  AttributionError,
  AttributionInput,
  AttributionPosterior,
  CommitMetadata,
  InferenceMode,
  Result,
  SignalContribution,
  SignalName,
} from './types.js';

export {
  extractLexicalEntropy,
  extractAstShape,
  extractNamingCadence,
  extractEditHistoryRhythm,
  tokenise,
  shannonEntropy,
  bracketShape,
  identifierStyle,
  styleEntropy,
  commitGapStats,
} from './signals/index.js';

export {
  combineLogits,
  applyCalibration,
  softmax,
  buildPosterior,
  computeConfidence,
  DEFAULT_CALIBRATION,
  DEFAULT_SIGNAL_WEIGHTS,
  UNIFORM_PRIOR,
  type CalibrationParams,
} from './orchestrator/index.js';

export {
  classifyOffline,
  validateInput,
  extractAllSignals,
  hostedAttributeBatch,
  OFFLINE_CONFIDENCE_CAP,
  OSS_CLASSIFIER_VERSION,
  type HostedAttributeResponse,
  type HostedClientOptions,
} from './client/index.js';

export {
  diffToInputs,
  parseUnifiedDiff,
  detectLanguage,
  prPayloadToInputs,
  locationToInput,
  type LocationReference,
  type PullRequestPayload,
} from './adapters/index.js';

export {
  anchorPosterior,
  canonicalisePosterior,
  buildAnchorInclusionProof,
  ARTIFACT_KIND,
  ANCHOR_MODEL_ID,
  type AnchorPosteriorOptions,
  type AnchorPosteriorResult,
} from './anchor.js';

/** Convention env-var that flips the default `attribute()` call to offline mode. */
export const OFFLINE_ENV_VAR = 'ARIADA_ATTRIBUTION_OFFLINE';

/** Convention env-var that supplies the hosted-API bearer token. */
export const API_KEY_ENV_VAR = 'ARIADA_API_KEY';

/** Convention env-var that overrides the hosted endpoint URL. */
export const ENDPOINT_ENV_VAR = 'ARIADA_ATTRIBUTION_ENDPOINT';

const DEFAULT_ENDPOINT = 'https://api.ariada.org/v1/ai-authorship/attribute';

/**
 * Single-input inference. Hosted-mode by default; falls back to offline-mode
 * when `ARIADA_ATTRIBUTION_OFFLINE` is set or no `ARIADA_API_KEY` is
 * configured.
 *
 * Surface contract per the public-API specification.
 */
export async function attribute(
  input: AttributionInput,
  override?: Partial<HostedClientOptions>,
): Promise<Result<AttributionPosterior, AttributionError>> {
  const offlineRequested = process.env[OFFLINE_ENV_VAR] === '1';
  const apiKey = override?.api_key ?? process.env[API_KEY_ENV_VAR] ?? '';
  if (offlineRequested || apiKey.length === 0) {
    return classifyOffline(input);
  }
  const endpoint =
    override?.endpoint ?? process.env[ENDPOINT_ENV_VAR] ?? DEFAULT_ENDPOINT;
  const result = await hostedAttributeBatch(
    [input],
    {
      endpoint,
      api_key: apiKey,
      client_version: OSS_CLASSIFIER_VERSION,
      ...(override?.fetch_impl !== undefined
        ? { fetch_impl: override.fetch_impl }
        : {}),
    },
    true,
  );
  if (!result.ok) return result;
  const head = result.value[0];
  if (head === undefined) {
    return err({
      kind: 'hosted_unreachable',
      underlying: new Error('hosted endpoint returned empty results array'),
    });
  }
  return ok(head);
}

/** Batched inference. Preferred for CI — single HTTPS roundtrip per PR. */
export async function attributeBatch(
  inputs: AttributionInput[],
  override?: Partial<HostedClientOptions>,
): Promise<Result<AttributionPosterior[], AttributionError>> {
  const offlineRequested = process.env[OFFLINE_ENV_VAR] === '1';
  const apiKey = override?.api_key ?? process.env[API_KEY_ENV_VAR] ?? '';
  if (offlineRequested || apiKey.length === 0) {
    const out: AttributionPosterior[] = [];
    for (const input of inputs) {
      const r = classifyOffline(input);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return ok(out);
  }
  const endpoint =
    override?.endpoint ?? process.env[ENDPOINT_ENV_VAR] ?? DEFAULT_ENDPOINT;
  return hostedAttributeBatch(
    inputs,
    {
      endpoint,
      api_key: apiKey,
      client_version: OSS_CLASSIFIER_VERSION,
      ...(override?.fetch_impl !== undefined
        ? { fetch_impl: override.fetch_impl }
        : {}),
    },
    true,
  );
}

/** Synchronous offline-only inference. Confidence capped at 0.6. */
export function attributeOffline(
  input: AttributionInput,
): Result<AttributionPosterior, AttributionError> {
  return classifyOffline(input);
}

/**
 * Signal-only inspection — extracts the four ensemble signals without
 * running the ensemble combiner or producing a posterior. Used by the
 * explainability surface.
 */
export function extractSignals(
  input: AttributionInput,
): Result<SignalContribution[], AttributionError> {
  const v = validateInput(input);
  if (!v.ok) return v;
  return ok(extractAllSignals(input));
}
