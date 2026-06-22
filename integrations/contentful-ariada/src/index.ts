// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface ContentfulEntryLike {
  fields?: Record<string, unknown>;
}

export interface PreviewUrlOptions {
  fallbackUrl?: string;
  previewUrlField?: string;
}

export interface ScanRequest {
  domains: string[];
  severityThreshold: Severity;
  source: string;
  url: string;
}

export interface FindingRow {
  message: string;
  ruleId: string;
  severity: Severity;
}

export function resolveContentfulPreviewUrl(entry: ContentfulEntryLike, options: PreviewUrlOptions = {}): string {
  const fieldName = options.previewUrlField ?? 'previewUrl';
  const value = entry.fields?.[fieldName] ?? options.fallbackUrl;
  if (typeof value !== 'string' || !value.startsWith('http')) {
    throw new Error(`Contentful entry is missing a rendered preview URL in "${fieldName}"`);
  }
  return value;
}

export function createContentfulScanRequest(url: string, severityThreshold: Severity = 'serious'): ScanRequest {
  return { domains: ['accessibility'], severityThreshold, source: 'contentful.entry-preview', url };
}

export function normalizeFindings(report: unknown): FindingRow[] {
  if (!report || typeof report !== 'object' || !('findings' in report)) return [];
  const findings = (report as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) return [];
  return findings.flatMap((finding): FindingRow[] => {
    if (!finding || typeof finding !== 'object') return [];
    const row = finding as Record<string, unknown>;
    return [{
      message: String(row['message'] ?? 'Accessibility finding'),
      ruleId: String(row['ruleId'] ?? row['id'] ?? 'ariada/unknown'),
      severity: asSeverity(row['severity']),
    }];
  });
}

function asSeverity(value: unknown): Severity {
  return value === 'minor' || value === 'moderate' || value === 'critical' ? value : 'serious';
}
