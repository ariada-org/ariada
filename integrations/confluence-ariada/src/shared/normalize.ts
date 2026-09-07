// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/shared/normalize.js` and `dist/shared/normalize.d.ts`.
// The source this was built from was never committed; the compiled output is
// `tsc` with the types stripped, so the shapes come back from the declaration
// file and the bodies are the compiled ones. Checked with
// `bash scripts/sverit-vosstanovlennoe.sh`.
//
// WHAT THIS IS FOR. The scanner's report has moved shape more than once — a
// finding's rule may be under `ruleId` or `id`, its text under `message` or
// `description`, its severity under `severity` or `impact`, and the findings
// themselves may be a flat list or grouped by domain. Reading only the current
// name would mean quietly returning nothing for half the reports this is given,
// which is the worst outcome available: an empty findings list reads as a clean
// page.
//
// BUT THE ENVELOPE IS CHECKED STRICTLY, AND THE DIFFERENCE IS THE POINT.
// Tolerance about where a field lives is not tolerance about whether the report
// is trustworthy: an unknown schema, a missing scan identifier, an unparseable
// timestamp, or a summary total that disagrees with the findings actually
// present all throw. Lenient where the shape drifted, strict where the meaning
// would be in doubt.
//
// A severity nobody recognises becomes moderate rather than being dropped. The
// finding is real either way, and dropping it would lose it; calling it critical
// would cry wolf.

import { SEVERITIES } from './types.js';
import type { Finding, PageDescriptor, ScanResult, Severity } from './types.js';

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function severity(value: unknown): Severity {
  const normalized = text(value).toLowerCase();
  if (SEVERITIES.includes(normalized as Severity)) return normalized as Severity;
  return 'moderate';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function normalizeFinding(value: unknown): Finding {
  const source = object(value, 'finding');
  const target = source['target'] ?? source['selector'];
  const selector = Array.isArray(target) ? text(target[0]) : text(target);
  const tags = stringList(source['wcag'] ?? source['tags']);
  const helpUrl = text(source['helpUrl'] ?? source['help']);
  return {
    ruleId: text(source['ruleId'] ?? source['id'], 'unknown-rule'),
    severity: severity(source['severity'] ?? source['impact']),
    message: text(source['message'] ?? source['description'], 'Accessibility violation reported by Ariada.'),
    ...(selector ? { selector } : {}),
    ...(helpUrl.startsWith('https://') ? { helpUrl } : {}),
    wcag: tags.filter((tag) => /^wcag\d/i.test(tag)),
  };
}

function flattenFindings(value: unknown): Finding[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.map(normalizeFinding);
  const groups = object(value, 'report.findings');
  return Object.values(groups).flatMap((entries) => {
    if (!Array.isArray(entries)) throw new Error('Each report.findings group must be an array');
    return entries.map(normalizeFinding);
  });
}

export function normalizeCliReport(
  input: unknown,
  page: PageDescriptor,
  scannerExitCode: number,
  threshold: Severity = 'moderate',
): ScanResult {
  const source = typeof input === 'string' ? JSON.parse(input) : input;
  const envelope = object(source, 'scan');
  if (envelope['$schema'] !== 'https://ariada.org/schemas/cli-scan.v1.json') {
    throw new Error('Unsupported Ariada report schema');
  }
  if (scannerExitCode !== 0 && scannerExitCode !== 1) {
    throw new Error(`Ariada scanner failed with exit code ${scannerExitCode}`);
  }
  const report = object(envelope['report'], 'report');
  const findings = flattenFindings(report['findings']);
  const counts: Record<Severity, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  const scanId = text(envelope['scanId']);
  if (!scanId) throw new Error('Ariada report is missing scanId');
  const completedAt = text(envelope['completedAt']);
  if (!completedAt || Number.isNaN(Date.parse(completedAt))) {
    throw new Error('Ariada report is missing a valid completedAt timestamp');
  }
  const summary = object(envelope['summary'], 'summary');
  if (summary['total'] !== findings.length) {
    throw new Error('Ariada summary.total does not match the findings count');
  }
  return {
    schema: 'ariada-confluence.scan.v1',
    scanId,
    scannedAt: new Date(completedAt).toISOString(),
    page,
    gate: {
      passed: scannerExitCode === 0,
      threshold,
      total: findings.length,
      byImpact: counts,
    },
    findings,
    reportUrl: null,
  };
}
