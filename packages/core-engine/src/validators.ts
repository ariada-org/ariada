// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Throwing parse helpers that wrap the Zod schemas with friendlier error
 * surfaces. Each helper accepts `unknown` (the realistic shape at the package
 * boundary) and either returns the parsed-typed value or throws a `ZodError`
 * with the offending path attached.
 *
 * `validateAnalyzerResult` is the canonical helper the PRD asks for — given an
 * arbitrary payload claiming to be a Finding, it either returns a typed
 * `Finding` or throws. Mirror helpers exist for the other top-level schemas.
 */
import type { ZodError } from 'zod';

import { analyzerMetadataSchema } from './analyzer-metadata-schema.js';
import { findingSchema } from './finding-schema.js';
import { scanReportInputSchema, type ScanReportInput } from './scan-report-input-schema.js';
import { unifiedSnapshotSchema } from './snapshot-schema.js';
import type {
  AnalyzerMetadata,
  Finding,
  UnifiedSnapshot,
} from './types.js';
import { vpatInputSchema, type VpatInput } from './vpat-input-schema.js';

/**
 * Parse `input` as a Finding. Throws `ZodError` on shape mismatch. Returns a
 * typed `Finding` (TypeScript view) on success. Use at package boundaries —
 * SSE consumers, queue workers, IPC handlers, anywhere a raw `unknown` lands.
 */
export function validateAnalyzerResult(input: unknown): Finding {
  return findingSchema.parse(input) as Finding;
}

/**
 * Like `validateAnalyzerResult` but returns the structured `ZodError` instead
 * of throwing. Useful for batch validators that drop-and-log invalid payloads.
 */
export function safeValidateAnalyzerResult(
  input: unknown,
): { ok: true; value: Finding } | { ok: false; error: ZodError } {
  const result = findingSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data as Finding };
  return { ok: false, error: result.error };
}

/** Throwing parse for `UnifiedSnapshot`. */
export function validateSnapshot(input: unknown): UnifiedSnapshot {
  return unifiedSnapshotSchema.parse(input) as UnifiedSnapshot;
}

/** Throwing parse for `AnalyzerMetadata`. */
export function validateAnalyzerMetadata(input: unknown): AnalyzerMetadata {
  return analyzerMetadataSchema.parse(input) as AnalyzerMetadata;
}

/** Throwing parse for `ScanReportInput`. */
export function validateScanReportInput(input: unknown): ScanReportInput {
  return scanReportInputSchema.parse(input);
}

/** Throwing parse for `VpatInput`. */
export function validateVpatInput(input: unknown): VpatInput {
  return vpatInputSchema.parse(input);
}
