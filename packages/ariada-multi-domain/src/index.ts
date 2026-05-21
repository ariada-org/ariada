// SPDX-License-Identifier: EUPL-1.2
/**
 * `@ariada-org/multi-domain` — single-jurisdiction reference orchestrator
 * plus the `JurisdictionPlugin` extension contract.
 *
 * The package publishes three things and only three things:
 *
 *   1. A canonical `ScanEvent` schema that downstream
 *      accessibility-compliance tooling consumes.
 *   2. A `JurisdictionPlugin` extension contract that community
 *      implementers use to register additional jurisdictions.
 *   3. A reference orchestrator that ties the two together for one
 *      jurisdiction at a time.
 *
 * The package does NOT implement:
 *
 *   - cross-jurisdiction conflict resolution;
 *   - consensus / normalisation heuristics across multiple
 *     jurisdictions;
 *   - a production rule pack for any specific jurisdiction beyond the
 *     minimal reference plugins in `./plugins`.
 *
 * Multi-jurisdiction orchestration is a paid hosted service. The
 * single-jurisdiction reference is sufficient for community
 * implementers, accessibility researchers, and downstream tools that
 * want to exercise the contract end-to-end.
 */

// Types.
export type {
  AuthContext,
  CrossJurisdictionConflictDescriptor,
  EvidenceBlob,
  Finding,
  Iso8601,
  JurisdictionSubset,
  PartialScanContext,
  ScanEvent,
  ScanInput,
  ScreenshotPolicy,
  Severity,
  Sha256Hex,
  SnapshotRef,
  Ulid,
  Viewport,
} from './types.js';

// Plugin contract.
export type { JurisdictionPlugin, JurisdictionMatch } from './plugin.js';
export { matchJurisdictionFromHints, computePassRate } from './plugin.js';

// Extension API.
export {
  JurisdictionRegistry,
  JurisdictionRegistryError,
  validatePluginShape,
} from './extension-api.js';

// Reference orchestrator.
export {
  SingleJurisdictionOrchestrator,
  type SingleJurisdictionDeps,
  type SingleJurisdictionOrchestratorConfig,
} from './single-jurisdiction.js';

// Reference plugins (minimal, copy-as-starting-point examples).
export {
  euEaaPlugin,
  sePlugin,
  dePlugin,
  EU_EAA_TOTAL_CRITERIA,
  SE_TOTAL_CRITERIA,
  DE_TOTAL_CRITERIA,
} from './plugins/index.js';
