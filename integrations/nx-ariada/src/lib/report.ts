// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/lib/report.js` and `dist/lib/report.d.ts`. The source
// this was built from was never committed; the compiled output is `tsc` with
// the types stripped, so the shapes come back from the declaration file and the
// bodies are the compiled ones.
//
// This file is released from that comparison, and is no longer held by the
// comparison with that module. That guarantee is strong and brittle: it fixes
// the source in the shape a compiler left it, and this reader came out of the
// compiler flat enough to fail the complexity limit standing on publication —
// so while it was the only support, the package could not travel at all.
//
// The release was made in the one moment it can honestly be made. The sixteen
// behavioural checks in `tests/scripts/recovered-nx-report.test.ts` were written
// while the comparison still held, so they describe the module that ships; only
// then was the shape changed. They are the guarantee now, the release is
// recorded in `tests/scripts/vypushchennye-iz-slicheniya.txt`, and running
// `bash scripts/sverit-vosstanovlennoe.sh` on this package will report a
// divergence, which is expected rather than a defect.
//
// ONE CHECK HERE IS NOT A FORMALITY AND IS WORTH SEEING. An exit code of 1
// means "findings were found", so a report that carries none while the exit
// code says otherwise is two statements that cannot both be true. Rather than
// picking one, this refuses: a task that reports success on a scan that
// disagreed with itself is the failure a gate exists to prevent.

import { readFile } from 'node:fs/promises';

import type { A11yExecutorResult } from '../executors/a11y/schema.js';

export interface ParsedAriadaReport {
  findingCount: number;
  ruleIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAriadaReport(value: unknown): ParsedAriadaReport {
  if (!isRecord(value) || !Array.isArray(value['sites']) || !Array.isArray(value['domains'])) {
    throw new Error('Ariada report is missing sites or domains');
  }
  if (!isRecord(value['grid'])) throw new Error('Ariada report is missing its findings grid');
  const report = value as unknown as {
    sites: string[];
    domains: string[];
    grid: Record<string, Record<string, { ruleId?: unknown }[] | undefined>>;
  };
  const ruleIds = new Set<string>();
  let findingCount = 0;
  for (const site of report.sites) {
    const siteGrid = report.grid[site];
    if (!isRecord(siteGrid)) throw new Error(`Ariada report has no grid entry for ${site}`);
    for (const domain of report.domains) {
      const findings = findingsFor(siteGrid, site, domain);
      findingCount += findings.length;
      for (const ruleId of ruleIdsOf(findings)) ruleIds.add(ruleId);
    }
  }
  return { findingCount, ruleIds: [...ruleIds].sort() };
}

/**
 * One cell of the grid, checked.
 *
 * An absent cell is a domain that did not run for that page, which is ordinary.
 * A cell that is present and is not a list is a malformed report, and saying so
 * is better than counting zero findings from it.
 */
function findingsFor(
  siteGrid: Record<string, { ruleId?: unknown }[] | undefined>,
  site: string,
  domain: string,
): { ruleId?: unknown }[] {
  const findings = siteGrid[domain];
  if (findings === undefined) return [];
  if (!Array.isArray(findings)) {
    throw new Error(`Ariada report grid entry ${site}/${domain} is not an array`);
  }
  return findings;
}

/** The rule identifiers a cell names, skipping findings that carry none. */
function ruleIdsOf(findings: { ruleId?: unknown }[]): string[] {
  const ids: string[] = [];
  for (const finding of findings) {
    if (typeof finding.ruleId === 'string' && finding.ruleId.length > 0) ids.push(finding.ruleId);
  }
  return ids;
}

export async function readAriadaReport(reportPath: string): Promise<ParsedAriadaReport> {
  return parseAriadaReport(JSON.parse(await readFile(reportPath, 'utf8')));
}

export function createExecutorResult(
  exitCode: number,
  reportPath: string,
  report: ParsedAriadaReport,
): A11yExecutorResult {
  if (exitCode === 1 && report.findingCount === 0) {
    throw new Error('Ariada returned findings exit code 1 but its report contains no findings');
  }
  return {
    success: exitCode === 0,
    exitCode,
    findingCount: report.findingCount,
    reportPath,
    ruleIds: report.ruleIds,
  };
}
