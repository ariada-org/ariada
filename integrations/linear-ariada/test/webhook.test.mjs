// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The signature check is the only thing standing between a webhook endpoint and
// anybody who knows its address. Two properties matter and one of them is not
// about cryptography: the comparison must be constant-time, and it must not
// throw on a signature of the wrong length, because the primitive that does the
// comparing raises rather than returning false when the lengths differ.

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';

import { parseWebhook, verifyWebhook } from '../dist/webhook.js';

const secret = 'shhh';
const body = JSON.stringify({ action: 'create', data: { id: '1' } });
const sign = (text, key = secret) => createHmac('sha256', key).update(text).digest('hex');

test('a correct signature is accepted, with or without the prefix', () => {
  assert.equal(verifyWebhook(body, sign(body), secret), true);
  assert.equal(verifyWebhook(body, `sha256=${sign(body)}`, secret), true);
});

test('a signature from another secret is refused', () => {
  assert.equal(verifyWebhook(body, sign(body, 'other'), secret), false);
});

test('a body changed after signing is refused', () => {
  assert.equal(verifyWebhook(`${body} `, sign(body), secret), false);
});

test('a signature of the wrong length is refused rather than thrown', () => {
  // The comparison primitive raises on a length mismatch. Without the length
  // check in front of it, a short signature is a crash rather than a refusal.
  for (const bad of ['', 'abc', `${sign(body)}00`]) {
    assert.equal(verifyWebhook(body, bad, secret), false);
  }
});

test('parsing refuses before it parses', () => {
  assert.throws(() => parseWebhook(body, 'nope', secret), /Invalid Linear webhook signature/);
  assert.deepEqual(parseWebhook(body, sign(body), secret), { action: 'create', data: { id: '1' } });
});
