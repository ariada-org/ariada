// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The parser is the one part of this component that decides anything on its
// own, and almost all of it is refusal. What is worth holding is that each
// refusal names the field it is about — a resource that fails with "invalid
// JSON" and no field leaves the operator reading a scan artifact by hand — and
// that the one cross-field check actually compares the two numbers rather than
// trusting either.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseScanJson } from '../dist/report.js';

const SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';

const artifact = (over = {}, counts = {}) =>
  JSON.stringify({
    $schema: SCHEMA,
    url: 'https://example.test/',
    scanId: 'scan-1',
    report: {},
    exitCode: 0,
    summary: {
      total: 0,
      byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0, ...counts },
    },
    ...over,
  });

test('a well-formed artifact yields a frozen result', () => {
  const result = parseScanJson(artifact());
  assert.equal(result.violations, 0);
  assert.equal(result.pass, true);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.counts));
});

test('a non-zero exit code means the gate did not pass', () => {
  assert.equal(parseScanJson(artifact({ exitCode: 1 })).pass, false);
});

test('an exit code that is neither is refused, because the scan did not finish', () => {
  // Three means the process died. Reading a partial artifact as a passing scan
  // is the one failure here that would be silent.
  assert.throws(() => parseScanJson(artifact({ exitCode: 3 })), /exitCode must be 0 or 1/);
});

test('the total is compared against the counts rather than trusted', () => {
  const skewed = artifact({ summary: { total: 5, byImpact: { critical: 1, serious: 0, moderate: 0, minor: 0 } } });
  assert.throws(() => parseScanJson(skewed), /does not match severity counts/);
});

test('the total agreeing with the counts passes, and the counts are carried through', () => {
  const ok = artifact({ summary: { total: 3, byImpact: { critical: 1, serious: 2, moderate: 0, minor: 0 } } });
  const result = parseScanJson(ok);
  assert.equal(result.violations, 3);
  assert.deepEqual({ ...result.counts }, { critical: 1, serious: 2, moderate: 0, minor: 0 });
});

test('an artifact from some other schema is refused by name', () => {
  assert.throws(() => parseScanJson(artifact({ $schema: 'https://example.test/other.json' })), /\$schema must be/);
});

test('text that is not JSON is refused with the reason attached', () => {
  assert.throws(() => parseScanJson('not json'), /document is not valid JSON/);
});

test('each missing field is named rather than lumped together', () => {
  assert.throws(() => parseScanJson(artifact({ url: '' })), /url must be a non-empty string/);
  assert.throws(() => parseScanJson(artifact({ scanId: '' })), /scanId must be a non-empty string/);
  assert.throws(() => parseScanJson(artifact({ report: 'x' })), /report must be an object/);
  assert.throws(() => parseScanJson(artifact({ summary: 'x' })), /summary must be an object/);
});

test('a count that is not a whole number at or above zero is refused, by path', () => {
  for (const bad of [-1, 1.5, '2', null]) {
    assert.throws(
      () => parseScanJson(artifact({}, { serious: bad })),
      /summary\.byImpact\.serious must be a non-negative safe integer/,
    );
  }
});

test('an array is not a record, whatever typeof says about it', () => {
  assert.throws(() => parseScanJson('[]'), /root must be an object/);
});
