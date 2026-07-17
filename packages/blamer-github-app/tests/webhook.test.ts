// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

import { createHmac } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import { verifyWebhook } from '../src/webhook.js';

const SECRET = 'top-secret-webhook-key';
const BODY = JSON.stringify({ action: 'opened', number: 7 });

function sign(secret: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

describe('verifyWebhook', () => {
  it('accepts a signature produced with the same secret and body', () => {
    expect(verifyWebhook(SECRET, BODY, sign(SECRET, BODY))).toBe(true);
  });

  it('accepts an upper-case hex signature (case-insensitive)', () => {
    expect(verifyWebhook(SECRET, BODY, sign(SECRET, BODY).toUpperCase())).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyWebhook(SECRET, BODY, sign('wrong-secret', BODY))).toBe(false);
  });

  it('rejects a valid signature over a tampered body', () => {
    const tampered = BODY.replace('opened', 'closed');
    expect(verifyWebhook(SECRET, tampered, sign(SECRET, BODY))).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhook(SECRET, BODY, null)).toBe(false);
    expect(verifyWebhook(SECRET, BODY, undefined)).toBe(false);
    expect(verifyWebhook(SECRET, BODY, '')).toBe(false);
  });

  it('rejects a malformed signature header', () => {
    expect(verifyWebhook(SECRET, BODY, 'not-a-signature')).toBe(false);
    expect(verifyWebhook(SECRET, BODY, 'sha1=abc')).toBe(false);
    expect(verifyWebhook(SECRET, BODY, 'sha256=xyz')).toBe(false); // non-hex / wrong length
  });

  it('rejects when the secret is empty', () => {
    expect(verifyWebhook('', BODY, sign('', BODY))).toBe(false);
  });
});
