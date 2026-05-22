// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Schema-version + canonical base-URL constants shared by every Zod schema
 * published by `@ariada-org/core-engine` (schema versioning policy).
 *
 * `SCHEMAS_BASE` deliberately uses `schemas.ariada.org` (NOT `.ai`) so OSS
 * consumers depend on the public-commons surface rather than the commercial
 * brand subdomain. The sister `@ariada-org/ariada-evidence-emitter` package still
 * references the old `.ai` host; that migration is tracked separately.
 *
 * Each top-level schema (Finding, UnifiedSnapshot, AnalyzerMetadata,
 * ScanReportInput, VpatInput) ships with a parallel `schemaVersion` literal so
 * downstream consumers can route on version. v0.1 is the initial cut.
 */

/**
 * Canonical base URL for JSON-Schema / OpenAPI artifacts referenced by
 * `@ariada-org/core-engine` outputs. Sister packages MUST migrate to this base.
 */
export const SCHEMAS_BASE = 'https://schemas.ariada.org' as const;

/** Schema version stamped on every Finding payload. */
export const FINDING_SCHEMA_VERSION = '0.1' as const;

/** Schema version stamped on every UnifiedSnapshot payload. */
export const SNAPSHOT_SCHEMA_VERSION = '0.1' as const;

/** Schema version stamped on every AnalyzerMetadata payload. */
export const ANALYZER_METADATA_SCHEMA_VERSION = '0.1' as const;

/** Schema version stamped on every ScanEvent payload. */
export const SCAN_EVENT_SCHEMA_VERSION = '0.1' as const;

/** Schema version stamped on every ScanReportInput payload. */
export const SCAN_REPORT_INPUT_SCHEMA_VERSION = '0.1' as const;

/** Schema version stamped on every VpatInput payload. */
export const VPAT_INPUT_SCHEMA_VERSION = '0.1' as const;

/**
 * Fully-qualified `$schema` URLs per top-level schema. Useful for consumers
 * that want to embed the URL into emitted payloads (e.g., evidence files).
 */
export const SCHEMA_URLS = {
  finding: `${SCHEMAS_BASE}/finding/${FINDING_SCHEMA_VERSION}.json`,
  snapshot: `${SCHEMAS_BASE}/snapshot/${SNAPSHOT_SCHEMA_VERSION}.json`,
  analyzerMetadata: `${SCHEMAS_BASE}/analyzer-metadata/${ANALYZER_METADATA_SCHEMA_VERSION}.json`,
  scanEvent: `${SCHEMAS_BASE}/scan-event/${SCAN_EVENT_SCHEMA_VERSION}.json`,
  scanReportInput: `${SCHEMAS_BASE}/scan-report-input/${SCAN_REPORT_INPUT_SCHEMA_VERSION}.json`,
  vpatInput: `${SCHEMAS_BASE}/vpat-input/${VPAT_INPUT_SCHEMA_VERSION}.json`,
} as const;
