// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { verifyVercelSignature } from '../dist/src/signature.js';

const secret = 'test-integration-secret';
const body = JSON.stringify({ type: 'deployment.ready', deployment: { id: 'dpl_1', url: 'x.vercel.app' } });

function sign(payload, key) {
  return createHmac('sha1', key).update(payload).digest('hex');
}

test('accepts a signature computed with the correct secret', () => {
  const signature = sign(body, secret);
  assert.equal(verifyVercelSignature(body, signature, secret), true);
});

test('rejects a signature computed with the wrong secret', () => {
  const signature = sign(body, 'wrong-secret');
  assert.equal(verifyVercelSignature(body, signature, secret), false);
});

test('rejects a tampered body even if a signature header is present', () => {
  const signature = sign(body, secret);
  const tampered = body.replace('dpl_1', 'dpl_evil');
  assert.equal(verifyVercelSignature(tampered, signature, secret), false);
});

test('rejects a missing signature header', () => {
  assert.equal(verifyVercelSignature(body, undefined, secret), false);
});

test('rejects a malformed (non-hex) signature header without throwing', () => {
  assert.equal(verifyVercelSignature(body, 'not-a-hex-signature', secret), false);
});
