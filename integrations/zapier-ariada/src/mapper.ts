// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2

import type { AriadaFinding, AriadaReport, Severity, ZapierScanCompleted, ZapierViolation } from './contracts';

/** A string, from whatever arrived: an array joins, anything else falls back. */
const text = (value: unknown, fallback = ''): string =>
  Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : fallback;

/**
 * A stable identifier for a finding that arrived without one.
 *
 * This is the 32-bit FNV-1a hash, chosen because it needs no dependency and
 * produces the same eight characters on every run. It is not a security
 * primitive and nothing here treats it as one: two findings colliding would
 * merge two rows in somebody's spreadsheet, which is the whole of the cost.
 */
function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

/** A severity we know, or the one that says we do not. */
function severity(value: unknown): Severity {
  const normalized = text(value).toLowerCase();
  return (['critical', 'serious', 'moderate', 'minor'] as const).includes(normalized as never)
    ? (normalized as Severity)
    : 'unknown';
}

/** Findings under either of the two names a report may use. */
function findings(report: AriadaReport): AriadaFinding[] {
  return Array.isArray(report.findings)
    ? report.findings
    : Array.isArray(report.violations)
      ? report.violations
      : [];
}

/**
 * One finding, with every field settled.
 *
 * The fallback chains are the point of this function. A field the report left
 * out is filled from the next-best thing it did carry — the page for the url,
 * the message for the title — so a row never arrives empty where something was
 * known. The identifier falls back last, to a hash of what makes the finding
 * what it is, because a row without one cannot be deduplicated downstream.
 */
export function mapViolation(finding: AriadaFinding, report: AriadaReport, index = 0): ZapierViolation {
  const url = text(finding.url, text(finding.page, text(report.url)));
  const ruleId = text(finding.ruleId, text(finding.rule, 'unknown-rule'));
  const selector = text(finding.selector, '');
  const fingerprint = text(
    finding.fingerprint,
    hash([ruleId, url, selector, text(finding.message, text(finding.title))].join('|')),
  );
  const scanId = text(report.scanId, text(report.id, 'ariada-scan'));
  return {
    id: text(finding.id, `${scanId}-${fingerprint}-${index}`),
    fingerprint,
    scanId,
    ruleId,
    title: text(finding.title, text(finding.message, ruleId)),
    description: text(finding.description, text(finding.message, text(finding.help))),
    severity: severity(finding.severity),
    url,
    selector,
    wcag: text(finding.wcag, text(finding.wcagSc)),
    remediation: text(finding.remediation, text(finding.help)),
    reportUrl: text(report.reportUrl, url),
  };
}

/** Every finding in the report, in the order it arrived. */
export function mapViolations(report: AriadaReport): ZapierViolation[] {
  return findings(report).map((finding, index) => mapViolation(finding, report, index));
}

/**
 * The single event that says a scan finished.
 *
 * Whether it passed is read from the report if it says so and from the gate if
 * it does not — the two spellings again. The completion time falls back to the
 * epoch rather than to now: a made-up recent timestamp would sort as fresh, and
 * a wrong answer that looks plausible is worse than one that does not.
 */
export function mapScanCompleted(report: AriadaReport): ZapierScanCompleted {
  const violations = mapViolations(report);
  const scanId = text(report.scanId, text(report.id, 'ariada-scan'));
  const passed = typeof report.passed === 'boolean' ? report.passed : report.gate?.passed === true;
  return {
    id: `scan-${scanId}`,
    scanId,
    url: text(report.url),
    reportUrl: text(report.reportUrl, text(report.url)),
    passed,
    findingCount: violations.length,
    criticalCount: violations.filter((finding) => finding.severity === 'critical').length,
    completedAt: text(report.completedAt, '1970-01-01T00:00:00.000Z'),
  };
}

/** The one thing that is refused rather than filled in: something that is not a record. */
export function parseReport(input: unknown): AriadaReport {
  if (!input || typeof input !== 'object') throw new Error('Ariada report must be a JSON object');
  return input as AriadaReport;
}
