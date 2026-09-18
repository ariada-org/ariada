// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The one thing this integration must not do is file the same finding twice.
// Everything else it gets wrong shows up in an issue somebody reads; a
// duplicate shows up as a board nobody trusts. So the identity of a finding,
// and the reading of that identity back out of an issue already filed, are what
// these cases are about.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  findingsFromReport,
  fingerprint,
  hasFingerprint,
  toLinearIssue,
} from '../dist/mapper.js';

test('findings are found under any of the three names a report may use', () => {
  assert.equal(findingsFromReport({ findings: [{ rule: 'a' }] }).length, 1);
  assert.equal(findingsFromReport({ violations: [{ rule: 'a' }] }).length, 1);
  assert.equal(findingsFromReport({ report: { findings: [{ rule: 'a' }] } }).length, 1);
  assert.deepEqual(findingsFromReport({}), []);
});

test('the outer name wins when a report carries more than one', () => {
  const found = findingsFromReport({ findings: [{ rule: 'outer' }], violations: [{ rule: 'inner' }] });
  assert.deepEqual(found.map((f) => f.rule), ['outer']);
});

test('a finding that names its own identity keeps it', () => {
  assert.equal(fingerprint({ fingerprint: '  given  ' }), 'given');
});

test('a finding without one gets the same identity every time', () => {
  const finding = { ruleId: 'color-contrast', page: 'https://x.test/', selector: '#main' };
  assert.equal(fingerprint(finding), fingerprint(finding));
  assert.match(fingerprint(finding), /^[0-9a-f]{32}$/);
});

test('identity follows rule, page and selector, and nothing else', () => {
  const base = { ruleId: 'r', page: 'https://x.test/', selector: '#a' };
  assert.equal(fingerprint({ ...base, message: 'one' }), fingerprint({ ...base, message: 'two' }));
  assert.notEqual(fingerprint(base), fingerprint({ ...base, selector: '#b' }));
  assert.notEqual(fingerprint(base), fingerprint({ ...base, page: 'https://y.test/' }));
});

test('an issue is recognised by the identity written into its body', () => {
  const fp = fingerprint({ ruleId: 'r' });
  const issue = toLinearIssue({ ruleId: 'r' }, { teamId: 'T' });
  assert.ok(issue.description.includes(`(${fp})`));
  assert.equal(hasFingerprint({ id: '1', description: issue.description }, fp), true);
  assert.equal(hasFingerprint({ id: '1', description: 'unrelated' }, fp), false);
});

test('an issue is also recognised by a label carrying the identity', () => {
  const labelled = { id: '1', labels: { nodes: [{ name: 'ariada:fingerprint:abc' }] } };
  assert.equal(hasFingerprint(labelled, 'abc'), true);
  assert.equal(hasFingerprint(labelled, 'other'), false);
  assert.equal(hasFingerprint({ id: '1' }, 'abc'), false);
});

test('a severity nobody knows becomes moderate rather than a label of its own', () => {
  assert.ok(toLinearIssue({ severity: 'apocalyptic' }, { teamId: 'T' }).title.startsWith('[moderate]'));
  assert.ok(toLinearIssue({ severity: 'serious' }, { teamId: 'T' }).title.startsWith('[serious]'));
});

test('a list of criteria is joined, and an absent one says so', () => {
  const issue = toLinearIssue({ wcag: ['1.4.3', '2.4.7'] }, { teamId: 'T' });
  assert.ok(issue.description.includes('WCAG: 1.4.3, 2.4.7'));
  assert.ok(issue.description.includes('EN 301 549: Not specified'));
});

test('the report address is carried only when there is one', () => {
  const withUrl = toLinearIssue({ rule: 'r' }, { teamId: 'T', reportUrl: 'https://r.test/' });
  assert.equal(withUrl.sourceUrl, 'https://r.test/');
  assert.ok(withUrl.description.includes('Report: https://r.test/'));
  const without = toLinearIssue({ rule: 'r' }, { teamId: 'T' });
  assert.equal('sourceUrl' in without, false);
  assert.equal(without.description.includes('Report:'), false);
});

test('the labels name the severity and the rule', () => {
  const issue = toLinearIssue({ ruleId: 'color-contrast', severity: 'critical' }, { teamId: 'T' });
  assert.deepEqual(issue.labelNames, ['ariada:critical', 'ariada:color-contrast']);
  assert.equal(issue.teamId, 'T');
});
