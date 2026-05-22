// SPDX-License-Identifier: EUPL-1.2
// SPDX-FileCopyrightText: 2026 Agonist Development AB
/**
 * Synthetic fixtures for unit + snapshot + self-audit tests.
 *
 * Five findings spanning all four severities — used by the «5 findings»
 * unit test + golden-file snapshot test.
 */

import type { ScanFinding, ScanMeta, ScanReportInput } from '../../src/types.js';

export const FIXTURE_META: ScanMeta = {
  url: 'https://example.org/checkout',
  timestamp: '2026-05-19T16:05:52.101Z',
  scannerVersion: '0.1.0',
  axeVersion: '4.10.2',
  wcagVersion: '2.2',
  en301549Version: '3.2.1',
  userAgent: 'Chromium/124.0.6367.91',
  viewport: '1280x720',
  durationMs: 1842,
};

export const FIXTURE_FINDINGS: ScanFinding[] = [
  {
    id: 'color-contrast',
    impact: 'serious',
    description:
      'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
    wcag: ['1.4.3'],
    nodes: [
      {
        selector: 'header > nav > a:nth-child(2)',
        html: '<a href="/about" class="nav__link">About us</a>',
        bbox: { x: 240, y: 18, w: 80, h: 32 },
      },
    ],
  },
  {
    id: 'image-alt',
    impact: 'critical',
    description: 'Ensures <img> elements have alternate text or a role of none or presentation',
    help: 'Images must have alternate text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
    wcag: ['1.1.1'],
    nodes: [
      {
        selector: 'main > section.hero > img',
        html: '<img src="/hero.jpg" width="1200" height="400">',
        bbox: { x: 0, y: 80, w: 1200, h: 400 },
      },
      {
        selector: 'footer > img.logo',
        html: '<img src="/logo.svg" width="64" height="64">',
      },
    ],
  },
  {
    id: 'label',
    impact: 'critical',
    description: 'Ensures every form element has a label',
    help: 'Form elements must have labels',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/label',
    wcag: ['1.3.1', '4.1.2'],
    nodes: [
      {
        selector: 'form#checkout > input[name="zip"]',
        html: '<input type="text" name="zip" placeholder="Postal code">',
      },
    ],
  },
  {
    id: 'region',
    impact: 'moderate',
    description: 'Ensures all page content is contained by landmarks',
    help: 'All page content should be contained by landmarks',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/region',
    wcag: ['1.3.1'],
    nodes: [
      {
        selector: 'div.banner',
        html: '<div class="banner">Free shipping over 500 kr</div>',
      },
    ],
  },
  {
    id: 'landmark-unique',
    impact: 'minor',
    description: 'Ensures landmarks are unique',
    help: 'Landmarks should have a unique role or role/label/title combination',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/landmark-unique',
    wcag: ['1.3.1'],
    nodes: [
      {
        selector: 'aside.sidebar:nth-of-type(2)',
        html: '<aside class="sidebar">Newsletter signup</aside>',
      },
    ],
  },
];

export const FIXTURE_INPUT: ScanReportInput = {
  meta: FIXTURE_META,
  findings: FIXTURE_FINDINGS,
};

export const EMPTY_INPUT: ScanReportInput = {
  meta: FIXTURE_META,
  findings: [],
};
