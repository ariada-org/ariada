// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
  createEventEmitter,
  scanEventSchema,
  type AnalyzerContext,
  type DomainAnalyzer,
  type ElementTarget,
  type Finding,
  type ScanEvent,
} from '@ariada/core-engine';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { scanCurrentDocument } from '../src/browser-runner.js';

function freshDoc(html: string): Document {
  const win = new Window({ url: 'http://test.local/' });
  win.document.write(html);
  return win.document as unknown as Document;
}

const passingAnalyzer: DomainAnalyzer = {
  domain: 'a11y',
  version: 'test',
  ruleIds: [],
  async analyze(_ctx: AnalyzerContext): Promise<Finding[]> {
    return [];
  },
  async analyzeElement(): Promise<Finding[]> {
    return [];
  },
};

const violatingAnalyzer: DomainAnalyzer = {
  domain: 'a11y',
  version: 'test',
  ruleIds: [],
  async analyze(): Promise<Finding[]> {
    return [
      {
        id: 'f-1',
        scanId: 'will-be-overwritten',
        domain: 'a11y',
        ruleId: 'image-alt',
        severity: 'critical',
        element: { selector: 'img:nth-of-type(1)' },
        message: 'missing alt',
        criterion: 'WCAG 2.2 1.1.1',
      },
    ];
  },
  async analyzeElement(_ctx: AnalyzerContext, t: ElementTarget): Promise<Finding[]> {
    if (t.selector.startsWith('img')) {
      return [
        {
          id: `el-${t.selector}`,
          scanId: 'will-be-overwritten',
          domain: 'a11y',
          ruleId: 'image-alt',
          severity: 'critical',
          element: { selector: t.selector },
          message: 'missing alt',
          criterion: 'WCAG 2.2 1.1.1',
        },
      ];
    }
    return [];
  },
};

describe('scanCurrentDocument', () => {
  it('returns a UnifiedReport for a passing document with no analyzers', async () => {
    const doc = freshDoc('<h1>Hi</h1><p>Body</p>');
    const result = await scanCurrentDocument({
      scanId: 'scan-test-1',
      document: doc,
      analyzers: [passingAnalyzer],
    });

    expect(result.report.scanId).toBe('scan-test-1');
    expect(result.report.url).toBe('http://test.local/');
    expect(result.report.stats.analyzersRun).toEqual(['a11y']);
    expect(result.report.findings['a11y']).toEqual([]);
  });

  it('emits the locked ScanEvent stream when elementIter is true', async () => {
    const doc = freshDoc('<img src="x.png">');
    const emitter = createEventEmitter();
    const received: ScanEvent[] = [];
    emitter.on((e) => received.push(e));

    const { events } = await scanCurrentDocument({
      scanId: 'scan-test-2',
      document: doc,
      analyzers: [violatingAnalyzer],
      elementIter: true,
      emitter,
    });

    expect(events).toBeDefined();
    expect(events!.length).toBe(received.length);

    const first = received[0];
    expect(first?.kind).toBe('scan_started');

    const last = received[received.length - 1];
    expect(last?.kind).toBe('scan_complete');

    for (const ev of received) {
      const parsed = scanEventSchema.safeParse(ev);
      expect(parsed.success).toBe(true);
    }

    const violatedEvents = received.filter(
      (e): e is Extract<ScanEvent, { kind: 'element_scan' }> =>
        e.kind === 'element_scan' && e.status === 'violated',
    );
    expect(violatedEvents.length).toBeGreaterThan(0);
    expect(violatedEvents[0]?.violations?.[0]?.rule_id).toBe('image-alt');
  });

  it('generates a 26-char Crockford-base32 scanId when none is supplied', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const { report } = await scanCurrentDocument({
      document: doc,
      analyzers: [passingAnalyzer],
    });
    expect(report.scanId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('honours the url override', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const { report } = await scanCurrentDocument({
      scanId: 'scan-test-3',
      document: doc,
      url: 'https://override.example/',
      analyzers: [passingAnalyzer],
    });
    expect(report.url).toBe('https://override.example/');
  });
});
