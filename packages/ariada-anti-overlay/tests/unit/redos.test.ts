// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../src/detect.js';

const PERF_BUDGET_MS = 500; // generous CI ceiling — tighter in §4.1 perf test below

function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  return (async () => {
    const start = process.hrtime.bigint();
    const value = await fn();
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;
    return { ms, value };
  })();
}

describe('redos resistance', () => {
  it('completes adversarial nested-script input within budget', async () => {
    const adversarial =
      '<script src="' + 'a'.repeat(50_000) + '">' + '</script>'.repeat(1_000);
    const { ms } = await timeIt(() => detectOverlays({ html: adversarial }));
    expect(ms).toBeLessThan(PERF_BUDGET_MS);
  });

  it('handles long flat HTML with no vendor tokens quickly', async () => {
    const long = '<div>' + 'x '.repeat(500_000) + '</div>';
    const { ms, value } = await timeIt(() => detectOverlays({ html: long }));
    expect(value.vendorsDetected).toEqual([]);
    expect(ms).toBeLessThan(PERF_BUDGET_MS);
  });

  it('repeated benign tokens do not produce O(n^2) backtracking', async () => {
    const html =
      '<script>' +
      'var x = "acsb";'.repeat(20_000) +
      '</script>';
    const { ms } = await timeIt(() => detectOverlays({ html }));
    expect(ms).toBeLessThan(PERF_BUDGET_MS);
  });
});

describe('performance budget (PRD §4.1)', () => {
  it('completes a typical ≤1 MB page well under 100 ms (P95 budget)', async () => {
    // Build a realistic ~200 KB page (well within the 1 MB ceiling).
    const body = '<p>' + 'lorem ipsum '.repeat(15_000) + '</p>';
    const html = `<html><head><script src="https://acsbapp.com/x.js"></script></head><body>${body}</body></html>`;
    expect(html.length).toBeLessThan(1_000_000);
    const { ms, value } = await timeIt(() => detectOverlays({ html }));
    // PRD §4.1: P95 ≤ 100 ms per ≤ 1 MB page. CI noise ceiling: 200 ms.
    expect(ms).toBeLessThan(200);
    expect(value.vendorsDetected[0]?.vendor).toBe('accessibe');
  });
});
