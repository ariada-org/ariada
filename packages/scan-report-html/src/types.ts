// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Public types for `@ariada-org/scan-report-html`.
 *
 * These types mirror — but do NOT re-import — the upstream emitter package
 * shapes. Keeping the renderer's contract local lets it accept any emitter
 * compatible with the documented schema, including future emitter versions
 * or third-party adapters.
 */

/**
 *
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Bounding box in viewport pixel coordinates. Populated by the Playwright
 * runner for every violation node that resolved to a layout box.
 *
 * `w`/`h` (not `width`/`height`) because this mirrors the core-engine
 * `BoundingBox` shape (see packages/core-engine/src/types.ts).
 */
export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A single violation node — one DOM element flagged by one rule.
 */
export interface ViolationNode {
  /** CSS selector — what to render in the «Selector» line of the card. */
  selector: string;
  /** HTML snippet (already escaped or escapable). Truncated at 200 chars. */
  html?: string;
  /** Layout box in viewport pixel coordinates — used to crop screenshots. */
  bbox?: BoundingBox;
  /** Per-node failure summary (axe-core idiom). */
  failureSummary?: string;
}

/**
 * Normalised finding — one violation per rule, possibly affecting many nodes.
 *
 * Compatible with the axe-core `Result` shape, the core-engine `Finding`
 * shape, and the evidence-emitter `Violation` shape — all three converge on
 * this minimum surface.
 */
export interface ScanFinding {
  /** Axe-core rule ID (e.g. `color-contrast`, `image-alt`). */
  id: string;
  /** Severity impact. */
  impact: Severity;
  /** Plain-English description. */
  description: string;
  /** Imperative help text — one-liner displayed under description. */
  help: string;
  /** URL to per-rule documentation. */
  helpUrl?: string;
  /** WCAG 2.2 SC numbers this finding maps to (e.g. ['1.4.3', '1.4.11']). */
  wcag: string[];
  /** Nodes affected. */
  nodes: ViolationNode[];
}

/**
 * Site-level metadata captured at scan time.
 */
export interface ScanMeta {
  /** URL scanned. */
  url: string;
  /** ISO 8601 timestamp of scan start. */
  timestamp: string;
  /** Scanner package version (e.g. `0.1.0`). Drives basic-mode fallback. */
  scannerVersion: string;
  /** Axe-core version. */
  axeVersion?: string;
  /** WCAG version (default `2.2`). */
  wcagVersion?: string;
  /** EN 301 549 version (default `3.2.1`). */
  en301549Version?: string;
  /** Browser engine identifier (e.g. `Chromium/124`). */
  userAgent?: string;
  /** Viewport size as `WxH` string. */
  viewport?: string;
  /** Scan duration in milliseconds. */
  durationMs?: number;
}

/**
 * Pure-call input — used when the renderer can NOT do disk I/O (synchronous
 * single-string return path).
 */
export interface ScanReportInput {
  meta: ScanMeta;
  findings: ScanFinding[];
  /**
   * Optional full-page screenshot bytes. When provided alongside `bbox` on
   * findings, the renderer will crop per-violation previews; otherwise the
   * card displays «(no preview available)» placeholders.
   */
  screenshot?: Uint8Array;
}

/**
 * Optional render-time switches. All default off / safe.
 */
export interface RenderOptions {
  /**
   * Show penalty exposure block. Default `false` — avoids «scary number»
   * framing without explicit opt-in.
   */
  includePenalty?: boolean;
  /**
   * Locale for static prose (badge labels, section headings). Default `'en'`.
   */
  locale?: 'en';
  /**
   * Strip internal HTML comments (e.g. cert-block hookpoint) for release
   * surface. Default `true`.
   */
  releaseBuild?: boolean;
}

/**
 * Disk-write result returned by the async `renderScanReport(input, { outputDir })`
 * overload.
 */
export interface ScanReportWriteResult {
  /** Absolute path of the written `scan-report.html`. */
  path: string;
  /** Byte length of the written file. */
  bytes: number;
}

/**
 * Disk-write options.
 */
export interface ScanReportWriteOptions {
  /** Directory that will contain `scan-report.html`. Created if missing. */
  outputDir: string;
  /** Optional override for the output filename. Default `'scan-report.html'`. */
  filename?: string;
  /** Render-time options (forwarded to the pure renderer). */
  render?: RenderOptions;
}
