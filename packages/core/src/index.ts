/**
 * `@ariada-org/core` is now a thin re-export shim. The pure scanner logic moved
 * to `@ariada-org/core-engine`; the Node + Playwright runtime moved to
 * `@ariada-org/core-playwright`. Existing consumers (`@ariada-org/rules-axe`,
 * `clamper`, `blamer`, `reverter`) keep importing from `@ariada-org/core` and
 * receive identical behaviour — zero breaking change.
 *
 * The future Chrome extension imports `@ariada-org/core-engine` +
 * `@ariada-org/core-browser` directly to avoid pulling Playwright into the
 * browser bundle.
 */
export {
  createEventEmitter,
  scanEventSchema,
  scoreFromCounts,
  bandFromScore,
  fingerprint,
  fingerprintAsync,
  createRegistry,
  registerAnalyzer,
  getDefaultRegistry,
  createCrossDomainDetector,
  type ScanEvent,
  type ScanEventEmitter,
  type ScanEventListener,
  type Unsubscribe,
  type Counts,
  type ScoreBand,
  type FingerprintInput,
  type AnalyzerRegistry,
  type CrossDomainDetector,
  type AnalyzerContext,
  type AXNode,
  type AXNodeRef,
  type BackendNodeId,
  type BoundingBox,
  type ConflictFinding,
  type ConflictSignature,
  type Domain,
  type DomainAnalyzer,
  type ElementTarget,
  type Finding,
  type RegulatoryRef,
  type ScanOptions,
  type ScanResult,
  type Scanner,
  type ScanStats,
  type Severity,
  type UnifiedReport,
  type UnifiedSnapshot,
} from '@ariada-org/core-engine';

export {
  scan,
  createScanner,
  launchBrowser,
  captureSnapshot,
  createLogger,
} from '@ariada-org/core-playwright';
