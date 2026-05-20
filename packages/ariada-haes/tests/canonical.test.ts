// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { canonicalize } from '../src/canonical.js';

describe('canonicalize (RFC 8785 JCS)', () => {
  it('produces stable byte output regardless of key insertion order', () => {
    const a = canonicalize({ b: 1, a: 2, c: { z: 9, y: 8 } });
    const b = canonicalize({ c: { y: 8, z: 9 }, a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1,"c":{"y":8,"z":9}}');
  });

  it('sorts keys lexicographically (UTF-16 code-unit order)', () => {
    expect(canonicalize({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}');
  });

  it('drops undefined object properties (ECMA-404 conformant)', () => {
    expect(canonicalize({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}');
  });

  it('serialises arrays preserving order; undefined elements become null', () => {
    expect(canonicalize([1, undefined, 'x'])).toBe('[1,null,"x"]');
  });

  it('escapes only the mandatory control characters', () => {
    expect(canonicalize('hello\nworld\t"quote"')).toBe('"hello\\nworld\\t\\"quote\\""');
  });

  it('normalises -0 to 0', () => {
    expect(canonicalize(-0)).toBe('0');
    expect(canonicalize(0)).toBe('0');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize(NaN)).toThrow(TypeError);
    expect(() => canonicalize(Infinity)).toThrow(TypeError);
    expect(() => canonicalize(-Infinity)).toThrow(TypeError);
  });

  it('rejects circular structures', () => {
    const a: Record<string, unknown> = {};
    a['self'] = a;
    expect(() => canonicalize(a)).toThrow(/circular/);
  });

  it('serialises nested objects deterministically', () => {
    const v = {
      outer: { c: [3, 2, 1], a: true, b: null },
      first: 'hello',
    };
    expect(canonicalize(v)).toBe('{"first":"hello","outer":{"a":true,"b":null,"c":[3,2,1]}}');
  });

  it('rejects bigint, function, symbol', () => {
    expect(() => canonicalize(1n)).toThrow(TypeError);
    expect(() => canonicalize(() => 1)).toThrow(TypeError);
    expect(() => canonicalize(Symbol('x'))).toThrow(TypeError);
  });
});
