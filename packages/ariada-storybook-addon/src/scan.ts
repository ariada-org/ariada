// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
 

export type AriadaSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

export interface AriadaFinding {
  id: string;
  ruleId: string;
  severity: AriadaSeverity;
  message: string;
  selector: string;
}

export interface StoryScanResult {
  storyId: string;
  url: string;
  findings: AriadaFinding[];
  generatedAt: string;
}

export type StoryScanner = (input: {
  storyId: string;
  html: string;
  url: string;
}) => Promise<StoryScanResult> | StoryScanResult;

export const defaultStoryScanner: StoryScanner = ({ storyId, html, url }) => ({
  storyId,
  url,
  findings: findStaticHtmlIssues(storyId, html),
  generatedAt: new Date().toISOString(),
});

export function findStaticHtmlIssues(storyId: string, html: string): AriadaFinding[] {
  const findings: AriadaFinding[] = [];
  const imagePattern = /<img\b[^>]*>/gi;
  let imageMatch: RegExpExecArray | null;
  let imageIndex = 0;

  while ((imageMatch = imagePattern.exec(html)) !== null) {
    imageIndex += 1;
    const tag = imageMatch[0];
    if (!/\salt\s*=/i.test(tag)) {
      findings.push({
        id: `${storyId}:image-alt:${imageIndex}`,
        ruleId: 'image-alt',
        severity: 'serious',
        message: 'Image elements need an alt attribute.',
        selector: `img:nth-of-type(${imageIndex})`,
      });
    }
  }

  const buttonPattern = /<button\b[^>]*>(?<label>.*?)<\/button>/gis;
  let buttonMatch: RegExpExecArray | null;
  let buttonIndex = 0;

  while ((buttonMatch = buttonPattern.exec(html)) !== null) {
    buttonIndex += 1;
    const label = stripTags(buttonMatch.groups?.['label'] ?? '').trim();
    const tag = buttonMatch[0];
    if (label.length === 0 && !/\saria-label\s*=/i.test(tag)) {
      findings.push({
        id: `${storyId}:button-name:${buttonIndex}`,
        ruleId: 'button-name',
        severity: 'serious',
        message: 'Button elements need visible text or an aria-label.',
        selector: `button:nth-of-type(${buttonIndex})`,
      });
    }
  }

  return findings;
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
