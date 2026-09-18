// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The parser refuses more than it accepts, and every refusal names a path. That
// is the property worth holding: an exporter that fails with "bad input" leaves
// the operator diffing a scan artifact by hand, and this one is the boundary
// between a scan and a metric that a dashboard will be read from.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AriadaParseError, parseAriadaScan } from '../dist/parser.js';

const scan = (over = {}) => ({
  url: 'https://example.test/',
  score: 92,
  gate: true,
  timestamp: '2026-09-08T10:00:00.000Z',
  violations: [],
  ...over,
});

test('a well-formed scan parses, and a JSON string parses the same way', () => {
  const fromObject = parseAriadaScan(scan());
  const fromText = parseAriadaScan(JSON.stringify(scan()));
  assert.deepEqual(fromObject, fromText);
  assert.equal(fromObject.score, 92);
});

test('a key nobody declared is refused rather than ignored', () => {
  // A newer scanner adding a field is a fact the operator should hear about,
  // not one to drop on the floor.
  assert.throws(() => parseAriadaScan(scan({ extra: 1 })), /\$\.extra: is not allowed/);
});

test('a missing key is named, not counted', () => {
  const { score: _score, ...without } = scan();
  assert.throws(() => parseAriadaScan(without), /\$\.score: is required/);
});

test('the address must be absolute, http or https, and carry no credentials', () => {
  assert.throws(() => parseAriadaScan(scan({ url: '/relative' })), /\$\.url: must be an absolute URL/);
  assert.throws(() => parseAriadaScan(scan({ url: 'ftp://example.test/' })), /must use http or https/);
  assert.throws(() => parseAriadaScan(scan({ url: 'https://u:p@example.test/' })), /must not contain credentials/);
});

test('a timestamp without a timezone is refused', () => {
  assert.throws(() => parseAriadaScan(scan({ timestamp: '2026-09-08T10:00:00' })), /valid ISO-8601 timestamp/);
  assert.throws(() => parseAriadaScan(scan({ timestamp: '2026-13-99T10:00:00Z' })), /valid ISO-8601 timestamp/);
});

test('a score outside nought through a hundred is refused', () => {
  for (const bad of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY, '92']) {
    assert.throws(() => parseAriadaScan(scan({ score: bad })), /\$\.score: must be a finite number/);
  }
});

test('a violation takes the scan address when it names none', () => {
  const [violation] = parseAriadaScan(scan({ violations: [{ rule: 'r', impact: 'serious' }] })).violations;
  assert.equal(violation.url, 'https://example.test/');
  assert.equal(violation.count, 1);
});

test('a violation count must be a positive whole number', () => {
  for (const bad of [0, -1, 1.5, '2']) {
    assert.throws(
      () => parseAriadaScan(scan({ violations: [{ rule: 'r', impact: 'i', count: bad }] })),
      /\$\.violations\[0\]\.count: must be a positive safe integer/,
    );
  }
});

test('a string with surrounding whitespace is not a name', () => {
  assert.throws(
    () => parseAriadaScan(scan({ violations: [{ rule: ' r', impact: 'i' }] })),
    /without surrounding whitespace/,
  );
});

test('text that is not JSON is refused at the root', () => {
  assert.throws(() => parseAriadaScan('{'), /\$: must be valid JSON/);
});

test('an array is not a record, whatever typeof says', () => {
  assert.throws(() => parseAriadaScan([]), /\$: must be an object/);
});

test('the error carries its own name, so a caller can tell it apart', () => {
  try {
    parseAriadaScan({});
    assert.fail('expected a refusal');
  } catch (error) {
    assert.ok(error instanceof AriadaParseError);
    assert.equal(error.name, 'AriadaParseError');
  }
});
