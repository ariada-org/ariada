// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

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

function stripTags(value: string): string {
  return value.replaceAll(/<[^>]+>/g, '');
}
