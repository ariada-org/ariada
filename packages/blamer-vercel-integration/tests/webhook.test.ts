// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE

import { createHmac } from 'node:crypto';

import { describe, it, expect } from 'vitest';

import { verifyWebhook } from '../src/webhook.js';

const SECRET = 'vercel-client-secret';
const BODY = JSON.stringify({ type: 'deployment.succeeded', payload: {} });

function sign(secret: string, body: string): string {
  return createHmac('sha1', secret).update(body, 'utf8').digest('hex');
}

describe('verifyWebhook (Vercel)', () => {
  it('accepts a signature produced with the same secret and body', () => {
    expect(verifyWebhook(SECRET, BODY, sign(SECRET, BODY))).toBe(true);
  });

  it('accepts an upper-case hex signature (case-insensitive)', () => {
    expect(verifyWebhook(SECRET, BODY, sign(SECRET, BODY).toUpperCase())).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyWebhook(SECRET, BODY, sign('other-secret', BODY))).toBe(false);
  });

  it('rejects a valid signature over a tampered body', () => {
    const tampered = BODY.replace('succeeded', 'failed');
    expect(verifyWebhook(SECRET, tampered, sign(SECRET, BODY))).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhook(SECRET, BODY, null)).toBe(false);
    expect(verifyWebhook(SECRET, BODY, undefined)).toBe(false);
    expect(verifyWebhook(SECRET, BODY, '')).toBe(false);
  });

  it('rejects a malformed signature (wrong length / non-hex)', () => {
    expect(verifyWebhook(SECRET, BODY, 'zzzz')).toBe(false);
    expect(verifyWebhook(SECRET, BODY, 'sha1=' + sign(SECRET, BODY))).toBe(false);
  });

  it('rejects when the secret is empty', () => {
    expect(verifyWebhook('', BODY, sign('', BODY))).toBe(false);
  });
});
