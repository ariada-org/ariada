import assert from 'node:assert/strict';
import test from 'node:test';

import { createAriadaCliArgs, normalizeSelection, renderLayersToHtml, summarizeAriadaFindings } from '../dist/index.js';

const selectedLayers = [
  {
    _t: 'FRAME',
    fills: [{ color: '#ffffff', visible: true }],
    frame: { height: 320, width: 480, x: 0, y: 0 },
    id: 'frame',
    layers: [
      {
        _t: 'TEXT',
        frame: { height: 24, width: 220, x: 24, y: 24 },
        id: 'muted-copy',
        name: 'Muted body copy',
        text: 'Muted body copy',
        textColor: '#c4c4c4'
      },
      {
        frame: { height: 18, width: 18, x: 24, y: 72 },
        id: 'tiny-button',
        name: 'Icon button'
      }
    ],
    name: 'Known bad Lunacy frame'
  }
];

test('normalizes Lunacy getselected responses', () => {
  assert.equal(normalizeSelection({}).length, 0);
  assert.equal(normalizeSelection(selectedLayers[0]).length, 1);
  assert.equal(normalizeSelection(selectedLayers).length, 1);
});

test('maps Lunacy layers to a local HTML scan target for the Ariada CLI', () => {
  const html = renderLayersToHtml(selectedLayers);
  assert.match(html, /Muted body copy/);
  assert.match(html, /color:#c4c4c4/);
  assert.match(html, /<button class="layer"/);
  assert.match(html, /width:18px;height:18px/);
});

test('builds a thin @ariada-org/cli scan invocation', () => {
  assert.deepEqual(createAriadaCliArgs('http://127.0.0.1:31415/', { outputDir: 'out', severityThreshold: 'serious' }), [
    '--yes',
    '@ariada-org/cli',
    'scan',
    'http://127.0.0.1:31415/',
    '--format',
    'json',
    '--output-dir',
    'out',
    '--severity-threshold',
    'serious'
  ]);
});

test('surfaces contrast and target-size verdict IDs from CLI JSON', () => {
  const ids = summarizeAriadaFindings({
    findings: [
      { ruleId: 'wcag/contrast-minimum' },
      { id: 'wcag/target-size-minimum' }
    ]
  });
  assert.deepEqual(ids, ['wcag/contrast-minimum', 'wcag/target-size-minimum']);
});
