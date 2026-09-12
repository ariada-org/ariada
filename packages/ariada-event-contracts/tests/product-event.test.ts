// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What is held here, and why it is mostly refusals.
//
// This package is a validator. Everything downstream of it treats an event that
// got through as trustworthy, which means the only interesting question is what
// it refuses — and that is exactly the half nothing exercised. A validator with
// a happy-path suite is a validator whose refusals are untested: every branch
// that throws could be deleted and the suite would stay green.
//
// So the shape is one case per refusal, plus the boundaries where a refusal
// starts. Good data at a seam checks our belief about the other side; the seam
// itself is checked by what it does not expect.
//
// The two cases worth naming separately, because they are not obvious:
//
//   Optional fields absent must stay ABSENT, not present-and-undefined. The
//   difference is invisible in TypeScript and decisive on the wire: an event
//   serialised with `causationId: undefined` loses the key, while one built by
//   assignment carries it as null in several encoders. These events cross a bus.
//
//   Creating an event validates it. A caller handing in data of the wrong shape
//   should be refused where it happens, not two hops later when a consumer
//   cannot read the field.

import { describe, expect, it } from 'vitest';

import {
  PRODUCT_EVENT_TYPES,
  PRODUCT_EVENT_VERSION,
  assertProductEvent,
  createProductEvent,
  eventSubject,
  parseProductEvent,
  type ProductEvent,
} from '../src/index.js';

/** A minimal event that every refusal case starts from and then spoils. */
function godnoe(): Record<string, unknown> {
  return {
    id: 'e-1',
    type: 'scan.completed',
    version: PRODUCT_EVENT_VERSION,
    occurredAt: '2026-09-07T10:00:00.000Z',
    source: 'scanner',
    tenantId: 't-1',
    correlationId: 'c-1',
    subject: eventSubject('scan.completed'),
    data: { scanId: 's-1', status: 'succeeded' },
  };
}

describe('accepting what is well formed', () => {
  it('lets a complete event through', () => {
    expect(() => assertProductEvent(godnoe())).not.toThrow();
  });

  it('returns the same object it was given, rather than a copy', () => {
    const v = godnoe();
    expect(parseProductEvent(v)).toBe(v);
  });

  it('gives every declared type a subject of its own', () => {
    const subjects = PRODUCT_EVENT_TYPES.map(eventSubject);
    expect(new Set(subjects).size).toBe(PRODUCT_EVENT_TYPES.length);
    for (const s of subjects) expect(s.startsWith('ariada.v1.')).toBe(true);
  });
});

describe('building an event', () => {
  it('fills in what the caller left out', () => {
    const e = createProductEvent('scan.requested', {
      source: 'cli',
      tenantId: 't-1',
      correlationId: 'c-1',
      subject: eventSubject('scan.requested'),
      data: { scanId: 's-1', targets: ['https://example.org'] },
    });
    expect(e.type).toBe('scan.requested');
    expect(e.version).toBe(PRODUCT_EVENT_VERSION);
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(Number.isNaN(Date.parse(e.occurredAt))).toBe(false);
  });

  it('leaves absent optional fields out of the object entirely', () => {
    // Not `toBeUndefined`: that passes for a key present with the value
    // undefined, which is a different thing once the event is serialised.
    const e = createProductEvent('scan.requested', {
      source: 'cli',
      tenantId: 't-1',
      correlationId: 'c-1',
      subject: eventSubject('scan.requested'),
      data: { scanId: 's-1', targets: [] },
    });
    expect(Object.hasOwn(e, 'causationId')).toBe(false);
    expect(Object.hasOwn(e, 'artifactRefs')).toBe(false);
    expect(Object.hasOwn(e, 'trace')).toBe(false);
  });

  it('keeps optional fields that were given', () => {
    const e = createProductEvent('report.emitted', {
      source: 'cli',
      tenantId: 't-1',
      correlationId: 'c-1',
      causationId: 'p-1',
      subject: eventSubject('report.emitted'),
      data: { reportId: 'r-1', format: 'html', artifact: { uri: 'file:///r.html' } },
      trace: { traceId: 'tr-1' },
    });
    expect(e.causationId).toBe('p-1');
    expect(e.trace).toEqual({ traceId: 'tr-1' });
  });

  it('refuses to build an event it would not accept', () => {
    expect(() =>
      createProductEvent('scan.requested', {
        source: 'cli',
        tenantId: 't-1',
        correlationId: 'c-1',
        subject: eventSubject('scan.requested'),
        data: 'not an object' as never,
      }),
    ).toThrow(/data must be an object/);
  });
});

