// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Runtime validator for `AnalyzerMetadata` (PRD §3.2). Optional today; the
 * engine validates only structure, not semantic correctness of mappings.
 */
import { z } from 'zod';

import { regulatoryRefSchema, severitySchema } from './finding-schema.js';
import { ANALYZER_METADATA_SCHEMA_VERSION } from './schema-version.js';

export const analyzerMetadataSchema = z.object({
  displayName: z.string().min(1),
  description: z.string().min(1),
  helpUrl: z.string().optional(),
  defaultSeverity: severitySchema,
  regulatoryMappings: z.array(regulatoryRefSchema),
  wcagSuccessCriteria: z.array(z.string()).optional(),
  en301549Clauses: z.array(z.string()).optional(),
  eaaAnnexI: z.array(z.string()).optional(),
  bfsgArt: z.array(z.string()).optional(),
  rgaaCriteres: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 *
 */
export type AnalyzerMetadataSchemaOutput = z.output<typeof analyzerMetadataSchema>;

/** Schema-version literal for routing. v0.1. */
export const analyzerMetadataSchemaVersion = ANALYZER_METADATA_SCHEMA_VERSION;
