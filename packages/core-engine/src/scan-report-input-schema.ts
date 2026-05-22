// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Runtime validator for `ScanReportInput` — the input shape the future
 * `@ariada-org/scan-report-html` renderer consumes. Defined at the engine boundary
 * so renderers depend on the engine, not vice versa.
 *
 * Shape: a frozen subset of `UnifiedReport` plus renderer-only hints
 * (timestamp, locale, optional branding overrides). The renderer trusts the
 * shape after `scanReportInputSchema.parse` — invalid payloads are dropped
 * with a clear error pointing at the offending field.
 */
import { z } from 'zod';

import { findingSchema, severitySchema } from './finding-schema.js';
import { SCAN_REPORT_INPUT_SCHEMA_VERSION } from './schema-version.js';

const countsSchema = z.object({
  critical: z.number().int().nonnegative(),
  serious: z.number().int().nonnegative(),
  moderate: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
});

const scanStatsSchema = z.object({
  totalViolations: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  analyzersRun: z.array(z.string()),
  elementsScanned: z.number().int().nonnegative(),
});

export const scanReportInputSchema = z.object({
  schemaVersion: z.literal(SCAN_REPORT_INPUT_SCHEMA_VERSION),
  scanId: z.string().min(1),
  url: z.string().min(1),
  generatedAt: z.number().int().nonnegative(),
  locale: z.string().min(2).optional(),
  findings: z.array(findingSchema),
  counts: countsSchema,
  score: z.number().min(0).max(100),
  topCategories: z
    .array(z.object({ ruleId: z.string().min(1), count: z.number().int().nonnegative() }))
    .optional(),
  stats: scanStatsSchema.optional(),
  branding: z
    .object({
      productName: z.string().optional(),
      logoUrl: z.string().optional(),
    })
    .optional(),
  highestSeverity: severitySchema.optional(),
});

/**
 *
 */
export type ScanReportInput = z.infer<typeof scanReportInputSchema>;

/** Schema-version literal for routing. v0.1. */
export const scanReportInputSchemaVersion = SCAN_REPORT_INPUT_SCHEMA_VERSION;
