import { describe, it, expect } from 'vitest';

import { signBody, verifySignature, hashIp } from '../src/auth.js';

describe('signBody / verifySignature', () => {
  it('produces a stable hex signature', () => {
    const sig = signBody('secret', 'hello');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signBody('secret', 'hello')).toBe(sig);
  });

  it('verifies a valid signature', () => {
    const body = '{"a":1}';
    const sig = signBody('s', body);
    expect(verifySignature('s', body, `HMAC-SHA256 v1:${sig}`)).toBe(true);
  });

  it('rejects wrong secret', () => {
    const sig = signBody('s', 'x');
    expect(verifySignature('other', 'x', `HMAC-SHA256 v1:${sig}`)).toBe(false);
  });

  it('rejects tampered body', () => {
    const sig = signBody('s', 'x');
    expect(verifySignature('s', 'y', `HMAC-SHA256 v1:${sig}`)).toBe(false);
  });

  it('rejects missing or malformed header', () => {
    expect(verifySignature('s', 'x', null)).toBe(false);
    expect(verifySignature('s', 'x', 'Bearer abc')).toBe(false);
  });
});

describe('hashIp', () => {
  it('different ips → different hashes', () => {
    expect(hashIp('1.2.3.4', 'salt')).not.toBe(hashIp('1.2.3.5', 'salt'));
  });
  it('different salts → different hashes', () => {
    expect(hashIp('1.2.3.4', 'a')).not.toBe(hashIp('1.2.3.4', 'b'));
  });
  it('same input → same hash', () => {
    expect(hashIp('1.2.3.4', 's')).toBe(hashIp('1.2.3.4', 's'));
  });
});
