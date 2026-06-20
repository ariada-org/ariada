// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export type {
  PolicyAction,
  GateResult,
  DetectionTier,
  ContentRule,
  RulePack,
  ContentProfile,
  ContentFinding,
  ContentGateDecision,
  UnevaluatedRule,
  SemanticEvaluator,
  SemanticRequest,
  SemanticHit,
} from './types.js';
export { evaluateContent, evaluateContentAsync, promptProfile, contentFingerprint } from './evaluate.js';
export {
  createRecursiveEvaluator,
  createRulePackPrefilter,
  wrapForEvaluateContentAsync,
  getBudgetExhaustion,
} from './recursive.js';
export type {
  RecursiveEvaluatorOptions,
  RecursiveEvaluator,
  RecursiveEvaluationResult,
  RlmMetrics,
  EvaluateOptions,
} from './recursive.js';
export type {
  HostDispatchedLeaf,
  ManagedApiLeaf,
} from './adapters.js';
export {
  isHostDispatchedLeaf,
  isManagedApiLeaf,
} from './adapters.js';
export {
  buildBaseline,
  detectRegression,
} from './reverter.js';
export type { ReverterBaseline, RegressionFinding } from './reverter.js';

import { noSecretsPack } from './rule-packs/no-secrets.js';
import { ossSurfacePack } from './rule-packs/oss-surface.js';
import type { ContentProfile, RulePack } from './types.js';

export { noSecretsPack } from './rule-packs/no-secrets.js';
export { ossSurfacePack } from './rule-packs/oss-surface.js';

/** Built-in rule-packs, keyed by id, for the default profiles. */
export const builtinPacks: RulePack[] = [noSecretsPack, ossSurfacePack];

/**
 * Default profile for any public open-source surface: composes the shared
 * no-secrets pack with the oss-surface overlay, and allow-lists the
 * widely-known abbreviations that are safe even though they look like codenames
 * or contain forbidden-looking substrings.
 */
export const ossSurfaceProfile: ContentProfile = {
  id: 'oss-surface',
  surface: 'public-oss',
  packs: ['no-secrets', 'oss-surface'],
  allowlist: ['WCAG', 'EAA', 'GDPR', 'OSI', 'FSF'],
};
