// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Runtime validator for `VpatInput` — the input shape the future
 * `@ariada-org/vpat-html-renderer` consumes. Mirrors the ITI VPAT 2.5 procurement
 * document structure (vendor info + criterion-by-criterion conformance
 * statements) and is intentionally renderer-agnostic.
 *
 * The shape is independent of `scanReportInputSchema`: a VPAT is a
 * vendor-asserted document with per-criterion `level` + optional remarks; a
 * scan report is empirical. Renderers MAY derive a VPAT-input draft from
 * scan-report findings but the contract between renderer and engine is the
 * VPAT-input shape, not the scan-report shape.
 */
import { z } from 'zod';

import { VPAT_INPUT_SCHEMA_VERSION } from './schema-version.js';

export const vpatConformanceLevelSchema = z.enum([
  'supports',
  'partially-supports',
  'does-not-support',
  'not-applicable',
  'not-evaluated',
]);

export const vpatStandardSchema = z.enum([
  'WCAG-2.0',
  'WCAG-2.1',
  'WCAG-2.2',
  'EN-301-549',
  'Section-508',
  'Revised-Section-508',
]);

export const vpatCriterionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  level: vpatConformanceLevelSchema,
  remarks: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});

export const vpatInputSchema = z.object({
  schemaVersion: z.literal(VPAT_INPUT_SCHEMA_VERSION),
  product: z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().optional(),
  }),
  vendor: z.object({
    name: z.string().min(1),
    contactEmail: z.string().email().optional(),
    address: z.string().optional(),
  }),
  evaluatedAt: z.number().int().nonnegative(),
  evaluator: z
    .object({
      name: z.string().min(1),
      role: z.string().optional(),
    })
    .optional(),
  standards: z.array(vpatStandardSchema).min(1),
  criteria: z.array(vpatCriterionSchema).min(1),
  notes: z.string().optional(),
});

/**
 *
 */
export type VpatInput = z.infer<typeof vpatInputSchema>;

/** Schema-version literal for routing. v0.1. */
export const vpatInputSchemaVersion = VPAT_INPUT_SCHEMA_VERSION;