describe('refusing what is malformed', () => {
  it.each([
    ['not an object at all', 'nope', /must be an object/],
    ['an array', [], /must be an object/],
    ['null', null, /must be an object/],
  ])('refuses %s', (_name, value, message) => {
    expect(() => assertProductEvent(value)).toThrow(message);
  });

  it.each(['id', 'source', 'tenantId', 'correlationId', 'subject'])(
    'refuses an empty %s',
    (key) => {
      const v = godnoe();
      v[key] = '';
      expect(() => assertProductEvent(v)).toThrow(new RegExp(key));
    },
  );

  it.each(['id', 'source', 'tenantId', 'correlationId', 'subject'])(
    'refuses a %s that is not a string',
    (key) => {
      const v = godnoe();
      v[key] = 42;
      expect(() => assertProductEvent(v)).toThrow(new RegExp(key));
    },
  );

  it('refuses a causationId that is present and malformed, but not one that is absent', () => {
    const bez = godnoe();
    expect(() => assertProductEvent(bez)).not.toThrow();
    const s = godnoe();
    s['causationId'] = '';
    expect(() => assertProductEvent(s)).toThrow(/causationId/);
  });

  it('refuses another version', () => {
    const v = godnoe();
    v['version'] = PRODUCT_EVENT_VERSION + 1;
    expect(() => assertProductEvent(v)).toThrow(/unsupported event version/);
  });

  it('refuses a type nobody declared', () => {
    const v = godnoe();
    v['type'] = 'scan.imagined';
    expect(() => assertProductEvent(v)).toThrow(/unsupported event type/);
  });

  it.each([
    ['a date that is not one', 'the day before yesterday'],
    ['a number where a date-time belongs', 1_757_000_000_000],
  ])('refuses %s as occurredAt', (_name, value) => {
    const v = godnoe();
    v['occurredAt'] = value;
    expect(() => assertProductEvent(v)).toThrow(/occurredAt/);
  });

  it('refuses data that is not an object', () => {
    const v = godnoe();
    v['data'] = 'succeeded';
    expect(() => assertProductEvent(v)).toThrow(/data must be an object/);
  });
});

describe('the length boundary', () => {
  it('accepts an id of exactly the permitted length and refuses one character more', () => {
    const na_grani = godnoe();
    na_grani['id'] = 'x'.repeat(128);
    expect(() => assertProductEvent(na_grani)).not.toThrow();

    const za_granyu = godnoe();
    za_granyu['id'] = 'x'.repeat(129);
    expect(() => assertProductEvent(za_granyu)).toThrow(/id/);
  });

  it('gives the subject its own, longer limit', () => {
    // The limits differ on purpose; a single shared limit would have passed a
    // test written against either one of them.
    const dlinnyy = godnoe();
    dlinnyy['subject'] = 'x'.repeat(512);
    expect(() => assertProductEvent(dlinnyy)).not.toThrow();

    const slishkom = godnoe();
    slishkom['subject'] = 'x'.repeat(513);
    expect(() => assertProductEvent(slishkom)).toThrow(/subject/);
  });
});

describe('artifact references', () => {
  function s_artefaktom(artifact: unknown): Record<string, unknown> {
    const v = godnoe();
    v['artifactRefs'] = [artifact];
    return v;
  }

  it('accepts a reference with only a location', () => {
    expect(() => assertProductEvent(s_artefaktom({ uri: 'file:///r.html' }))).not.toThrow();
  });

  it('refuses artifactRefs that is not an array', () => {
    const v = godnoe();
    v['artifactRefs'] = { uri: 'file:///r.html' };
    expect(() => assertProductEvent(v)).toThrow(/artifactRefs must be an array/);
  });

  it.each([
    ['a reference that is not an object', 'file:///r.html', /artifact reference must be an object/],
    ['a reference with no location', {}, /uri/],
    ['a digest of the wrong length', { uri: 'u', sha256: 'abc' }, /sha256/],
    ['a digest that is not hexadecimal', { uri: 'u', sha256: 'z'.repeat(64) }, /sha256/],
    ['a fractional size', { uri: 'u', sizeBytes: 1.5 }, /sizeBytes/],
    ['a negative size', { uri: 'u', sizeBytes: -1 }, /sizeBytes/],
  ])('refuses %s', (_name, artifact, message) => {
    expect(() => assertProductEvent(s_artefaktom(artifact))).toThrow(message);
  });

  it('accepts a digest in either case, and a size of zero', () => {
    const verkhniy = 'A'.repeat(64);
    expect(() => assertProductEvent(s_artefaktom({ uri: 'u', sha256: verkhniy }))).not.toThrow();
    expect(() => assertProductEvent(s_artefaktom({ uri: 'u', sizeBytes: 0 }))).not.toThrow();
  });

  it('checks every reference, not only the first', () => {
    const v = godnoe();
    v['artifactRefs'] = [{ uri: 'good' }, { uri: 'also good' }, { uri: '' }];
    expect(() => assertProductEvent(v)).toThrow(/uri/);
  });
});

describe('what the type says and what the check does', () => {
  it('narrows to a product event after asserting', () => {
    const v: unknown = godnoe();
    assertProductEvent(v);
    const e: ProductEvent = v;
    expect(e.type).toBe('scan.completed');
  });
});
