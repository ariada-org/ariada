// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
export { createEventEmitter } from './events.js';
export type { ScanEvent, ScanEventEmitter, ScanEventListener, Unsubscribe } from './events.js';
export { scanEventSchema } from './events-schema.js';
export {
  SCHEMAS_BASE,
  SCHEMA_URLS,
  FINDING_SCHEMA_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  ANALYZER_METADATA_SCHEMA_VERSION,
  SCAN_EVENT_SCHEMA_VERSION,
  SCAN_REPORT_INPUT_SCHEMA_VERSION,
  VPAT_INPUT_SCHEMA_VERSION,
} from './schema-version.js';
export {
  findingSchema,
  severitySchema,
  domainSchema,
  regulatoryFrameworkSchema,
  regulatoryRefSchema,
  axNodeRefSchema,
  findingSchemaVersion,
} from './finding-schema.js';
export type { FindingSchemaInput, FindingSchemaOutput } from './finding-schema.js';
export {
  unifiedSnapshotSchema,
  axNodeSchema,
  snapshotSchemaVersion,
} from './snapshot-schema.js';
export type { UnifiedSnapshotSchemaOutput } from './snapshot-schema.js';
export {
  analyzerMetadataSchema,
  analyzerMetadataSchemaVersion,
} from './analyzer-metadata-schema.js';
export type { AnalyzerMetadataSchemaOutput } from './analyzer-metadata-schema.js';
export {
  scanReportInputSchema,
  scanReportInputSchemaVersion,
} from './scan-report-input-schema.js';
export type { ScanReportInput } from './scan-report-input-schema.js';
export {
  vpatInputSchema,
  vpatConformanceLevelSchema,
  vpatStandardSchema,
  vpatCriterionSchema,
  vpatInputSchemaVersion,
} from './vpat-input-schema.js';
export type { VpatInput } from './vpat-input-schema.js';
export {
  validateAnalyzerResult,
  safeValidateAnalyzerResult,
  validateSnapshot,
  validateAnalyzerMetadata,
  validateScanReportInput,
  validateVpatInput,
} from './validators.js';
export { scoreFromCounts, bandFromScore } from './scoring.js';
export type { Counts, ScoreBand } from './scoring.js';
export { fingerprint, fingerprintAsync } from './fingerprint.js';
export type { FingerprintInput } from './fingerprint.js';
export {
  createRegistry,
  registerAnalyzer,
  getDefaultRegistry,
  type AnalyzerRegistry,
} from './registry.js';
export { createCrossDomainDetector, type CrossDomainDetector } from './cross-domain.js';
export {
  runElementIteration,
  type BoundingBoxResolver,
  type IterOptions,
} from './element-iter.js';
export { runOrchestration, type RunOrchestrationOpts } from './orchestrator.js';
export {
  createConsoleLogger,
  createNullLogger,
  type Logger,
} from './logger.js';
export { PATENT_BINDING_MARKER } from './patent-binding.js';
export type {
  AnalyzerContext,
  AnalyzerMetadata,
  AXNode,
  AXNodeRef,
  BackendNodeId,
  BoundingBox,
  ConflictFinding,
  ConflictSignature,
  Domain,
  DomainAnalyzer,
  ElementTarget,
  Finding,
  RegulatoryRef,
  ScanOptions,
  ScanResult,
  Scanner,
  ScanStats,
  Severity,
  UnifiedReport,
  UnifiedSnapshot,
} from './types.js';
// `Analyzer` is the canonical short alias for `DomainAnalyzer` — both names
// reach the same interface so consumers can write the more ergonomic
// `Analyzer` while the internal naming reflects the per-domain-aware shape.
export type { DomainAnalyzer as Analyzer } from './types.js';

// Bundled reference analyzer — minimal worked example for the v0.1 contract.
export {
  createColorContrastAnalyzer,
  colorContrastAnalyzer,
  contrastRatio,
  parseColor,
  relativeLuminance,
  COLOR_CONTRAST_DOMAIN,
  COLOR_CONTRAST_RULE_ID,
  COLOR_CONTRAST_VERSION,
  LARGE_TEXT_RATIO,
  NORMAL_TEXT_RATIO,
} from './analyzers/color-contrast.js';
