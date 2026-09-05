// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/adapter.js` and `dist/adapter.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { execFile } from 'node:child_process';

export type ScanTarget = 'preview' | 'published';
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface PlasmicPageContext {
  projectId: string;
  projectName: string;
  pageId: string;
  pageName: string;
  previewUrl?: string;
  publishedUrl?: string;
}

export interface PlasmicScanBoundary {
  getCurrentPage(): Promise<PlasmicPageContext>;
}

export interface AriadaFinding {
  id: string;
  ruleId: string;
  severity: Severity;
  message: string;
  selector?: string;
}

export interface AriadaReport {
  findings: AriadaFinding[];
  summary?: { total?: number; passed?: number };
}

export interface PlasmicScanResult {
  projectId: string;
  projectName: string;
  pageId: string;
  pageName: string;
  target: ScanTarget;
  url: string;
  findings: AriadaFinding[];
  totalFindings: number;
  passed: number;
  status: 'passed' | 'failed';
}

export type AriadaScanner = (url: string) => Promise<unknown>;

/**
 * Scan the page the editor is currently on.
 *
 * The preview address is the default: the point of scanning from inside a
 * builder is to see the change before it ships, and a missing address is an
 * error naming which of the two was asked for rather than a silent fall back to
 * the other.
 *
 * @param boundary - how to ask the editor where it is
 * @param scan - how to scan an address
 * @param target - preview or published
 * @returns the result
 */
export async function scanPlasmicPage(
  boundary: PlasmicScanBoundary,
  scan: AriadaScanner,
  target: ScanTarget = 'preview',
): Promise<PlasmicScanResult> {
  const page = await boundary.getCurrentPage();
  const url = target === 'preview' ? page.previewUrl : page.publishedUrl;
  if (!url) {
    throw new Error(`Plasmic ${target} URL is not available for the current page.`);
  }
  const report = mapAriadaReport(await scan(url));
  return {
    projectId: requireText(page.projectId, 'projectId'),
    projectName: requireText(page.projectName, 'projectName'),
    pageId: requireText(page.pageId, 'pageId'),
    pageName: requireText(page.pageName, 'pageName'),
    target,
    url,
    findings: report.findings,
    totalFindings: report.findings.length,
    passed: report.summary?.passed ?? 0,
    status: report.findings.length === 0 ? 'passed' : 'failed',
  };
}

/**
 * Read a scanner report, refusing anything malformed.
 *
 * This one is strict where its neighbours are forgiving, and the difference is
 * deliberate: those map a report into a summary, this one hands findings to a
 * panel inside somebody's editor. A finding with no severity would render as a
 * blank badge, which reads as a passing check.
 *
 * @param value - the scanner's output
 * @returns the report
 */
export function mapAriadaReport(value: unknown): AriadaReport {
  if (!isRecord(value) || !Array.isArray(value['findings'])) {
    throw new Error('Ariada report must contain a findings array.');
  }
  const findings = value['findings'].map((item, index) => {
    if (!isRecord(item)) throw new Error(`Ariada finding ${index} is not an object.`);
    const severity = item['severity'];
    if (!isSeverity(severity)) throw new Error(`Ariada finding ${index} has invalid severity.`);
    return {
      id: String(item['id'] ?? item['ruleId'] ?? `finding-${index + 1}`),
      ruleId: String(item['ruleId'] ?? item['id'] ?? 'ariada/unknown'),
      severity,
      message: String(
        item['message'] ?? item['description'] ?? 'Ariada reported an accessibility finding.',
      ),
      ...(typeof item['selector'] === 'string' ? { selector: item['selector'] } : {}),
    };
  });
  const rawSummary = value['summary'];
  const summary = isRecord(rawSummary)
    ? {
        ...(numberOrUndefined(rawSummary['total']) !== undefined
          ? { total: numberOrUndefined(rawSummary['total']) }
          : {}),
        ...(numberOrUndefined(rawSummary['passed']) !== undefined
          ? { passed: numberOrUndefined(rawSummary['passed']) }
          : {}),
      }
    : undefined;
  return { findings, summary };
}

/**
 * A scanner that shells out to the command-line tool.
 *
 * The buffer is ten megabytes because a full report of a long page exceeds the
 * default, and a truncated report parses as broken JSON — which reads as a
 * broken scanner rather than a small buffer.
 *
 * @param options - the executable and any extra arguments
 * @returns a scanner
 */
export function createAriadaCliScanner(
  options: { binary?: string; args?: string[] } = {},
): AriadaScanner {
  const binary = options.binary ?? process.env['ARIADA_CLI'] ?? 'ariada';
  return (url: string) =>
    new Promise((resolve, reject) => {
      execFile(
        binary,
        ['scan', url, '--format', 'json', ...(options.args ?? [])],
        { maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Ariada CLI failed: ${stderr.trim() || error.message}`));
            return;
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            reject(new Error('Ariada CLI returned invalid JSON.'));
          }
        },
      );
    });
}

/**
 * Whether the value is an object.
 *
 * @param value - the candidate
 * @returns true when it is
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Whether the value is a severity this integration knows.
 *
 * @param value - the candidate
 * @returns true when it is
 */
function isSeverity(value: unknown): value is Severity {
  return value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor';
}

/**
 * The value if it is a finite number.
 *
 * @param value - the candidate
 * @returns the number, or undefined
 */
function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * The value if it has content, or an error naming the field.
 *
 * @param value - the candidate
 * @param name - the field
 * @returns the value
 */
function requireText(value: string, name: string): string {
  if (!value.trim()) throw new Error(`Plasmic page context requires ${name}.`);
  return value;
}
