// SPDX-License-Identifier: EUPL-1.2
//
// BaselinePolicy schema. The OSS schema defines the declarative
// shape + a reference resolver. The closed engine implements the full
// hierarchical resolution algorithm; the stub here covers the common
// cases — defaults + path overrides + jurisdiction overrides +
// first-match-wins semantics.

import type { Classification } from './diff-result.js';
import type { FingerprintOptions, Severity } from './fingerprint.js';
import { longestMatchingGlob } from './internal/glob-match.js';

/**
 *
 */
export type PolicyAction = 'fail' | 'warn' | 'info';

/**
 *
 */
export interface ActionRule {
  action: PolicyAction;
  /** Marker for resolved-celebrations etc. */
  celebrate?: boolean;
}

/**
 *
 */
export type SeverityRuleMap = {
  [K in Severity]?: ActionRule;
};

/**
 *
 */
export interface ClassificationRules extends SeverityRuleMap {
  /** Catch-all severity (used by `resolved`). */
  any?: ActionRule;
}

/**
 *
 */
export interface PathOverride {
  paths: string[];
  new?: ClassificationRules;
  pre_existing?: ClassificationRules;
  resolved?: ClassificationRules;
}

/**
 *
 */
export interface JurisdictionOverride {
  new?: ClassificationRules;
  pre_existing?: ClassificationRules;
  resolved?: ClassificationRules;
}

/**
 *
 */
export interface Exemption {
  finding_fingerprint: string;
  reason: string;
  filed_by: string;
  filed_at: string;
  expires_at: string;
  dom_signature_at_filing?: string;
  approval_chain?: Array<{ approver: string; approved_at: string }>;
}

/**
 *
 */
export interface BaselinePolicy {
  version: string;
  scope?: {
    org?: string;
    repo?: string;
    branch_patterns?: string[];
    environments?: string[];
  };
  defaults: {
    new?: ClassificationRules;
    pre_existing?: ClassificationRules;
    resolved?: ClassificationRules;
    canonical_score_delta?: {
      drop_threshold: number;
      action: PolicyAction;
    };
  };
  path_overrides?: PathOverride[];
  jurisdiction_overrides?: Record<string, JurisdictionOverride>;
  fingerprint_options?: FingerprintOptions;
  exemptions?: Exemption[];
  warn_only?: boolean;
}

/** Resolved rule for one finding. */
export interface ResolvedRule {
  action: PolicyAction;
  source: 'defaults' | 'path_overrides' | 'jurisdiction_overrides';
  reference: string;
  celebrate?: boolean;
}

/** Input to the policy resolver. */
export interface ResolveInput {
  severity: Severity;
  classification: Classification;
  path?: string;
  jurisdictionTags?: readonly string[];
}

/**
 * Resolve a policy rule for the given finding context. The resolver walks
 * path_overrides (longest match wins) → jurisdiction_overrides → defaults
 * and returns the first matching rule. If `warn_only: true`, all `fail`
 * decisions are downgraded to `warn`.
 *
 * Tie-break: path-wins-over-jurisdiction (§3.4 resolution semantics).
 */
type Bucket = Exclude<Classification, 'near_duplicate'>;

function withCelebrate(
  base: ResolvedRule,
  celebrate?: boolean,
): ResolvedRule {
  return celebrate !== undefined ? { ...base, celebrate } : base;
}

function tryPathOverride(
  policy: BaselinePolicy,
  cls: Bucket,
  severity: Severity,
  path: string,
): ResolvedRule | null {
  if (!policy.path_overrides) return null;
  const allPaths: string[] = [];
  const indexByPath = new Map<string, number>();
  for (let i = 0; i < policy.path_overrides.length; i++) {
    const ov = policy.path_overrides[i];
    if (!ov) continue;
    for (const p of ov.paths) {
      allPaths.push(p);
      if (!indexByPath.has(p)) indexByPath.set(p, i);
    }
  }
  const best = longestMatchingGlob(path, allPaths);
  if (best === null) return null;
  const i = indexByPath.get(best);
  if (i === undefined) return null;
  const ov = policy.path_overrides[i];
  const rule = pickRule(ov?.[cls], severity);
  if (!rule) return null;
  return withCelebrate(
    {
      action: rule.action,
      source: 'path_overrides',
      reference: `path_overrides[${i}]`,
    },
    rule.celebrate,
  );
}

