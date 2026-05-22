// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Runtime validator for `Finding` and supporting building blocks —
 * `Severity`, `RegulatoryRef`, `AXNodeRef`, `Domain`. Mirrors `types.ts`
 * one-for-one. Kept in its own module so consumers that only need types can
 * tree-shake out the entire `zod` dependency.
 *
 * Schema-version policy: the `findingSchema` itself is the boundary check;
 * the parallel `schemaVersion` literal is exported separately for downstream
 * routing.
 */
import { z } from 'zod';

import { FINDING_SCHEMA_VERSION } from './schema-version.js';

export const severitySchema = z.enum(['critical', 'serious', 'moderate', 'minor']);

/**
 * `Domain` is an open string union. Engine code that switches on
 * domain MUST include a default arm.
 */
export const domainSchema = z.string().min(1);

export const regulatoryFrameworkSchema = z.enum([
  'WCAG',
  'EN 301 549',
  'ADA',
  'EAA',
  'GDPR',
  'Section 508',
]);

export const regulatoryRefSchema = z.object({
  framework: regulatoryFrameworkSchema,
  code: z.string().min(1),
});

export const axNodeRefSchema = z.object({
  backendNodeId: z.number().int().optional(),
  selector: z.string(),
  role: z.string().optional(),
  name: z.string().optional(),
});

export const findingSchema = z.object({
  id: z.string().min(1),
  scanId: z.string().min(1),
  domain: domainSchema,
  ruleId: z.string().min(1),
  severity: severitySchema,
  element: axNodeRefSchema,
  message: z.string().min(1),
  criterion: z.string().optional(),
  wcagMapping: z.array(z.string()).optional(),
  regulatoryMapping: z.array(regulatoryRefSchema).optional(),
  fingerprint: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 *
 */
export type FindingSchemaInput = z.input<typeof findingSchema>;
/**
 *
 */
export type FindingSchemaOutput = z.output<typeof findingSchema>;

/**
 * Re-exported alongside the schema for downstream consumers that want to route
 * on `schemaVersion`. v0.1.
 */
export const findingSchemaVersion = FINDING_SCHEMA_VERSION;
