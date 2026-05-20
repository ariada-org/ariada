// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { afterEach, describe, expect, it } from 'vitest';

import { projectScanResult, runScan, setScanner, type ScannerImpl } from '../../src/internal/run-scan.js';
import type { ScanResult, ScanTarget, Violation } from '../../src/internal/types.js';
import { validateOptions } from '../../src/internal/validate-options.js';

const sampleViolation: Violation = {
  ruleId: 'color-contrast',
  impact: 'serious',
  selector: '.x',
  message: 'low contrast',
  wcag: ['1.4.3'],
};

const makeResult = (violations: Violation[]): ScanResult => ({
  violations,
  passes: 0,
  timestamp: new Date(0).toISOString(),
  durationMs: 10,
  target: { kind: 'url', identifier: 'https://example.test' },
});

const sampleTarget: ScanTarget = { kind: 'url', url: 'https://example.test' };

describe('runScan', () => {
  afterEach(() => setScanner(null));

  it('delegates to the injected scanner', async () => {
    const fake: ScannerImpl = {
      scan: async () => makeResult([sampleViolation]),
    };
    setScanner(fake);
    const out = await runScan(sampleTarget, validateOptions());
    expect(out.violations).toHaveLength(1);
  });

  it('throws ERR_A11Y_TIMEOUT when scanner exceeds the timeout', async () => {
    const slow: ScannerImpl = {
      scan: () => new Promise(() => undefined),
    };
    setScanner(slow);
    const opts = validateOptions({ timeoutMs: 50 });
    await expect(runScan(sampleTarget, opts)).rejects.toMatchObject({
      code: 'ERR_A11Y_TIMEOUT',
    });
  });

  it('propagates scanner errors verbatim', async () => {
    const failing: ScannerImpl = {
      scan: async () => {
        throw new Error('cdp disconnect');
      },
    };
    setScanner(failing);
    await expect(runScan(sampleTarget, validateOptions())).rejects.toThrow('cdp disconnect');
  });
});

describe('projectScanResult', () => {
  it('projects a core-playwright finding into a Violation', () => {
    const raw = {
      report: {
        findings: {
          a11y: [
            {
              ruleId: 'color-contrast',
              severity: 'serious',
              element: { selector: '.price' },
              message: 'low contrast',
              wcagMapping: ['1.4.3'],
            },
          ],
        },
      },
    };
    const out = projectScanResult(raw, sampleTarget, Date.now());
    expect(out.violations).toHaveLength(1);
    expect(out.violations[0]?.ruleId).toBe('color-contrast');
    expect(out.violations[0]?.selector).toBe('.price');
    expect(out.violations[0]?.wcag).toEqual(['1.4.3']);
  });

  it('falls back to safe defaults on partial findings', () => {
    const raw = {
      report: {
        findings: {
          a11y: [{}],
        },
      },
    };
    const out = projectScanResult(raw, sampleTarget, Date.now());
    expect(out.violations[0]?.ruleId).toBe('unknown-rule');
    expect(out.violations[0]?.impact).toBe('moderate');
  });

  it('returns empty violations on empty findings map', () => {
    const out = projectScanResult({ report: {} }, sampleTarget, Date.now());
    expect(out.violations).toEqual([]);
  });

  it('sets target identifier from URL targets', () => {
    const out = projectScanResult({ report: {} }, sampleTarget, Date.now());
    expect(out.target.identifier).toBe('https://example.test');
  });

  it('sets target identifier from page targets via page.url()', () => {
    const pageTarget: ScanTarget = {
      kind: 'page',
      page: {
        goto: async () => undefined,
        url: () => 'https://stub.example',
      },
    };
    const out = projectScanResult({ report: {} }, pageTarget, Date.now());
    expect(out.target.identifier).toBe('https://stub.example');
  });

  it('uses inline-html identifier for html targets', () => {
    const htmlTarget: ScanTarget = { kind: 'html', html: '<p>hi</p>' };
    const out = projectScanResult({ report: {} }, htmlTarget, Date.now());
    expect(out.target.identifier).toBe('inline-html');
  });

  it('records timestamp as ISO-8601 string', () => {
    const out = projectScanResult({ report: {} }, sampleTarget, Date.now());
    expect(() => new Date(out.timestamp).toISOString()).not.toThrow();
  });

  it('records a non-negative duration', () => {
    const out = projectScanResult({ report: {} }, sampleTarget, Date.now());
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('ignores severities outside the four-rung enum', () => {
    const raw = {
      report: {
        findings: {
          a11y: [{ ruleId: 'r', severity: 'fatal', element: { selector: '.x' }, message: 'm' }],
        },
      },
    };
    const out = projectScanResult(raw, sampleTarget, Date.now());
    expect(out.violations[0]?.impact).toBe('moderate');
  });
});
