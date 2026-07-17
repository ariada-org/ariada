import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDesignNode, scanDesignSelection } from '../src/scanner.js';

const fixturePath = resolve(import.meta.dirname, 'fixtures/known-bad-frame.json');

describe('Ariada Figma design scanner', () => {
  it('flags the known-bad Figma fixture', () => {
    const fixture = parseDesignNode(JSON.parse(readFileSync(fixturePath, 'utf8')));
    const result = scanDesignSelection([fixture], '2026-07-01T00:00:00.000Z');

    expect(result.selectedNodeCount).toBe(1);
    expect(result.visitedNodeCount).toBe(6);
    expect(result.summary.findings).toBeGreaterThanOrEqual(4);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual(
      expect.arrayContaining([
        'ariada.design.contrast.minimum',
        'ariada.design.target-size.minimum',
        'ariada.design.target-size.recommended',
        'ariada.design.text-alternative.missing',
      ]),
    );
  });

  it('passes a corrected frame without findings', () => {
    const fixture = parseDesignNode({
      id: '2:1',
      name: 'Article card',
      type: 'FRAME',
      width: 320,
      height: 180,
      visible: true,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
      strokes: [],
      pluginData: { role: 'main' },
      children: [
        {
          id: '2:2',
          name: 'H2 Article title',
          type: 'TEXT',
          width: 240,
          height: 32,
          visible: true,
          fills: [{ type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.05 } }],
          strokes: [],
          characters: 'Article title',
          fontSize: 20,
          pluginData: { headingLevel: '2' },
          children: [],
        },
        {
          id: '2:3',
          name: 'Read more button',
          type: 'FRAME',
          width: 48,
          height: 44,
          visible: true,
          fills: [{ type: 'SOLID', color: { r: 0.07, g: 0.25, b: 0.36 } }],
          strokes: [],
          pluginData: { role: 'button', 'aria-label': 'Read more' },
          children: [],
        },
        {
          id: '2:4',
          name: 'Decorative sparkle',
          type: 'VECTOR',
          width: 16,
          height: 16,
          visible: true,
          fills: [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }],
          strokes: [],
          pluginData: { decorative: 'true' },
          children: [],
        },
      ],
    });

    const result = scanDesignSelection([fixture], '2026-07-01T00:00:00.000Z');

    expect(result.summary.findings).toBe(0);
  });
});
