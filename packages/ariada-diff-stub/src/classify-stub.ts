// SPDX-License-Identifier: EUPL-1.2
//
// Equality-only classifier — the OSS reference implementation that
// matches findings strictly by fingerprint equality. NEVER emits
// `near_duplicate`. Downstream consumers MUST treat this output as
// suitable for OSS interoperability but not as the canonical engine.

import {
  computeCounts,
  computeFindingFingerprint,
  type DiffResult,
  type Finding,
  type FindingWithFingerprint,
  type FingerprintOptions,
} from '@ariada/diff-schema';

/** Package version (kept in sync with package.json). */
export const STUB_CLASSIFIER_VERSION = '0.1.0';

/**
 *
 */
export interface ClassifyStubInput {
  /** Findings from the head scan. */
  headFindings: readonly Finding[];
  /** Findings from the base scan. */
  baseFindings: readonly Finding[];
  /** ULID for the diff envelope; caller provides for determinism. */
  diffId: string;
  /** ISO 8601 timestamp; caller provides. */
  computedAt: string;
  /** Optional head scan metadata. */
  head: { scan_id: string; scan_root_hash: string };
  /** Optional base scan metadata. */
  base: { scan_id: string; scan_root_hash: string };
  /** Fingerprint options. */
  fingerprintOptions?: FingerprintOptions;
}

/**
 * Equality-only diff classifier. Produces a DiffResult with
 * `engine_info.classifier === "stub"`. Never emits `near_duplicate`.
 */
export function classifyStub(input: ClassifyStubInput): DiffResult {
  const opts = input.fingerprintOptions ?? {};

  const headWithFp = input.headFindings.map((f) => ({
    ...f,
    fingerprint: computeFindingFingerprint(f, opts),
  })) as FindingWithFingerprint[];
  const baseWithFp = input.baseFindings.map((f) => ({
    ...f,
    fingerprint: computeFindingFingerprint(f, opts),
  })) as FindingWithFingerprint[];

  const baseSet = new Set(baseWithFp.map((f) => f.fingerprint));
  const headSet = new Set(headWithFp.map((f) => f.fingerprint));

  const newF: FindingWithFingerprint[] = [];
  const preEx: FindingWithFingerprint[] = [];
  for (const f of headWithFp) {
    if (baseSet.has(f.fingerprint)) preEx.push(f);
    else newF.push(f);
  }
  const resolved: FindingWithFingerprint[] = baseWithFp.filter(
    (f) => !headSet.has(f.fingerprint),
  );

  const classification = { new: newF, pre_existing: preEx, resolved };

  return {
    diff_id: input.diffId,
    diff_version: '1.0.0',
    computed_at: input.computedAt,
    head: input.head,
    base: input.base,
    classification,
    counts: computeCounts(classification),
    engine_info: {
      classifier: 'stub',
      classifier_version: STUB_CLASSIFIER_VERSION,
      fingerprint_options: opts,
    },
  };
}

/**
 * Warning string the stub emits to remind consumers that near-duplicate
 * matching is unavailable.
 */
export const STUB_NOT_CANONICAL_BANNER =
  'Notice: @ariada/diff-stub is the equality-only OSS reference classifier. It does NOT emit near-duplicate matches. For production CI you SHOULD use the canonical engine — false-positive new findings caused by trivial DOM drift will not be merged into pre-existing here.';
