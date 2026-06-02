// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import {
  type AnalyzerContext,
  type DomainAnalyzer,
  type Finding,
} from '@ariada-org/core-engine';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { scanCurrentDocument } from '../src/browser-runner.js';

function freshDoc(html: string): Document {
  const win = new Window({ url: 'http://test.local/' });
  win.document.write(html);
  return win.document as unknown as Document;
}

const noopAnalyzer = (domain: string): DomainAnalyzer => ({
  domain,
  version: 'test',
  ruleIds: [],
  async analyze(_ctx: AnalyzerContext): Promise<Finding[]> {
    return [];
  },
  async analyzeElement(): Promise<Finding[]> {
    return [];
  },
});

describe('scanCurrentDocument — defaults and aggregation', () => {
  it('runs with zero analyzers when none are supplied', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const result = await scanCurrentDocument({ scanId: 's', document: doc });
    expect(result.report.stats.analyzersRun).toEqual([]);
  });

  it('records every analyzer domain that ran', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const result = await scanCurrentDocument({
      scanId: 's',
      document: doc,
      analyzers: [noopAnalyzer('a11y'), noopAnalyzer('seo')],
    });
    expect(result.report.stats.analyzersRun.sort()).toEqual(['a11y', 'seo']);
  });

  it('derives the url from document.URL when no override is given', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const { report } = await scanCurrentDocument({
      scanId: 's',
      document: doc,
      analyzers: [noopAnalyzer('a11y')],
    });
    expect(report.url).toBe('http://test.local/');
  });

  it('completes without an emitter and still returns a report', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const { report } = await scanCurrentDocument({
      scanId: 's',
      document: doc,
      analyzers: [noopAnalyzer('a11y')],
    });
    expect(report.scanId).toBe('s');
  });
});

describe('scanCurrentDocument — generated scan ids', () => {
  it('produces a 26-char Crockford-base32 id when none is supplied', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const { report } = await scanCurrentDocument({ document: doc });
    expect(report.scanId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('generates a distinct id on each call', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const doc = freshDoc('<h1>Hi</h1>');
      const { report } = await scanCurrentDocument({ document: doc });
      ids.add(report.scanId);
    }
    expect(ids.size).toBe(5);
  });

  it('never uses Crockford-excluded characters (I, L, O, U) in the generated id', async () => {
    const doc = freshDoc('<h1>Hi</h1>');
    const { report } = await scanCurrentDocument({ document: doc });
    expect(report.scanId).not.toMatch(/[ILOU]/);
  });
});
