// SPDX-License-Identifier: EUPL-1.2
//
// RFC 8785 JSON Canonicalization Scheme (JCS) — minimal implementation.
//
// Why: the chain's hash determinism across implementations depends on a
// canonical byte sequence regardless of map ordering or whitespace. RFC 8785
// defines that canonical form. We implement a JSON subset sufficient for
// HAES entries (objects, arrays, strings, numbers, booleans, null) without
// pulling a runtime dependency.
//
// Restrictions enforced (rejected with TypeError):
//   - non-finite numbers (NaN, +/-Infinity)
//   - undefined values inside arrays (top-level / object undefined keys are
//     dropped per ECMA-404)
//   - circular structures (caught by the host JSON engine indirectly; we
//     also explicitly detect via a seen-set)
//   - functions, symbols, bigints (out of scope for evidence payloads)

const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER;

/**
 * Canonicalize a JSON-compatible value per RFC 8785. Returns a UTF-8 string.
 * Throws TypeError if the input cannot be canonicalized deterministically.
 */
export function canonicalize(value: unknown): string {
  return encode(value, new Set());
}

function encode(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null';
  if (value === undefined) {
    throw new TypeError('JCS: undefined is not a valid JSON value');
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return encodeNumber(value);
    case 'string':
      return encodeString(value);
    case 'object':
      if (Array.isArray(value)) return encodeArray(value, seen);
      return encodeObject(value as Record<string, unknown>, seen);
    case 'bigint':
      throw new TypeError('JCS: bigint is not supported');
    case 'function':
    case 'symbol':
    case 'undefined':
      throw new TypeError(`JCS: unsupported value type: ${typeof value}`);
  }
  /* c8 ignore next */
  throw new TypeError(`JCS: unreachable value type: ${typeof value}`);
}

function encodeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new TypeError(`JCS: non-finite number (${String(n)})`);
  }
  if (Number.isInteger(n) && Math.abs(n) <= MAX_SAFE_INT) {
    // Normalise -0 → 0 to keep canonical form deterministic.
    return Object.is(n, -0) ? '0' : n.toFixed(0);
  }
  // RFC 8785 §3.2.2.3: use ECMA-262 7.1.12.1 ToString for non-integer numbers.
  // Node's default `Number.prototype.toString()` already implements that rule.
  return n.toString();
}

function encodeString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // Per RFC 8785 §3.2.2.2 — escape only the mandatory set.
    if (c === 0x22) {
      out += '\\"';
    } else if (c === 0x5c) {
      out += '\\\\';
    } else if (c === 0x08) {
      out += '\\b';
    } else if (c === 0x09) {
      out += '\\t';
    } else if (c === 0x0a) {
      out += '\\n';
    } else if (c === 0x0c) {
      out += '\\f';
    } else if (c === 0x0d) {
      out += '\\r';
    } else if (c < 0x20) {
      out += `\\u${c.toString(16).padStart(4, '0')}`;
    } else {
      // Pass through the raw code unit. RFC 8785 forbids \uXXXX escapes for
      // characters >= U+0020 except the mandatory ones above; surrogate
      // pairs are preserved verbatim.
      out += s[i];
    }
  }
  out += '"';
  return out;
}

function encodeArray(arr: ReadonlyArray<unknown>, seen: Set<object>): string {
  if (seen.has(arr)) throw new TypeError('JCS: circular structure detected');
  seen.add(arr);
  try {
    const parts: string[] = [];
    for (const item of arr) {
      // Per ECMA-404, `undefined` array elements become `null` in JSON.
      parts.push(item === undefined ? 'null' : encode(item, seen));
    }
    return '[' + parts.join(',') + ']';
  } finally {
    seen.delete(arr);
  }
}

function encodeObject(obj: Record<string, unknown>, seen: Set<object>): string {
  if (seen.has(obj)) throw new TypeError('JCS: circular structure detected');
  seen.add(obj);
  try {
    // HAES evidence chains depend on byte-identical canonical form across
    // independent implementations; locale-aware sort moves '$' / '_' keys
    // relative to alphanumerics and would corrupt the chain hash.
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      // NOSONAR(typescript:S2871,typescript:S7768): RFC 8785 §3.2.3 requires UTF-16 code-unit order; localeCompare forbidden.
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const k of keys) {
      parts.push(encodeString(k) + ':' + encode(obj[k], seen));
    }
    return '{' + parts.join(',') + '}';
  } finally {
    seen.delete(obj);
  }
}
