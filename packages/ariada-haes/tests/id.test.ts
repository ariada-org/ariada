// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { decodeUlidTimestamp, encodeRandom, encodeTime, nowRfc3339, ulid } from '../src/id.js';

describe('ULID-style identifier helpers', () => {
  it('encodeTime produces 10 Crockford characters', () => {
    expect(encodeTime(0)).toBe('0000000000');
    expect(encodeTime(1).length).toBe(10);
  });

  it('encodes timestamps in lexicographic-sortable order', () => {
    const a = encodeTime(1000);
    const b = encodeTime(2000);
    expect(a < b).toBe(true);
  });

  it('round-trips timestamp via encode + decode', () => {
    const t = 1_700_000_000_000;
    expect(decodeUlidTimestamp(encodeTime(t))).toBe(t);
  });

  it('rejects negative or non-finite timestamps', () => {
    expect(() => ulid(-1)).toThrow(RangeError);
    expect(() => ulid(NaN)).toThrow(RangeError);
  });

  it('encodeRandom rejects wrong-length inputs', () => {
    expect(() => encodeRandom(new Uint8Array(9))).toThrow(RangeError);
    expect(() => encodeRandom(new Uint8Array(11))).toThrow(RangeError);
  });

  it('ulid produces 26 characters', () => {
    const id = ulid(1_700_000_000_000);
    expect(id.length).toBe(26);
  });

  it('two ulids generated at the same ms are distinct (random suffix)', () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_000);
    expect(a).not.toBe(b);
  });

  it('nowRfc3339 emits a parseable ISO 8601 UTC timestamp', () => {
    const s = nowRfc3339();
    expect(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)).toBe(true);
    expect(Number.isNaN(Date.parse(s))).toBe(false);
  });
});
