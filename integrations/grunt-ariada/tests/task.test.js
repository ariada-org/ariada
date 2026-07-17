// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { registerAriadaTask } from '../tasks/ariada.js';

test('registers a grunt multi-task and fails on findings', async () => {
  let task;
  let failed = '';
  const grunt = {
    registerMultiTask(_name, _description, callback) {
      task = callback;
    },
    file: { read: () => '<input>' },
    fail: { warn: (message) => { failed = message; } },
  };
  registerAriadaTask(grunt, () => [{ ruleId: 'form-field-name', severity: 'serious', message: 'Input needs a name.' }]);

  await new Promise((resolve, reject) => {
    task.call({
      filesSrc: ['index.html'],
      options: () => ({ failOnFindings: true }),
      async: () => (error) => (error ? reject(error) : resolve()),
    });
  });

  assert.match(failed, /1 finding/);
});
