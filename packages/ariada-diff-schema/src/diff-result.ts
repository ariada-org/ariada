// SPDX-License-Identifier: EUPL-1.2
//
// DiffResult schema (§3.3). The OSS schema defines the envelope shape; the
// closed engine fills in `near_duplicate` entries and bumps the classifier
// version independently. Validation here uses plain TS runtime guards —
// downstream consumers can layer Ajv or Zod on top via the JSON Schema
// shipped in `src/schemas/diff-result.schema.json`.

import type { Finding, FingerprintOptions, Severity } from './fingerprint.js';

/** Diff schema version this package implements. */
export const DIFF_SCHEMA_VERSION = '1.0.0';

/**
 *
 */
export type Classification = 'new' | 'pre_existing' | 'resolved' | 'near_duplicate';

/**
 *
 */
export interface FindingWithFingerprint extends Finding {
  /** 64-char hex (SHA-256). */
  fingerprint: string;
}

/**
 *
 */
export interface FindingWithFingerprintAndConfidence
  extends FindingWithFingerprint {
  /** Near-duplicate match confidence in [0, 1]. */
  confidence: number;
}

/**
 *
 */
export interface DiffResultHead {
  scan_id: string;
  scan_root_hash: string;
  commit_sha?: string;
  pr_number?: number;
  branch?: string;
  environment?: string;
}

/**
 *
 */
export interface DiffResultBase {
  scan_id: string;
  scan_root_hash: string;
  commit_sha?: string;
  branch?: string;
  environment?: string;
}

/**
 *
 */
export interface ClassificationCounts {
  new: number;
  pre_existing: number;
  resolved: number;
  near_duplicate: number;
  total_head: number;
  total_base: number;
}

/**
 *
 */
export interface EngineInfo {
  classifier: 'stub' | 'canonical';
  classifier_version: string;
  fingerprint_options: FingerprintOptions;
}

/**
 *
 */
export interface DiffResult {
  diff_id: string;
  diff_version: string;
  computed_at: string;
  head: DiffResultHead;
  base: DiffResultBase;
  classification: {
    new: FindingWithFingerprint[];
    pre_existing: FindingWithFingerprint[];
    resolved: FindingWithFingerprint[];
    near_duplicate?: FindingWithFingerprintAndConfidence[];
  };
  counts: ClassificationCounts;
  engine_info: EngineInfo;
}

/**
 * Lightweight runtime validation for DiffResult shape. Returns a
 * structured result rather than throwing — callers may layer richer
 * validation via the published JSON Schema 2020-12.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const SEVERITIES: ReadonlySet<Severity> = new Set([
  'critical',
  'serious',
  'moderate',
  'minor',
]);

const CLASSIFICATIONS: ReadonlySet<Classification> = new Set([
  'new',
  'pre_existing',
  'resolved',
  'near_duplicate',
]);

const HEX_64 = /^[0-9a-f]{64}$/;

function isHex64(s: unknown): s is string {
  return typeof s === 'string' && HEX_64.test(s);
}

function validateFinding(f: unknown, path: string, errs: string[]): void {
  if (typeof f !== 'object' || f === null) {
    errs.push(`${path}: expected object`);
    return;
  }
  const o = f as Record<string, unknown>;
  if (typeof o['ruleId'] !== 'string') errs.push(`${path}.ruleId: expected string`);
  if (!Array.isArray(o['jurisdictionTags'])) {
    errs.push(`${path}.jurisdictionTags: expected array`);
  }
  if (typeof o['severity'] !== 'string' || !SEVERITIES.has(o['severity'] as Severity)) {
    errs.push(`${path}.severity: expected one of ${[...SEVERITIES].join('|')}`);
  }
  if (typeof o['selector'] !== 'string') {
    errs.push(`${path}.selector: expected string`);
  }
  if (!isHex64(o['fingerprint'])) {
    errs.push(`${path}.fingerprint: expected 64-char lowercase hex`);
  }
}

function validateTopLevelStrings(o: Record<string, unknown>, errors: string[]): void {
  if (typeof o['diff_id'] !== 'string' || o['diff_id'].length === 0) {
    errors.push('diff_id: expected non-empty string (ULID)');
  }
  if (typeof o['diff_version'] !== 'string') {
    errors.push('diff_version: expected semver string');
  }
  if (typeof o['computed_at'] !== 'string') {
    errors.push('computed_at: expected ISO 8601 string');
  }
}

function validateSide(side: 'head' | 'base', s: unknown, errors: string[]): void {
  if (typeof s !== 'object' || s === null) {
    errors.push(`${side}: expected object`);
    return;
  }
  const sv = s as Record<string, unknown>;
  if (typeof sv['scan_id'] !== 'string') errors.push(`${side}.scan_id: expected string`);
  if (typeof sv['scan_root_hash'] !== 'string') {
    errors.push(`${side}.scan_root_hash: expected string`);
  }
}

function validateClassification(cls: unknown, errors: string[]): void {
  if (typeof cls !== 'object' || cls === null) {
    errors.push('classification: expected object');
    return;
  }
  const c = cls as Record<string, unknown>;
  for (const bucket of ['new', 'pre_existing', 'resolved'] as const) {
    const arr = c[bucket];
    if (!Array.isArray(arr)) {
      errors.push(`classification.${bucket}: expected array`);
      continue;
    }
    for (let i = 0; i < arr.length; i++) {
      validateFinding(arr[i], `classification.${bucket}[${i}]`, errors);
    }
  }
}

function validateCounts(counts: unknown, errors: string[]): void {
  if (typeof counts !== 'object' || counts === null) {
    errors.push('counts: expected object');
    return;
  }
  const c = counts as Record<string, unknown>;
  for (const k of ['new', 'pre_existing', 'resolved', 'near_duplicate', 'total_head', 'total_base'] as const) {
    if (typeof c[k] !== 'number') errors.push(`counts.${k}: expected number`);
  }
}

function validateEngineInfo(engine: unknown, errors: string[]): void {
  if (typeof engine !== 'object' || engine === null) {
    errors.push('engine_info: expected object');
    return;
  }
  const e = engine as Record<string, unknown>;
  if (e['classifier'] !== 'stub' && e['classifier'] !== 'canonical') {
    errors.push("engine_info.classifier: expected 'stub' | 'canonical'");
  }
  if (typeof e['classifier_version'] !== 'string') {
    errors.push('engine_info.classifier_version: expected string');
  }
}

/**
 * Validate a DiffResult object against the v1.0 schema. Returns errors as
 * an array of `path: message` strings — empty array means valid.
 */
export function validateDiffResult(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['root: expected object'] };
  }
  const o = input as Record<string, unknown>;
  validateTopLevelStrings(o, errors);
  validateSide('head', o['head'], errors);
  validateSide('base', o['base'], errors);
  validateClassification(o['classification'], errors);
  validateCounts(o['counts'], errors);
  validateEngineInfo(o['engine_info'], errors);
  return { valid: errors.length === 0, errors };
}

/** Helper: build an empty counts object from the four buckets. */
export function computeCounts(
  classification: DiffResult['classification'],
): ClassificationCounts {
  const newCount = classification.new.length;
  const pre = classification.pre_existing.length;
  const res = classification.resolved.length;
  const nd = classification.near_duplicate?.length ?? 0;
  return {
    new: newCount,
    pre_existing: pre,
    resolved: res,
    near_duplicate: nd,
    total_head: newCount + pre + nd,
    total_base: pre + res + nd,
  };
}

export { CLASSIFICATIONS, SEVERITIES };