function tryJurisdictionOverride(
  policy: BaselinePolicy,
  cls: Bucket,
  severity: Severity,
  tags: readonly string[],
): ResolvedRule | null {
  if (!policy.jurisdiction_overrides) return null;
  for (const tag of tags) {
    const ov = policy.jurisdiction_overrides[tag];
    if (!ov) continue;
    const rule = pickRule(ov[cls], severity);
    if (rule) {
      return withCelebrate(
        {
          action: rule.action,
          source: 'jurisdiction_overrides',
          reference: `jurisdiction_overrides.${tag}`,
        },
        rule.celebrate,
      );
    }
  }
  return null;
}

function tryDefault(
  policy: BaselinePolicy,
  cls: Bucket,
  severity: Severity,
): ResolvedRule | null {
  const rule = pickRule(policy.defaults[cls], severity);
  if (!rule) return null;
  return withCelebrate(
    {
      action: rule.action,
      source: 'defaults',
      reference: `defaults.${cls}.${severity}`,
    },
    rule.celebrate,
  );
}

/**
 * Resolve a policy rule for the given finding context. The resolver walks
 * path_overrides (longest match wins) → jurisdiction_overrides → defaults
 * and returns the first matching rule. If `warn_only: true`, all `fail`
 * decisions are downgraded to `warn`.
 */
export function resolvePolicy(
  policy: BaselinePolicy,
  input: ResolveInput,
): ResolvedRule {
  const cls: Bucket =
    input.classification === 'near_duplicate' ? 'pre_existing' : input.classification;

  let resolved: ResolvedRule | null = null;
  if (input.path) {
    resolved = tryPathOverride(policy, cls, input.severity, input.path);
  }
  if (resolved === null && input.jurisdictionTags) {
    resolved = tryJurisdictionOverride(policy, cls, input.severity, input.jurisdictionTags);
  }
  if (resolved === null) {
    resolved = tryDefault(policy, cls, input.severity);
  }
  if (resolved === null) {
    resolved = {
      action: 'info',
      source: 'defaults',
      reference: 'defaults.implicit',
    };
  }

  if (policy.warn_only === true && resolved.action === 'fail') {
    resolved = { ...resolved, action: 'warn' };
  }
  return resolved;
}

function pickRule(
  bucket: ClassificationRules | undefined,
  severity: Severity,
): ActionRule | undefined {
  if (!bucket) return undefined;
  if (bucket[severity]) return bucket[severity];
  if (bucket.any) return bucket.any;
  return undefined;
}

/**
 * Lightweight validation of BaselinePolicy shape.
 */
export function validateBaselinePolicy(input: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['root: expected object'] };
  }
  const o = input as Record<string, unknown>;
  if (typeof o['version'] !== 'string') {
    errors.push('version: expected string');
  }
  if (typeof o['defaults'] !== 'object' || o['defaults'] === null) {
    errors.push('defaults: expected object');
  }
  if (o['warn_only'] !== undefined && typeof o['warn_only'] !== 'boolean') {
    errors.push('warn_only: expected boolean if present');
  }
  return { valid: errors.length === 0, errors };
}

/** Default policy that ships sensible enforcement out-of-the-box. */
export function defaultPolicy(): BaselinePolicy {
  return {
    version: '1.0',
    defaults: {
      new: {
        critical: { action: 'fail' },
        serious: { action: 'fail' },
        moderate: { action: 'warn' },
        minor: { action: 'warn' },
      },
      pre_existing: {
        critical: { action: 'warn' },
        serious: { action: 'warn' },
        moderate: { action: 'info' },
        minor: { action: 'info' },
      },
      resolved: {
        any: { action: 'info', celebrate: true },
      },
    },
    warn_only: false,
  };
}
