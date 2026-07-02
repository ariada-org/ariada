// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface HtmlFinding {
  filePath: string;
  ruleId: string;
  severity: Severity;
  message: string;
  selector: string;
}

export interface PageScan {
  filePath: string;
  findings: HtmlFinding[];
}

export interface BuildScanReport {
  generatedAt: string;
  pages: PageScan[];
  summary: Record<Severity, number> & { total: number };
}

export type HtmlScanner = (input: { filePath: string; html: string }) => Promise<PageScan> | PageScan;

export const severityRank: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

export const defaultHtmlScanner: HtmlScanner = ({ filePath, html }) => ({
  filePath,
  findings: findStaticHtmlIssues(filePath, html),
});

export function buildReport(pages: PageScan[], generatedAt = new Date().toISOString()): BuildScanReport {
  const summary = { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const page of pages) {
    for (const finding of page.findings) {
      summary.total += 1;
      summary[finding.severity] += 1;
    }
  }
  return { generatedAt, pages, summary };
}

export function hasFindingAtOrAbove(report: BuildScanReport, threshold: Severity): boolean {
  const minimum = severityRank[threshold];
  return report.pages.some((page) =>
    page.findings.some((finding) => severityRank[finding.severity] >= minimum),
  );
}

export function findStaticHtmlIssues(filePath: string, html: string): HtmlFinding[] {
  const findings: HtmlFinding[] = [];
  const imagePattern = /<img\b[^>]*>/gi;
  let imageMatch: RegExpExecArray | null;
  let imageIndex = 0;

  while ((imageMatch = imagePattern.exec(html)) !== null) {
    imageIndex += 1;
    if (!/\salt\s*=/i.test(imageMatch[0])) {
      findings.push({
        filePath,
        ruleId: 'image-alt',
        severity: 'serious',
        message: 'Image elements need an alt attribute.',
        selector: `img:nth-of-type(${imageIndex})`,
      });
    }
  }

  return findings;
}
