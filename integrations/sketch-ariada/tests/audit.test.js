'use strict';

/* eslint-disable @typescript-eslint/no-require-imports */
/* global require */

const assert = require('node:assert/strict');
const test = require('node:test');

const { auditSelection, contrastRatio, formatIssueList, parseColor } = require('../ariada-accessibility-check.sketchplugin/Contents/Sketch/audit');

const black = { b: 0, g: 0, r: 0 };
const white = { b: 1, g: 1, r: 1 };
const lightGray = { b: 0.78, g: 0.78, r: 0.78 };

function node(overrides) {
  return {
    children: [],
    fills: [],
    height: 100,
    id: 'node',
    name: 'Layer',
    type: 'Group',
    width: 100,
    ...overrides
  };
}

test('parses Sketch rgba hex strings into normalized colors', () => {
  assert.deepEqual(parseColor('#336699ff'), { b: 0.6, g: 0.4, r: 0.2 });
});

test('computes WCAG contrast ratio for black on white', () => {
  assert.equal(contrastRatio(black, white), 21);
});

test('does not compare text fill against itself when a parent background exists', () => {
  const result = auditSelection([
    node({
      fills: [{ color: white, type: 'SOLID', visible: true }],
      children: [
        node({
          id: 'text',
          name: 'Body copy',
          textColor: '#000000ff',
          type: 'Text'
        })
      ]
    })
  ]);

  assert.equal(result.issues.some((issue) => issue.rule === 'contrast'), false);
});

test('flags low contrast text against selected artboard background', () => {
  const result = auditSelection([
    node({
      fills: [{ color: white, type: 'SOLID', visible: true }],
      type: 'Artboard',
      children: [
        node({
          id: 'text',
          name: 'Muted body copy',
          textColor: lightGray,
          type: 'Text'
        })
      ]
    })
  ]);

  assert.equal(result.issues.some((issue) => issue.rule === 'contrast'), true);
});

test('flags small interactive targets and image layers without text alternatives', () => {
  const result = auditSelection([
    node({
      children: [
        node({ height: 18, id: 'button', name: 'Icon button', width: 18 }),
        node({ id: 'image', name: 'Hero photo', type: 'Image' })
      ],
      name: 'Product card'
    })
  ]);

  assert.deepEqual(
    result.issues.map((issue) => issue.rule).sort(),
    ['target-size', 'text-alternative']
  );
});

test('accepts layer names and plugin data as text alternative markers', () => {
  const result = auditSelection([
    node({ id: 'decorative', name: 'Decorative: background texture', type: 'Image' }),
    node({ altText: 'Portrait of customer', id: 'portrait', name: 'Customer photo', type: 'Image' })
  ]);

  assert.equal(result.issues.some((issue) => issue.rule === 'text-alternative'), false);
});

test('formats a bounded result panel message', () => {
  const result = auditSelection([
    node({
      children: [node({ height: 18, id: 'button', name: 'Icon button', width: 18 })]
    })
  ]);

  assert.match(formatIssueList(result), /Ariada found 1 issue/);
  assert.match(formatIssueList(result), /Icon button/);
});
