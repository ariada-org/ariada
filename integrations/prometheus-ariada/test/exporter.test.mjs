// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Two properties here are the ones a dashboard depends on and neither is
// visible from a single scrape: that repeated findings add up rather than
// overwrite each other, and that a rule which stops appearing stops being
// reported. A series that stopped being true and never stopped being published
// is the failure this file exists for.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createAriadaExporter } from '../dist/exporter.js';

const scan = (violations, over = {}) => ({
  url: 'https://example.test/',
  score: 80,
  gate: false,
  timestamp: '2026-09-08T10:00:00.000Z',
  violations,
  ...over,
});

const value = async (exporter, name, labels = {}) => {
  const metrics = await exporter.registry.getMetricsAsJSON();
  const metric = metrics.find((m) => m.name === name);
  const entry = metric?.values.find((v) =>
    Object.entries(labels).every(([k, x]) => v.labels[k] === x));
  return entry?.value;
};

test('two findings with the same labels add up rather than overwrite', async () => {
  const exporter = createAriadaExporter();
  await exporter.ingest(scan([
    { rule: 'color-contrast', impact: 'serious', count: 2 },
    { rule: 'color-contrast', impact: 'serious', count: 3 },
  ]));
  assert.equal(await value(exporter, 'ariada_violations_total', { rule: 'color-contrast' }), 5);
});

test('a rule that stops appearing stops being reported', async () => {
  const exporter = createAriadaExporter();
  await exporter.ingest(scan([{ rule: 'gone', impact: 'minor' }, { rule: 'stays', impact: 'minor' }]));
  assert.equal(await value(exporter, 'ariada_violations_total', { rule: 'gone' }), 1);
  await exporter.ingest(scan([{ rule: 'stays', impact: 'minor' }]));
  assert.equal(await value(exporter, 'ariada_violations_total', { rule: 'gone' }), undefined);
  assert.equal(await value(exporter, 'ariada_violations_total', { rule: 'stays' }), 1);
});

test('the gate becomes one and nought, and the timestamp becomes seconds', async () => {
  const exporter = createAriadaExporter();
  await exporter.ingest(scan([], { gate: true, score: 97 }));
  assert.equal(await value(exporter, 'ariada_gate'), 1);
  assert.equal(await value(exporter, 'ariada_score'), 97);
  assert.equal(await value(exporter, 'ariada_scan_timestamp'), Date.parse('2026-09-08T10:00:00.000Z') / 1000);
  await exporter.ingest(scan([], { gate: false }));
  assert.equal(await value(exporter, 'ariada_gate'), 0);
});

test('two addresses keep their own series', async () => {
  const exporter = createAriadaExporter();
  await exporter.ingest(scan([{ rule: 'a', impact: 'minor' }]));
  await exporter.ingest(scan([{ rule: 'b', impact: 'minor', url: 'https://other.test/' }],
    { url: 'https://other.test/' }));
  assert.equal(await value(exporter, 'ariada_violations_total', { rule: 'a' }), 1);
  assert.equal(await value(exporter, 'ariada_violations_total', { rule: 'b' }), 1);
});

test('a push adapter is called once per ingest, and only if given', async () => {
  let pushes = 0;
  const exporter = createAriadaExporter({ pushAdapter: { push: async () => { pushes += 1; } } });
  await exporter.ingest(scan([]));
  await exporter.ingest(scan([]));
  assert.equal(pushes, 2);
  await assert.doesNotReject(createAriadaExporter().ingest(scan([])));
});

test('a scan that will not parse reaches nothing and changes nothing', async () => {
  const exporter = createAriadaExporter();
  await exporter.ingest(scan([{ rule: 'kept', impact: 'minor' }]));
  await assert.rejects(exporter.ingest({ nonsense: true }));
  assert.equal(await value(exporter, 'ariada_violations_total', { rule: 'kept' }), 1);
});

test('the scrape is the registry text, and it names the metrics', async () => {
  const exporter = createAriadaExporter();
  await exporter.ingest(scan([{ rule: 'r', impact: 'serious' }]));
  const text = await exporter.scrape();
  for (const name of ['ariada_violations_total', 'ariada_score', 'ariada_gate', 'ariada_scan_timestamp']) {
    assert.ok(text.includes(name), `${name} missing from the scrape`);
  }
});
