// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import {
  colorContrastAnalyzer,
  contrastRatio,
  createColorContrastAnalyzer,
  parseColor,
  relativeLuminance,
} from '../src/analyzers/color-contrast.js';
import { createNullLogger } from '../src/logger.js';
import type { AnalyzerContext, AXNode, UnifiedSnapshot } from '../src/types.js';

function makeNode(
  nodeId: string,
  fg: string | undefined,
  bg: string | undefined,
  text: string,
  opts: { ignored?: boolean; large?: boolean } = {},
): AXNode {
  const properties: AXNode['properties'] = [];
  if (fg !== undefined) properties.push({ name: '__fg', value: { type: 'string', value: fg } });
  if (bg !== undefined) properties.push({ name: '__bg', value: { type: 'string', value: bg } });
  if (opts.large) properties.push({ name: '__large', value: { type: 'boolean', value: true } });
  const node: AXNode = {
    nodeId,
    role: { type: 'role', value: 'staticText' },
    name: { type: 'computedString', value: text },
    properties,
  };
  if (opts.ignored !== undefined) node.ignored = opts.ignored;
  return node;
}

function makeSnapshot(nodes: AXNode[]): UnifiedSnapshot {
  return {
    scanId: 'test-scan',
    url: 'https://example.com',
    timestamp: 0,
    axTree: nodes,
    domOutline: [],
    perfMetrics: {},
    networkResources: [],
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

function makeContext(snapshot: UnifiedSnapshot): AnalyzerContext {
  return { snapshot, page: undefined, logger: createNullLogger() };
}

describe('parseColor', () => {
  it('parses #RRGGBB hex', () => {
    expect(parseColor('#000000')).toEqual([0, 0, 0]);
    expect(parseColor('#ffffff')).toEqual([255, 255, 255]);
    expect(parseColor('#ff0000')).toEqual([255, 0, 0]);
  });

  it('parses #RGB short hex', () => {
    expect(parseColor('#000')).toEqual([0, 0, 0]);
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#f00')).toEqual([255, 0, 0]);
  });

  it('parses rgb(R, G, B)', () => {
    expect(parseColor('rgb(0, 0, 0)')).toEqual([0, 0, 0]);
    expect(parseColor('rgb(255, 255, 255)')).toEqual([255, 255, 255]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30]);
  });

  it('returns null for unparseable input', () => {
    expect(parseColor('not-a-color')).toBeNull();
    expect(parseColor('rgb()')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
  });

  it('returns 1 for white', () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 6);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white (WCAG max)', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
  });

  it('returns 1 for identical colours', () => {
    expect(contrastRatio([128, 128, 128], [128, 128, 128])).toBeCloseTo(1, 6);
  });

  it('is symmetric (L1/L2 ordering)', () => {
    const a = contrastRatio([0, 0, 0], [255, 255, 255]);
    const b = contrastRatio([255, 255, 255], [0, 0, 0]);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('colorContrastAnalyzer', () => {
  it('emits no findings when contrast is sufficient', async () => {
    const snapshot = makeSnapshot([
      makeNode('1', '#000000', '#ffffff', 'Black on white'),
    ]);
    const findings = await colorContrastAnalyzer.analyze(makeContext(snapshot));
    expect(findings).toHaveLength(0);
  });

  it('emits a finding when contrast is insufficient (normal text)', async () => {
    const snapshot = makeSnapshot([
      // Light grey on white is well below 4.5:1.
      makeNode('1', '#cccccc', '#ffffff', 'Low contrast'),
    ]);
    const findings = await colorContrastAnalyzer.analyze(makeContext(snapshot));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe('wcag-1.4.3-contrast-minimum');
    expect(findings[0]?.severity).toBe('serious');
    expect(findings[0]?.wcagMapping).toEqual(['1.4.3']);
  });

  it('uses the 3:1 threshold for large text', async () => {
    // mid-grey on white: contrast ratio ≈ 3.99:1 — fails normal (4.5), passes large (3).
    const normalNode = makeNode('1', '#949494', '#ffffff', 'normal');
    const largeNode = makeNode('2', '#949494', '#ffffff', 'large', { large: true });
    const snapshot = makeSnapshot([normalNode, largeNode]);
    const findings = await colorContrastAnalyzer.analyze(makeContext(snapshot));
    // Only the normal-text node should fail.
    expect(findings).toHaveLength(1);
    expect(findings[0]?.id.startsWith('1:')).toBe(true);
  });

  it('skips nodes with no contrast inputs', async () => {
    const snapshot = makeSnapshot([
      makeNode('1', undefined, undefined, 'no colour info'),
    ]);
    const findings = await colorContrastAnalyzer.analyze(makeContext(snapshot));
    expect(findings).toHaveLength(0);
  });

  it('skips ignored AX nodes', async () => {
    const snapshot = makeSnapshot([
      makeNode('1', '#cccccc', '#ffffff', 'ignored low contrast', { ignored: true }),
    ]);
    const findings = await colorContrastAnalyzer.analyze(makeContext(snapshot));
    expect(findings).toHaveLength(0);
  });

  it('factory returns a fresh analyzer instance each call', () => {
    const a = createColorContrastAnalyzer();
    const b = createColorContrastAnalyzer();
    expect(a).not.toBe(b);
    expect(a.domain).toBe('a11y');
    expect(a.ruleIds).toEqual(['wcag-1.4.3-contrast-minimum']);
  });

  it('stamps the scanId from the snapshot onto findings', async () => {
    const snapshot = makeSnapshot([
      makeNode('1', '#cccccc', '#ffffff', 'fail'),
    ]);
    snapshot.scanId = 'scan-xyz';
    const findings = await colorContrastAnalyzer.analyze(makeContext(snapshot));
    expect(findings[0]?.scanId).toBe('scan-xyz');
  });
});
