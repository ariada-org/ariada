// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Runtime validator for `UnifiedSnapshot` and supporting building
 * blocks — `AXNode`. Adapters MUST produce snapshots that validate against
 * `unifiedSnapshotSchema` (the adapter contract).
 *
 * Kept separate from `finding-schema.ts` so consumers can import only the
 * schemas they need.
 */
import { z } from 'zod';

import { SNAPSHOT_SCHEMA_VERSION } from './schema-version.js';

const axNodePropertyValueSchema = z.object({
  type: z.string(),
  value: z.unknown(),
});

const axNodePropertySchema = z.object({
  name: z.string(),
  value: axNodePropertyValueSchema,
});

const axNodeNameOrRoleSchema = z.object({
  type: z.string(),
  value: z.unknown(),
});

export const axNodeSchema = z.object({
  nodeId: z.string().min(1),
  backendDOMNodeId: z.number().int().optional(),
  role: axNodeNameOrRoleSchema.optional(),
  name: axNodeNameOrRoleSchema.optional(),
  properties: z.array(axNodePropertySchema).optional(),
  childIds: z.array(z.string()).optional(),
  ignored: z.boolean().optional(),
  ignoredReasons: z.array(z.unknown()).optional(),
  frameId: z.string().optional(),
});

const domOutlineEntrySchema = z.object({
  backendNodeId: z.number().int(),
  nodeName: z.string(),
  selector: z.string(),
  frameId: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
});

const networkResourceSchema = z.object({
  url: z.string(),
  status: z.number().int().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().optional(),
});

const timingsSchema = z.object({
  navigationMs: z.number().nonnegative(),
  axTreeMs: z.number().nonnegative(),
  domMs: z.number().nonnegative(),
  totalMs: z.number().nonnegative(),
});

export const unifiedSnapshotSchema = z.object({
  scanId: z.string().min(1),
  url: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  axTree: z.array(axNodeSchema),
  domOutline: z.array(domOutlineEntrySchema),
  perfMetrics: z.record(z.string(), z.number()),
  networkResources: z.array(networkResourceSchema),
  screenshot: z.instanceof(Uint8Array).optional(),
  timings: timingsSchema,
});

/**
 *
 */
export type UnifiedSnapshotSchemaOutput = z.output<typeof unifiedSnapshotSchema>;

/** Schema-version literal for routing. v0.1. */
export const snapshotSchemaVersion = SNAPSHOT_SCHEMA_VERSION;
