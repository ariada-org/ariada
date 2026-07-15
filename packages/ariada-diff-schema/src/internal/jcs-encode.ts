// SPDX-License-Identifier: EUPL-1.2
//
// RFC 8785 JSON Canonicalization Scheme (JCS) — minimal implementation.
// Zero runtime dependencies. Matches the JCS implementation pattern
// used elsewhere in the workspace.

const MAX_SAFE_INT = Number.MAX_SAFE_INTEGER;

/**
 * Canonicalize a JSON-compatible value per RFC 8785. Returns a UTF-8 string.
 * Throws TypeError on non-finite numbers, circular structures, bigints,
 * functions, or symbols.
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
    return Object.is(n, -0) ? '0' : n.toFixed(0);
  }
  return n.toString();
}

function encodeString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22) out += '\\"';
    else if (c === 0x5c) out += '\\\\';
    else if (c === 0x08) out += '\\b';
    else if (c === 0x09) out += '\\t';
    else if (c === 0x0a) out += '\\n';
    else if (c === 0x0c) out += '\\f';
    else if (c === 0x0d) out += '\\r';
    else if (c < 0x20) out += `\\u${c.toString(16).padStart(4, '0')}`;
    else out += s[i];
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
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const parts: string[] = [];
    for (const k of keys) {
      parts.push(encodeString(k) + ':' + encode(obj[k], seen));
    }
    return '{' + parts.join(',') + '}';
  } finally {
    seen.delete(obj);
  }
}
