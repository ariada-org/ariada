// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';

/**
 * Runtime validator for the locked `ScanEvent` contract. Imported separately
 * from `events.ts` so consumers that don't need runtime validation (notably
 * the in-browser bundle) can tree-shake out the entire `zod` dependency.
 *
 * The shape mirrors `events.ts`'s `ScanEvent` type one-for-one — keep the two
 * in sync if `ScanEvent` is ever expanded.
 */
const severityEnum = z.enum(['critical', 'serious', 'moderate', 'minor']);

const bboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const scanEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('scan_started'),
    scan_id: z.string(),
    url: z.string(),
    element_count: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('element_scan'),
    scan_id: z.string(),
    seq: z.number().int().nonnegative(),
    selector: z.string(),
    bbox: bboxSchema,
    status: z.enum(['scanning', 'passed', 'violated']),
    violations: z
      .array(
        z.object({
          rule_id: z.string(),
          severity: severityEnum,
          criterion: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
  }),
  z.object({
    kind: z.literal('scan_complete'),
    scan_id: z.string(),
    score: z.number(),
    scorecard_slug: z.string().optional(),
    counts: z.object({
      critical: z.number().int().nonnegative(),
      serious: z.number().int().nonnegative(),
      moderate: z.number().int().nonnegative(),
      minor: z.number().int().nonnegative(),
    }),
    top_categories: z.array(z.object({ rule_id: z.string(), count: z.number().int() })),
  }),
  z.object({
    kind: z.literal('scan_error'),
    scan_id: z.string(),
    error: z.string(),
  }),
]);
