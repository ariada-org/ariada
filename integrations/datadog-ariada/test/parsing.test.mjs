// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// This sends metrics to somebody's dashboard, so what it refuses matters more
// than what it accepts. A payload that goes out slightly wrong does not fail —
// it lands, and is read.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AriadaValidationError,
  parseAriadaJson,
  parseAriadaResult,
  parseDatadogConfig,
  parseDatadogEnvironment,
  parseTimestamp,
} from '../dist/parsing.js';

const result = (over = {}) => ({
  url: 'https://example.test/',
  score: 92,
  gate: 'pass',
  violations: [],
  ...over,
});

test('a well-formed result parses, from an object or from text', () => {
  assert.equal(parseAriadaResult(result()).score, 92);
  assert.deepEqual(parseAriadaJson(JSON.stringify(result())), parseAriadaResult(result()));
  assert.throws(() => parseAriadaJson('{'), /input must be valid JSON/);
});

test('a field nobody declared is refused, and named', () => {
  // A caller writing `apiKeyy` would otherwise send a payload with no
  // credential and be told nothing about why it was rejected downstream.
  assert.throws(() => parseAriadaResult(result({ extra: 1 })), /unknown field\(s\): extra/);
  assert.throws(
    () => parseDatadogConfig({ apiKey: 'a', appKey: 'b', site: 'datadoghq.com', x: 1 }),
    /unknown field\(s\): x/,
  );
});

test('a missing field is named too', () => {
  const { score: _score, ...without } = result();
  assert.throws(() => parseAriadaResult(without), /missing required field\(s\): score/);
});

test('the same rule at the same impact twice is refused', () => {
  // Two series with one set of tags: the collector keeps whichever arrived
  // last, and the total silently loses one of them.
  const twice = result({ violations: [
    { rule: 'color-contrast', impact: 'serious', count: 1 },
    { rule: 'color-contrast', impact: 'serious', count: 2 },
  ] });
  assert.throws(() => parseAriadaResult(twice), /duplicate rule\/impact pair/);
});

test('the same rule at different impacts is not a duplicate', () => {
  const fine = result({ violations: [
    { rule: 'color-contrast', impact: 'serious', count: 1 },
    { rule: 'color-contrast', impact: 'minor', count: 2 },
  ] });
  assert.equal(parseAriadaResult(fine).violations.length, 2);
});

test('a string carrying a control character is refused', () => {
  // A newline inside a tag splits one log line into two, and the second looks
  // like a record nobody wrote.
  const withNewline = 'https://a.test/' + String.fromCharCode(10);
  assert.throws(() => parseAriadaResult(result({ url: withNewline })), /without control characters/);
  const withTab = 'a' + String.fromCharCode(9) + 'b';
  assert.throws(
    () => parseDatadogConfig({ apiKey: withTab, appKey: 'b', site: 'datadoghq.com' }),
    /without control characters/,
  );
});

test('an untrimmed string is refused rather than trimmed', () => {
  assert.throws(() => parseDatadogConfig({ apiKey: ' a', appKey: 'b', site: 'datadoghq.com' }), /trimmed/);
});

test('a rule name outside the permitted shape is refused', () => {
  for (const bad of ['Color-Contrast', '-leading', 'a'.repeat(101), '']) {
    assert.throws(() => parseAriadaResult(result({ violations: [{ rule: bad, impact: 'minor', count: 1 }] })));
  }
});

test('a count must be a positive whole number, and a score must be in range', () => {
  for (const bad of [0, -1, 1.5, '2']) {
    assert.throws(
      () => parseAriadaResult(result({ violations: [{ rule: 'r', impact: 'minor', count: bad }] })),
      /positive safe integer/,
    );
  }
  for (const bad of [-1, 101, Number.NaN]) {
    assert.throws(() => parseAriadaResult(result({ score: bad })), /finite number from 0 through 100/);
  }
});

test('a site nobody publishes to is refused, and every published one is accepted', () => {
  assert.throws(() => parseDatadogConfig({ apiKey: 'a', appKey: 'b', site: 'example.test' }), /site must be one of/);
  for (const site of ['datadoghq.com', 'datadoghq.eu', 'ddog-gov.com', 'ap2.datadoghq.com']) {
    assert.equal(parseDatadogConfig({ apiKey: 'a', appKey: 'b', site }).site, site);
  }
});

test('the environment is read into the same shape, and refused the same way', () => {
  const config = parseDatadogEnvironment({ DD_API_KEY: 'a', DD_APP_KEY: 'b', DD_SITE: 'datadoghq.eu' });
  assert.deepEqual(config, { apiKey: 'a', appKey: 'b', site: 'datadoghq.eu' });
  assert.throws(() => parseDatadogEnvironment({ DD_API_KEY: 'a', DD_APP_KEY: 'b' }), AriadaValidationError);
});

test('a timestamp must be whole seconds at or after the epoch', () => {
  assert.equal(parseTimestamp(1_700_000_000), 1_700_000_000);
  for (const bad of [-1, 1.5, '2', Number.NaN]) {
    assert.throws(() => parseTimestamp(bad), /non-negative POSIX timestamp/);
  }
});
