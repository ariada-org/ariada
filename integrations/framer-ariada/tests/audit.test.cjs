'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const { auditDesignNodes, contrastRatio, formatIssueList, parseColor } = require('../src/audit.cjs');

test('parses rgba and hex colors into normalized channels', () => {
  assert.deepEqual(parseColor('#336699'), { b: 0.6, g: 0.4, r: 0.2 });
  assert.deepEqual(parseColor('rgb(51, 102, 153)'), { b: 0.6, g: 0.4, r: 0.2 });
});

test('computes WCAG contrast ratio for black on white', () => {
  assert.equal(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }), 21);
});

test('flags contrast, target-size, and missing text alternatives in known-bad fixture', () => {
  const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/known-bad-frame.json'), 'utf8'));
  const result = auditDesignNodes(fixture.nodes);
  assert.deepEqual(
    result.issues.map((issue) => issue.rule).sort(),
    ['contrast', 'target-size', 'text-alternative']
  );
  assert.equal(result.summary.serious, 3);
});

test('accepts decorative image names and explicit alternatives', () => {
  const result = auditDesignNodes([
    { id: 'image-a', name: 'Decorative: dots', type: 'Image', width: 20, height: 20 },
    { ariadaAltText: 'Portrait of customer', id: 'image-b', name: 'Customer photo', type: 'Image', width: 20, height: 20 }
  ]);
  assert.equal(result.issues.some((issue) => issue.rule === 'text-alternative'), false);
});

test('formats bounded plugin panel copy', () => {
  const result = auditDesignNodes([
    { id: 'tiny-link', name: 'Close link', type: 'Frame', width: 18, height: 18, hasFlow: true }
  ]);
  assert.match(formatIssueList(result), /Ariada found 1 issue/);
  assert.match(formatIssueList(result), /Close link/);
});
