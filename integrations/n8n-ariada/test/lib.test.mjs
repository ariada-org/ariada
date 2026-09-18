// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The webhook is the one door a stranger can knock on, and the fingerprint is
// what stops one finding from becoming two rows in somebody's workflow. Those
// are the two things worth holding here; the rest of this package is shape.

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// The package emits CommonJS, so the modules under test are required rather
// than imported. The suite itself stays a module, which is what the linter and
// the rest of this repository expect.
const require = createRequire(import.meta.url);
const { parseReportJson, parseWebhookPayload, createWebhookBoundary } = require('../dist/lib/boundary');
const { normalizeReport, findingFingerprint, reportToItems, reportToCompletionItem, getText } = require('../dist/lib/report');

const report = (over = {}) => ({
  scanId: 's1',
  passed: false,
  sourceUrl: 'https://example.test/',
  findings: [{ ruleId: 'color-contrast', selector: '#main' }],
  ...over,
});

test('a report missing any of the three required fields is refused', () => {
  for (const missing of ['scanId', 'passed', 'findings']) {
    const broken = report();
    delete broken[missing];
    assert.throws(() => normalizeReport(broken), /scanId, passed, and findings are required/);
  }
  assert.throws(() => normalizeReport('not a record'), /are required/);
  assert.throws(() => normalizeReport([]), /are required/);
});

test('a finding without a rule is refused, and the index is named', () => {
  const broken = report({ findings: [{ ruleId: 'ok' }, { title: 'no rule' }] });
  assert.throws(() => normalizeReport(broken), /Invalid Ariada finding at index 1/);
});

test('fields nobody asked about are carried through rather than dropped', () => {
  // A newer scanner adding a field should reach the workflow, not be filtered
  // out by an adapter that predates it.
  const normalized = normalizeReport(report({ schemaVersion: '2', extra: { a: 1 } }));
  assert.equal(normalized.schemaVersion, '2');
  assert.deepEqual(normalized.extra, { a: 1 });
});

test('a finding that names its own identity keeps it', () => {
  assert.equal(findingFingerprint(report(), { ruleId: 'r', fingerprint: 'given' }), 'given');
});

test('the same finding gets the same identity, and a different one a different identity', () => {
  const r = normalizeReport(report());
  const finding = { ruleId: 'color-contrast', selector: '#main' };
  assert.equal(findingFingerprint(r, finding), findingFingerprint(r, finding));
  assert.notEqual(findingFingerprint(r, finding), findingFingerprint(r, { ...finding, selector: '#other' }));
  assert.match(findingFingerprint(r, finding), /^[0-9a-f]{64}$/);
});

test('identity does not move when the wording does', () => {
  // A rerun that reworded a message must not look like a new finding.
  const r = normalizeReport(report());
  const finding = { ruleId: 'r', selector: '#a', url: 'https://example.test/' };
  assert.equal(
    findingFingerprint(r, { ...finding, title: 'one' }),
    findingFingerprint(r, { ...finding, title: 'two' }),
  );
});

test('one item per finding, each carrying the scan it came from', () => {
  const items = reportToItems(report({ findings: [{ ruleId: 'a' }, { ruleId: 'b' }] }));
  assert.equal(items.length, 2);
  assert.equal(items[0].scanId, 's1');
  assert.equal(items[0].passed, false);
  assert.ok(items[0].fingerprint);
  assert.notEqual(items[0].fingerprint, items[1].fingerprint);
});

test('the completion item counts the findings rather than carrying them', () => {
  const item = reportToCompletionItem(report({ findings: [{ ruleId: 'a' }, { ruleId: 'b' }] }));
  assert.equal(item.event, 'scan.completed');
  assert.equal(item.findingCount, 2);
  assert.equal('findings' in item, false);
});

test('a webhook for another event is refused, and so is one without a report', () => {
  assert.throws(() => parseWebhookPayload({ event: 'scan.started', report: report() }), /must be scan.completed/);
  assert.throws(() => parseWebhookPayload({ event: 'scan.completed' }), /report is required/);
  assert.throws(() => parseWebhookPayload('nonsense'), /must be scan.completed/);
});

test('a webhook carrying a report that is not one is refused before anything reads it', () => {
  assert.throws(() => parseWebhookPayload({ event: 'scan.completed', report: { scanId: 1 } }), /are required/);
});

test('the boundary refuses before the handler runs', async () => {
  let reached = false;
  const handler = createWebhookBoundary(() => { reached = true; });
  await assert.rejects(handler({ event: 'scan.started' }));
  assert.equal(reached, false);
  await handler({ event: 'scan.completed', report: report() });
  assert.equal(reached, true);
});

test('text is read from a string and from nothing else', () => {
  assert.equal(getText('a'), 'a');
  for (const bad of [undefined, null, 1, {}, []]) {
    assert.equal(getText(bad), '');
  }
});

test('report JSON is parsed and validated in one step', () => {
  assert.equal(parseReportJson(JSON.stringify(report())).scanId, 's1');
  assert.throws(() => parseReportJson('{"scanId":"s"}'), /are required/);
});
