// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// What is worth holding about the payload is that a quiet scan still says
// something, that two runs of one scan produce the same bytes, and that a
// delivery which did not arrive is not reported as one that did.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildGateFailureEvent, buildMetricPayload } from '../dist/payloads.js';
import { assertSuccessfulDelivery, DatadogDeliveryError } from '../dist/transport.js';

const result = (over = {}) => ({
  url: 'https://example.test/',
  score: 92,
  gate: 'pass',
  violations: [],
  ...over,
});

const named = (payload, metric) => payload.series.filter((s) => s.metric === metric);

test('a scan with nothing to report still sends one series, at zero', () => {
  // Without it the metric simply stops arriving, and a series that stopped is
  // read as a collector that broke rather than a site that got better.
  const payload = buildMetricPayload(result(), 1000);
  const violations = named(payload, 'ariada.violations');
  assert.equal(violations.length, 1);
  assert.equal(violations[0].points[0].value, 0);
  assert.ok(violations[0].tags.includes('rule:none'));
});

test('two runs of one scan produce the same payload', () => {
  // Ordering that varies reads downstream as a change in the data.
  const violations = [
    { rule: 'zebra', impact: 'minor', count: 1 },
    { rule: 'alpha', impact: 'serious', count: 2 },
    { rule: 'alpha', impact: 'minor', count: 3 },
  ];
  const first = buildMetricPayload(result({ violations }), 1000);
  const second = buildMetricPayload(result({ violations: [...violations].reverse() }), 1000);
  assert.deepEqual(first, second);
  assert.deepEqual(
    named(first, 'ariada.violations').map((s) => s.tags[1]),
    ['rule:alpha', 'rule:alpha', 'rule:zebra'],
  );
});

test('the score and the gate travel as their own series', () => {
  const payload = buildMetricPayload(result({ gate: 'fail', score: 40 }), 1000);
  assert.equal(named(payload, 'ariada.score')[0].points[0].value, 40);
  assert.equal(named(payload, 'ariada.gate')[0].points[0].value, 0);
  assert.equal(named(buildMetricPayload(result(), 1000), 'ariada.gate')[0].points[0].value, 1);
});

test('a passing scan raises no event, and a failing one does', () => {
  assert.equal(buildGateFailureEvent(result(), 1000), null);
  const event = buildGateFailureEvent(result({ gate: 'fail', violations: [
    { rule: 'color-contrast', impact: 'serious', count: 2 },
  ] }), 1000);
  assert.equal(event.alert_type, 'error');
  assert.equal(event.date_happened, 1000);
  assert.ok(event.text.includes('Violations: 2'));
  assert.ok(event.tags.includes('gate:fail'));
  assert.ok(event.tags.includes('rule:color-contrast'));
});

test('a failing scan with no violations still says so rather than saying nothing', () => {
  const event = buildGateFailureEvent(result({ gate: 'fail' }), 1000);
  assert.ok(event.text.includes('Rules: none'));
  assert.ok(event.tags.includes('rule:none'));
});

test('a delivery outside the success range is an error carrying the body', () => {
  assert.doesNotThrow(() => assertSuccessfulDelivery('metrics', { status: 202 }));
  try {
    assertSuccessfulDelivery('event', { status: 403, body: { errors: ['forbidden'] } });
    assert.fail('expected a refusal');
  } catch (error) {
    assert.ok(error instanceof DatadogDeliveryError);
    assert.equal(error.status, 403);
    assert.deepEqual(error.responseBody, { errors: ['forbidden'] });
  }
});

test('a status that is not a status is refused as a transport fault, not a delivery one', () => {
  // A transport returning nothing usable is a defect here, not a rejection
  // there, and the two are repaired by different people.
  for (const bad of [undefined, null, '200', 1.5, 99]) {
    assert.throws(() => assertSuccessfulDelivery('metrics', { status: bad }), TypeError);
  }
});
