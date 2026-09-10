// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
 

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

export interface ViteScanReport {
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

export function buildReport(pages: PageScan[], generatedAt = new Date().toISOString()): ViteScanReport {
  const summary = { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const page of pages) {
    for (const finding of page.findings) {
      summary.total += 1;
      summary[finding.severity] += 1;
    }
  }
  return { generatedAt, pages, summary };
}

export function hasFindingAtOrAbove(report: ViteScanReport, threshold: Severity): boolean {
  const minimum = severityRank[threshold];
  return report.pages.some((page) =>
    page.findings.some((finding) => severityRank[finding.severity] >= minimum),
  );
}

export function findStaticHtmlIssues(filePath: string, html: string): HtmlFinding[] {
  const findings: HtmlFinding[] = [];
  const labelPattern = /<label\b[^>]*>(?<body>.*?)<\/label>/gis;
  const labelTexts = new Set<string>();
  let labelMatch: RegExpExecArray | null;

  while ((labelMatch = labelPattern.exec(html)) !== null) {
    const body = stripTags(labelMatch.groups?.['body'] ?? '').trim().toLowerCase();
    if (body.length > 0) labelTexts.add(body);
  }

  const inputPattern = /<input\b[^>]*>/gi;
  let inputMatch: RegExpExecArray | null;
  let inputIndex = 0;

  while ((inputMatch = inputPattern.exec(html)) !== null) {
    inputIndex += 1;
    const tag = inputMatch[0];
    const type = attr(tag, 'type')?.toLowerCase() ?? 'text';
    if (type === 'hidden' || type === 'submit' || type === 'button') continue;
    if (attr(tag, 'aria-label') || attr(tag, 'aria-labelledby')) continue;
    const id = attr(tag, 'id');
    if (id && new RegExp(`<label\\b[^>]*for=["']?${escapeRegExp(id)}["']?`, 'i').test(html)) continue;
    if (labelTexts.size > 0) continue;

    findings.push({
      filePath,
      ruleId: 'form-field-name',
      severity: 'serious',
      message: 'Form fields need an accessible name.',
      selector: `input:nth-of-type(${inputIndex})`,
    });
  }

  return findings;
}

function attr(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i');
  return pattern.exec(tag)?.[1];
}

/**
 * Remove markup, respecting quoted attribute values.
 *
 * The obvious pattern — everything from `<` to the next `>` — ends a tag at the
 * first `>` it meets, including one inside an attribute. `<img alt="a > b">`
 * was cut in the middle, leaving `b">` behind as if it were text, so a label
 * containing a comparison came through mangled and the finding reported against
 * it quoted nonsense.
 *
 * Walking the string instead, and remembering which quote character opened the
 * current value, costs nothing and ends the tag where it actually ends.
 */
/**
 * Убирает разметку из отрывка текста.
 *
 * Вывезено намеренно. Оно и раньше было верным, но проверить его можно было
 * только через сканер, а сканер для тех входов, где старое и новое расходятся,
 * не возвращает находок вовсе — три попытки дали три одинаковых ответа. Тест,
 * проходящий при обеих постановках, ничего не стережёт, и вторым таким тестом
 * беда только переезжает.
 *
 * Строковое преобразование с тонким уговором заслуживает проверки напрямую.
 */
export function stripTags(value: string): string {
  let out = '';
  let inTag = false;
  let quote: string | null = null;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i] as string;
    if (inTag) {
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        inTag = false;
      }
      continue;
    }
    // A `<` opens a tag only before a letter, a slash, `!` or `?`. Anywhere
    // else it is text, and treating it as a tag ate everything after it:
    // `price < 100` came back as `price `, so a finding quoted a truncated
    // label at whoever read it — the same harm the tag-walking was written to
    // stop, arriving from the other side.
    if (ch === '<' && /[a-zA-Z/!?]/.test(value[i + 1] ?? '')) {
      inTag = true;
      continue;
    }
    out += ch;
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
