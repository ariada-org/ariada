// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The mapping is almost entirely fallback chains, so what is worth holding is
// which field wins when several are present and what happens when none is. A
// report reaches this integration from more than one version of the scanner and
// from a webhook somebody configured by hand; the chains exist for that, and a
// test on the happy path would exercise none of them.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { mapViolation, mapViolations, mapScanCompleted, parseReport } = require('../dist/mapper.js');

test('a finding under the older name is still found', () => {
  const report = { violations: [{ ruleId: 'a' }] };
  assert.equal(mapViolations(report).length, 1);
});

test('findings win over violations when a report carries both', () => {
  const rows = mapViolations({ findings: [{ ruleId: 'new' }], violations: [{ ruleId: 'old' }] });
  assert.deepEqual(rows.map((r) => r.ruleId), ['new']);
});

test('the page stands in for a missing url, and the report for a missing page', () => {
  assert.equal(mapViolation({ page: 'p' }, { url: 'r' }).url, 'p');
  assert.equal(mapViolation({}, { url: 'r' }).url, 'r');
});

test('an array of success criteria becomes one string', () => {
  assert.equal(mapViolation({ wcag: ['1.4.3', '2.4.7'] }, {}).wcag, '1.4.3, 2.4.7');
});

test('a severity nobody knows is named as unknown rather than passed through', () => {
  assert.equal(mapViolation({ severity: 'catastrophic' }, {}).severity, 'unknown');
  assert.equal(mapViolation({ severity: 'SERIOUS' }, {}).severity, 'serious');
});

test('a finding without an identifier gets a stable one, and the same one twice', () => {
  const finding = { ruleId: 'color-contrast', selector: '#main', message: 'low' };
  const first = mapViolation(finding, { url: 'https://x.test/' });
  const second = mapViolation(finding, { url: 'https://x.test/' });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^[0-9a-f]{8}$/);
});

test('two findings that differ get different identifiers', () => {
  const a = mapViolation({ ruleId: 'a', selector: '#one' }, {});
  const b = mapViolation({ ruleId: 'a', selector: '#two' }, {});
  assert.notEqual(a.fingerprint, b.fingerprint);
});

test('the gate decides whether a scan passed when the report does not say', () => {
  assert.equal(mapScanCompleted({ gate: { passed: true } }).passed, true);
  assert.equal(mapScanCompleted({ passed: false, gate: { passed: true } }).passed, false);
  assert.equal(mapScanCompleted({}).passed, false);
});

test('critical findings are counted apart from the rest', () => {
  const done = mapScanCompleted({
    findings: [{ severity: 'critical' }, { severity: 'minor' }, { severity: 'critical' }],
  });
  assert.equal(done.findingCount, 3);
  assert.equal(done.criticalCount, 2);
});

test('a missing completion time is the epoch, not now', () => {
  // A made-up recent timestamp would sort as fresh. A wrong answer that looks
  // plausible is worse than one that does not.
  assert.equal(mapScanCompleted({}).completedAt, '1970-01-01T00:00:00.000Z');
});

test('anything that is not a record is refused rather than filled in', () => {
  for (const bad of [null, undefined, 'report', 42, true]) {
    assert.throws(() => parseReport(bad), /must be a JSON object/);
  }
  assert.deepEqual(parseReport({ url: 'x' }), { url: 'x' });
});

test('an empty report yields no rows and no counts', () => {
  assert.deepEqual(mapViolations({}), []);
  const done = mapScanCompleted({});
  assert.equal(done.findingCount, 0);
  assert.equal(done.criticalCount, 0);
});
