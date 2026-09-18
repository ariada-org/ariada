// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// This one files a task per finding and must not file the same finding twice.
// It has three ways of noticing it already has: a line in the task body, a tag,
// and a state file carried between runs. All three exist because any one of
// them can be absent — a task edited by a person loses the line, a workspace
// with tags turned off loses the tag, and the first run has no state file. The
// cases below are one per way, plus what happens when the transport is asked
// for something and the answer is nothing.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { syncReport } from '../dist/action.js';
import { fingerprint, hasFingerprint, toClickUpTask } from '../dist/mapper.js';

const transport = (existing = []) => {
  const created = [];
  return {
    created,
    async listTasks() { return existing; },
    async createTask(_listId, input) {
      const task = { id: `t${created.length + 1}`, name: input.name, description: input.description, tags: input.tags.map((name) => ({ name })) };
      created.push(task);
      return task;
    },
    async createWebhook() { return { id: 'w1' }; },
  };
};

const report = (findings) => ({ url: 'https://example.test/', findings });

// The identity is computed against the report's address, because that is what
// `syncReport` passes down. Computing it here without one gives a different
// digest for the same finding — which is how the first draft of these cases
// asserted a value the code never produces, and looked like three defects.
const idOf = (finding) => fingerprint(finding, 'https://example.test/');

test('a finding becomes a task, and the same finding twice becomes one', async () => {
  const t = transport();
  const finding = { ruleId: 'color-contrast', page: 'https://example.test/', selector: '#main' };
  const first = await syncReport(report([finding]), { listId: 'L', transport: t });
  assert.equal(first.created.length, 1);
  const second = await syncReport(report([finding]), {
    listId: 'L',
    transport: { ...t, listTasks: async () => t.created },
  });
  assert.equal(second.created.length, 0);
  assert.deepEqual(second.skipped, [idOf(finding)]);
});

test('a task recognised only by its tag still counts as filed', async () => {
  // A person editing the description loses the line; the tag survives.
  const finding = { ruleId: 'r' };
  const fp = idOf(finding);
  const t = transport([{ id: 'old', description: 'rewritten by a person', tags: [{ name: `ariada-fp-${fp}` }] }]);
  const result = await syncReport(report([finding]), { listId: 'L', transport: t });
  assert.equal(result.created.length, 0);
  assert.deepEqual(result.skipped, [fp]);
});

test('a state file carried between runs is believed even when the list is empty', async () => {
  const finding = { ruleId: 'r' };
  const fp = idOf(finding);
  const state = { fingerprints: { [fp]: 'previously' } };
  const result = await syncReport(report([finding]), { listId: 'L', transport: transport(), state });
  assert.equal(result.created.length, 0);
  assert.deepEqual(result.skipped, [fp]);
});

test('the state file learns what this run filed', async () => {
  const state = { fingerprints: {} };
  const t = transport();
  const finding = { ruleId: 'r' };
  await syncReport(report([finding]), { listId: 'L', transport: t, state });
  assert.deepEqual(Object.keys(state.fingerprints), [idOf(finding)]);
  assert.equal(state.fingerprints[idOf(finding)], 't1');
});

test('two findings alike within one report file one task, not two', async () => {
  const finding = { ruleId: 'r', selector: '#a' };
  const result = await syncReport(report([finding, { ...finding }]), { listId: 'L', transport: transport() });
  assert.equal(result.created.length, 1);
  assert.equal(result.skipped.length, 1);
});

test('the custom fields appear only when the workspace named them', () => {
  const bare = toClickUpTask({ ruleId: 'r' }, {});
  assert.deepEqual(bare.custom_fields, []);
  const named = toClickUpTask({ ruleId: 'r', severity: 'serious' }, { severityFieldId: 'S', ruleIdFieldId: 'R' });
  assert.deepEqual(named.custom_fields, [{ id: 'S', value: 'serious' }, { id: 'R', value: 'r' }]);
});

test('the tags carry the identity, the severity and the rule', () => {
  const input = toClickUpTask({ ruleId: 'color-contrast', severity: 'critical' }, {});
  assert.ok(input.tags.includes('ariada'));
  assert.ok(input.tags.includes('ariada-critical'));
  assert.ok(input.tags.includes('ariada-color-contrast'));
  assert.ok(input.tags.includes(`ariada-fp-${input.fingerprint}`));
});

test('a task carrying neither the line nor the tag is not a match', () => {
  assert.equal(hasFingerprint({ id: '1' }, 'abc'), false);
  assert.equal(hasFingerprint({ id: '1', description: 'Ariada fingerprint: other' }, 'abc'), false);
});
