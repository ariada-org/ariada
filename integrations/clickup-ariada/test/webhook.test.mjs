// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

import { parseWebhook, verifyWebhook } from '../dist/webhook.js';

const secret = 'shhh';
const body = JSON.stringify({ event: 'taskCreated', task_id: '1' });
const sign = (text, key = secret) => createHmac('sha256', key).update(text).digest('hex');

test('a correct signature is accepted and a wrong secret is not', () => {
  assert.equal(verifyWebhook(body, sign(body), secret), true);
  assert.equal(verifyWebhook(body, sign(body, 'other'), secret), false);
});

test('a body changed after signing is refused', () => {
  assert.equal(verifyWebhook(`${body} `, sign(body), secret), false);
});

test('a signature of the wrong length is refused rather than thrown', () => {
  // The comparison primitive raises on a length mismatch, so without the check
  // in front of it a short signature is a crash rather than a refusal.
  for (const bad of ['', 'abc', `${sign(body)}00`]) {
    assert.equal(verifyWebhook(body, bad, secret), false);
  }
});

test('parsing refuses before it parses', () => {
  assert.throws(() => parseWebhook(body, 'nope', secret), /Invalid ClickUp webhook signature/);
  assert.deepEqual(parseWebhook(body, sign(body), secret), { event: 'taskCreated', task_id: '1' });
});
