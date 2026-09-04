// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/mapper.js` and `dist/mapper.d.ts`. The source this was
// built from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

import { createHash } from 'node:crypto';

import type {
  AriadaFinding,
  AriadaReport,
  AriadaSeverity,
  MakeScanCompletedBundle,
  MakeViolationBundle,
} from './types.js';

const severities: AriadaSeverity[] = ['minor', 'moderate', 'serious', 'critical'];

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const list = (value: unknown): string =>
  Array.isArray(value) ? value.map(String).join(', ') : text(value, 'Not specified');

/**
 * The findings, from whichever of the four places a report keeps them.
 *
 * Reports arrive from more than one version of the scanner, and the shape moved
 * at least twice. Reading one name and returning nothing for the others would
 * be a mapper that quietly emits no events for half the reports it is given.
 *
 * @param report - the report
 * @returns the findings, or none
 */
export function findingsFromReport(report: AriadaReport): AriadaFinding[] {
  if (Array.isArray(report.findings)) return report.findings;
  if (Array.isArray(report.violations)) return report.violations;
  const nested = report.report?.findings;
  if (Array.isArray(nested)) return nested;
  if (nested && typeof nested === 'object') return Object.values(nested).flat();
  return [];
}

/**
 * A stable identity for a finding, so the same problem twice is one thing.
 *
 * The report's own fingerprint wins when it has one. Otherwise it is derived
 * from rule, page and selector — the three that identify a problem rather than
 * describe it, so rewording a message does not create a second violation.
 *
 * @param finding - the finding
 * @param reportUrl - a fallback page, when the finding names none
 * @returns a hex fingerprint
 */
export function findingFingerprint(finding: AriadaFinding, reportUrl = ''): string {
  if (typeof finding.fingerprint === 'string' && finding.fingerprint.trim())
    return finding.fingerprint.trim();
  const stable = [
    finding.ruleId ?? finding.rule ?? finding.id ?? 'ariada/unknown',
    finding.page ?? finding.url ?? reportUrl,
    finding.selector ?? finding.target ?? 'document',
  ].join('|');
  return createHash('sha256').update(stable).digest('hex').slice(0, 32);
}

/**
 * One finding as the platform's violation event.
 *
 * @param finding - the finding
 * @param report - the report it came from
 * @returns the event
 */
export function toViolationBundle(
  finding: AriadaFinding,
  report: AriadaReport,
): MakeViolationBundle {
  const reportUrl = text(report.reportUrl, '');
  const fingerprint = findingFingerprint(finding, reportUrl);
  const severity = severities.includes(finding.severity as AriadaSeverity)
    ? (finding.severity as AriadaSeverity)
    : 'moderate';
  return {
    eventType: 'violation',
    violationId: fingerprint,
    fingerprint,
    scanId: text(report.scanId, 'unknown-scan'),
    ...(reportUrl ? { reportUrl } : {}),
    ...(typeof report.url === 'string' ? { url: report.url } : {}),
    page: text(finding.page ?? finding.url ?? report.url, 'Unknown page'),
    ruleId: text(finding.ruleId ?? finding.rule ?? finding.id, 'ariada/unknown'),
    severity,
    message: text(
      finding.message ?? finding.description,
      'Accessibility issue reported by Ariada.',
    ),
    selector: text(finding.selector ?? finding.target, 'document'),
    wcag: list(finding.wcag),
    en301549: list(finding.en301549),
    remediation: text(
      finding.remediation ?? finding.help,
      'See the rule guidance in the Ariada report.',
    ),
  };
}

/**
 * Every finding in a report as violation events.
 *
 * @param report - the report
 * @returns the events
 */
export function toViolationBundles(report: AriadaReport): MakeViolationBundle[] {
  return findingsFromReport(report).map((finding) => toViolationBundle(finding, report));
}

/**
 * The end-of-scan event.
 *
 * Whether it passed is read from the report when it says, and inferred only
 * when it does not: a scan that exited zero and found nothing.
 *
 * @param report - the report
 * @returns the event
 */
export function toScanCompletedBundle(report: AriadaReport): MakeScanCompletedBundle {
  const bundles = toViolationBundles(report);
  const counts = Object.fromEntries(
    severities.map((severity) => [
      severity,
      bundles.filter((bundle) => bundle.severity === severity).length,
    ]),
  ) as Record<AriadaSeverity, number>;
  const status = text(
    report.status,
    report.exitCode === 0 ? 'pass' : bundles.length ? 'fail' : 'complete',
  );
  return {
    eventType: 'scan_completed',
    scanId: text(report.scanId, 'unknown-scan'),
    ...(report.reportUrl ? { reportUrl: report.reportUrl as string } : {}),
    ...(report.url ? { url: report.url as string } : {}),
    status,
    passed:
      status === 'pass' ||
      status === 'passed' ||
      (report.exitCode === 0 && bundles.length === 0),
    totalFindings: bundles.length,
    criticalCount: counts.critical,
    seriousCount: counts.serious,
    moderateCount: counts.moderate,
    minorCount: counts.minor,
  };
}
