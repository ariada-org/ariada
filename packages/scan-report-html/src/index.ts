// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * `@ariada/scan-report-html` — public entrypoint.
 *
 * Two overloads:
 *
 *   1. Pure call — returns HTML string synchronously, no I/O:
 *
 *        const html: string = renderScanReport(input);
 *
 *   2. Disk-write — async, writes self-contained file under `outputDir`:
 *
 *        const { path, bytes } = await renderScanReport(input, { outputDir });
 *
 * The split keeps the pure transform unit-testable in any environment, while
 * the disk overload is the convenience surface used by the CLI + the
 * `eaa-pipeline` GitHub Action.
 */

import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { renderHtml } from './render.js';
import type {
  RenderOptions,
  ScanReportInput,
  ScanReportWriteOptions,
  ScanReportWriteResult,
} from './types.js';

export type {
  BoundingBox,
  RenderOptions,
  ScanFinding,
  ScanMeta,
  ScanReportInput,
  ScanReportWriteOptions,
  ScanReportWriteResult,
  Severity,
  ViolationNode,
} from './types.js';

export {
  bandFromScore,
  computeComplianceScore,
  severityBreakdown,
  topActionItems,
} from './score.js';
export type { ScoreBand } from './score.js';

export { WCAG_22_SC_SLUG, wcagSCUrl } from './wcag-sc-slugs.js';

export { escapeHtml, escapeAndTruncate, escapeUrl } from './escape.js';

/**
 * Pure overload — returns HTML string. No I/O. Deterministic.
 */
export function renderScanReport(
  input: ScanReportInput,
  options?: RenderOptions,
): string;
/**
 * Disk-write overload — returns `{ path, bytes }` after writing the file
 * under `outputDir`. Creates the directory if it does not exist.
 */
export function renderScanReport(
  input: ScanReportInput,
  options: ScanReportWriteOptions,
): Promise<ScanReportWriteResult>;
export function renderScanReport(
  input: ScanReportInput,
  options?: RenderOptions | ScanReportWriteOptions,
): string | Promise<ScanReportWriteResult> {
  if (options !== undefined && 'outputDir' in options) {
    return writeScanReport(input, options);
  }
  return renderHtml(input, options ?? {});
}

async function writeScanReport(
  input: ScanReportInput,
  options: ScanReportWriteOptions,
): Promise<ScanReportWriteResult> {
  const filename = options.filename ?? 'scan-report.html';
  const html = renderHtml(input, options.render ?? {});
  await mkdir(options.outputDir, { recursive: true });
  const fullPath = join(options.outputDir, filename);
  const bytes = Buffer.byteLength(html, 'utf8');
  await writeFile(fullPath, html, { encoding: 'utf8' });
  return { path: fullPath, bytes };
}
