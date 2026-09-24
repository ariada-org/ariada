// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Three things live in this package and each is held differently.
//
// The parser is a validator, and validators are held by their refusals: what
// they let through is treated as true by everything downstream, so every branch
// that throws is a branch that could be deleted with a happy-path suite staying
// green. Its cross-checks matter more than its shapes — a summary that
// disagrees with the findings it summarises is the kind of report that reads as
// authoritative and is not.
//
// The metrics and the span are recorders, and a recorder is held by what it
// actually emitted. Both are given a stand-in that writes down every call, so
// the assertions are about the calls rather than about the absence of an
// exception. A recorder that quietly emits nothing raises nothing either.
//
// The instrument cache is worth its own case: instruments are created once per
// meter and kept in a weak map, so a second scan through the same meter must
// not create a second counter. That is invisible in any single run and shows up
// as duplicate series in whatever collects them.

import { SpanStatusCode, type Meter, type Tracer } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';

import {
  ARIADA_CLI_SCAN_SCHEMA,
  ARIADA_METRIC_NAMES,
  ARIADA_SCAN_EVENT_NAME,
  ARIADA_SCAN_SPAN_NAME,
  AriadaScanParseError,
  parseAriadaScanResult,
  recordAriadaScan,
} from '../src/index.js';

// Taken from the package rather than written out. A literal here would be a
// second copy of the value the parser compares against, and the two would part
// company silently the day the schema is versioned.
const SCHEMA = ARIADA_CLI_SCAN_SCHEMA;

/** A scan that passes every check, which each case below then spoils in one way. */
function validScan(): Record<string, unknown> {
  return {
    $schema: SCHEMA,
    url: 'https://example.org/',
    summary: {
      total: 2,
      byImpact: { critical: 1, serious: 1, moderate: 0, minor: 0 },
    },
    report: {
      findings: [
        { ruleId: 'color-contrast', severity: 'critical', message: 'too low' },
        { ruleId: 'image-alt', severity: 'serious', message: 'missing' },
      ],
    },
    exitCode: 1,
  };
}

/** A meter that records every instrument created and every value recorded. */
function fakeMeter() {
  const createdInstruments: string[] = [];
  const recordedValues: { instrument: string; value: number; attrs: unknown }[] = [];
  const instrument = (name: string) => ({
    add: (v: number, a: unknown) => void recordedValues.push({ instrument: name, value: v, attrs: a }),
    record: (v: number, a: unknown) => void recordedValues.push({ instrument: name, value: v, attrs: a }),
  });
  const meter = {
    createCounter: (n: string) => (createdInstruments.push(n), instrument(n)),
    createGauge: (n: string) => (createdInstruments.push(n), instrument(n)),
    createHistogram: (n: string) => (createdInstruments.push(n), instrument(n)),
    createUpDownCounter: (n: string) => (createdInstruments.push(n), instrument(n)),
    createObservableCounter: () => undefined,
    createObservableGauge: () => undefined,
    createObservableUpDownCounter: () => undefined,
    addBatchObservableCallback: () => undefined,
    removeBatchObservableCallback: () => undefined,
  } as unknown as Meter;
  return { meter, createdInstruments, recordedValues };
}

/** A tracer that records the span it was asked for and everything done to it. */
function fakeTracer() {
  const startedSpans: { name: string; options: unknown }[] = [];
  const statuses: unknown[] = [];
  // `time?: number | undefined` and not `time?: number`: under
  // exactOptionalPropertyTypes those are different types, and the tracer hands
  // an explicit undefined when the payload said nothing about timing.
  const events: { name: string; attrs: unknown; time?: number | undefined }[] = [];
  const endedCount: (number | undefined)[] = [];
  const tracer = {
    startSpan: (name: string, options: unknown) => {
      startedSpans.push({ name, options });
      return {
        setStatus: (s: unknown) => void statuses.push(s),
        addEvent: (n: string, a: unknown, t?: number) => void events.push({ name: n, attrs: a, time: t }),
        end: (t?: number) => void endedCount.push(t),
        setAttribute: () => undefined,
        setAttributes: () => undefined,
        recordException: () => undefined,
        updateName: () => undefined,
        isRecording: () => true,
        spanContext: () => ({ traceId: '0', spanId: '0', traceFlags: 0 }),
      };
    },
    startActiveSpan: () => undefined,
  } as unknown as Tracer;
  return { tracer, startedSpans, statuses, events, endedCount };
}

describe('the parser accepts a well-formed scan', () => {
  it('reads it, and derives what the payload does not state', () => {
    const scan = parseAriadaScanResult(validScan());
    expect(scan.url).toBe('https://example.org/');
    expect(scan.findings).toHaveLength(2);
    expect(scan.gate).toBe('fail'); // exit code 1
    expect(scan.score).toBe(0); // the worst finding is critical
  });

  it('accepts the same payload as JSON text', () => {
    expect(parseAriadaScanResult(JSON.stringify(validScan())).findings).toHaveLength(2);
  });

  it('scores a clean scan at one and calls the gate a pass', () => {
    const cleanScan = {
      ...validScan(),
      summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
      report: { findings: [] },
      exitCode: 0,
    };
    const scan = parseAriadaScanResult(cleanScan);
    expect(scan.score).toBe(1);
    expect(scan.gate).toBe('pass');
  });

  it('reads findings grouped by domain and carries the domain onto each', () => {
    const byDomain = {
      ...validScan(),
      report: {
        findings: {
          'example.org': [{ ruleId: 'color-contrast', severity: 'critical', message: 'too low' }],
          'shop.example.org': [{ ruleId: 'image-alt', severity: 'serious', message: 'missing' }],
        },
      },
    };
    const scan = parseAriadaScanResult(byDomain);
    expect(scan.findings.map((f) => f.domain)).toEqual(['example.org', 'shop.example.org']);
  });
});

describe('the parser refuses, and says where', () => {
  it.each([
    ['empty JSON text', '', /must not be empty/],
    ['text that is not JSON', '{oops', /must be valid JSON/],
    ['a value that is not an object', 42, /must be an object/],
    ['an array', [], /must be an object/],
  ])('refuses %s', (_name, input, message) => {
    expect(() => parseAriadaScanResult(input)).toThrow(message);
  });

  it('refuses another schema, and names the field', () => {
    expect(() => parseAriadaScanResult({ ...validScan(), $schema: 'other' })).toThrow(
      /\$\.\$schema/,
    );
  });

  it.each([
    ['not a URL at all', 'example.org'],
    ['another scheme', 'ftp://example.org/'],
    ['an empty string', ''],
  ])('refuses a location that is %s', (_name, url) => {
    expect(() => parseAriadaScanResult({ ...validScan(), url })).toThrow(/\$\.url/);
  });

  it('refuses an impact it does not know', () => {
    const foreignScan = validScan();
    (foreignScan['report'] as { findings: { severity: string }[] }).findings[0]!.severity = 'annoying';
    expect(() => parseAriadaScanResult(foreignScan)).toThrow(/severity/);
  });

  it('refuses an exit code that is neither pass nor violations', () => {
    expect(() => parseAriadaScanResult({ ...validScan(), exitCode: 2 })).toThrow(/exitCode/);
  });

  it('throws an error that carries the path as data, not only in the message', () => {
    // So a caller can act on where the payload is wrong without parsing prose.
    try {
      parseAriadaScanResult({ ...validScan(), exitCode: 2 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AriadaScanParseError);
      expect((error as AriadaScanParseError).path).toBe('$.exitCode');
    }
  });
});

describe('the cross-checks, which are the reason this parser exists', () => {
  // A payload can be well-shaped in every field and still describe itself
  // wrongly. Those are the reports that read as authoritative and are not.
  it('refuses a total that disagrees with the findings it counts', () => {
    const lyingScan = validScan();
    (lyingScan['summary'] as { total: number }).total = 3;
    expect(() => parseAriadaScanResult(lyingScan)).toThrow(/summary\.total/);
  });

  it('refuses a per-impact count that disagrees with the findings', () => {
    const lyingScan = validScan();
    (lyingScan['summary'] as { byImpact: Record<string, number> }).byImpact['critical'] = 2;
    (lyingScan['summary'] as { byImpact: Record<string, number> }).byImpact['serious'] = 0;
    expect(() => parseAriadaScanResult(lyingScan)).toThrow(/byImpact\.critical/);
  });

  it('refuses a report pointing at a different page than the scan', () => {
    const lyingScan = validScan();
    (lyingScan['report'] as Record<string, unknown>)['url'] = 'https://elsewhere.example/';
    expect(() => parseAriadaScanResult(lyingScan)).toThrow(/report\.url/);
  });

  it('refuses two identifiers that disagree about the same scan', () => {
    const lyingScan: Record<string, unknown> = { ...validScan(), scanId: 'a' };
    (lyingScan['report'] as Record<string, unknown>)['scanId'] = 'b';
    expect(() => parseAriadaScanResult(lyingScan)).toThrow(/report\.scanId/);
  });

  it('refuses a completion that precedes its start', () => {
    const lyingScan = {
      ...validScan(),
      startedAt: '2026-09-07T10:00:00.000Z',
      completedAt: '2026-09-07T09:00:00.000Z',
    };
    expect(() => parseAriadaScanResult(lyingScan)).toThrow(/completedAt/);
  });

  it('refuses a duration that disagrees with its own interval', () => {
    const lyingScan = {
      ...validScan(),
      startedAt: '2026-09-07T10:00:00.000Z',
      completedAt: '2026-09-07T10:00:05.000Z',
      durationMs: 9_000,
    };
    expect(() => parseAriadaScanResult(lyingScan)).toThrow(/durationMs/);
  });

  it('accepts a duration that agrees with it', () => {
    const scan = parseAriadaScanResult({
      ...validScan(),
      startedAt: '2026-09-07T10:00:00.000Z',
      completedAt: '2026-09-07T10:00:05.000Z',
      durationMs: 5_000,
    });
    expect(scan.durationMs).toBe(5_000);
  });
});

describe('what is actually emitted', () => {
  it('creates every instrument once and records the scan through them', () => {
    const { meter, createdInstruments, recordedValues } = fakeMeter();
    const { tracer } = fakeTracer();
    recordAriadaScan(validScan(), meter, tracer);

    expect(new Set(createdInstruments)).toEqual(new Set(Object.values(ARIADA_METRIC_NAMES)));
    const instrumentNames = recordedValues.map((z) => z.instrument);
    expect(instrumentNames).toContain(ARIADA_METRIC_NAMES.violations);
    expect(instrumentNames).toContain(ARIADA_METRIC_NAMES.score);
    expect(instrumentNames).toContain(ARIADA_METRIC_NAMES.gate);
  });

  it('does not create a second set of instruments for the same meter', () => {
    // Invisible in one run, and duplicate series in whatever collects them.
    const { meter, createdInstruments } = fakeMeter();
    const { tracer } = fakeTracer();
    recordAriadaScan(validScan(), meter, tracer);
    const afterFirst = createdInstruments.length;
    recordAriadaScan(validScan(), meter, tracer);
    expect(createdInstruments).toHaveLength(afterFirst);
  });

  it('counts violations by rule and impact, not one per finding', () => {
    const { meter, recordedValues } = fakeMeter();
    const { tracer } = fakeTracer();
    const repeats = {
      ...validScan(),
      summary: { total: 3, byImpact: { critical: 3, serious: 0, moderate: 0, minor: 0 } },
      report: {
        findings: [
          { ruleId: 'color-contrast', severity: 'critical', message: 'a' },
          { ruleId: 'color-contrast', severity: 'critical', message: 'b' },
          { ruleId: 'image-alt', severity: 'critical', message: 'c' },
        ],
      },
    };
    recordAriadaScan(repeats, meter, tracer);
    const violationWrites = recordedValues.filter((z) => z.instrument === ARIADA_METRIC_NAMES.violations);
    expect(violationWrites).toHaveLength(2);
    expect(violationWrites.map((z) => z.value).sort((first, second) => first - second)).toEqual([1, 2]);
  });

  it('records no duration when the payload states none', () => {
    const { meter, recordedValues } = fakeMeter();
    const { tracer } = fakeTracer();
    recordAriadaScan(validScan(), meter, tracer);
    expect(recordedValues.some((z) => z.instrument === ARIADA_METRIC_NAMES.duration)).toBe(false);
  });

  it('records the timestamp in seconds, not milliseconds', () => {
    const { meter, recordedValues } = fakeMeter();
    const { tracer } = fakeTracer();
    recordAriadaScan(
      { ...validScan(), completedAt: '2026-09-07T10:00:00.000Z' },
      meter,
      tracer,
    );
    const stamp = recordedValues.find((z) => z.instrument === ARIADA_METRIC_NAMES.timestamp);
    expect(stamp?.value).toBe(Date.parse('2026-09-07T10:00:00.000Z') / 1_000);
  });
});

describe('the span', () => {
  it('is named, attributed, ended, and marked failed when the gate failed', () => {
    const { meter } = fakeMeter();
    const { tracer, startedSpans, statuses, events, endedCount } = fakeTracer();
    recordAriadaScan(validScan(), meter, tracer);

    expect(startedSpans[0]?.name).toBe(ARIADA_SCAN_SPAN_NAME);
    expect(events[0]?.name).toBe(ARIADA_SCAN_EVENT_NAME);
    expect(endedCount).toHaveLength(1);
    expect(statuses[0]).toMatchObject({ code: SpanStatusCode.ERROR });
    const attrs = (startedSpans[0]?.options as { attributes: Record<string, unknown> }).attributes;
    expect(attrs['ariada.scan.url']).toBe('https://example.org/');
    expect(attrs['ariada.gate.passed']).toBe(false);
  });

  it('marks a passing gate as such', () => {
    const { meter } = fakeMeter();
    const { tracer, statuses } = fakeTracer();
    recordAriadaScan(
      {
        ...validScan(),
        summary: { total: 0, byImpact: { critical: 0, serious: 0, moderate: 0, minor: 0 } },
        report: { findings: [] },
        exitCode: 0,
      },
      meter,
      tracer,
    );
    expect(statuses[0]).toMatchObject({ code: SpanStatusCode.OK });
  });

  it('backdates the span to the scan when the payload says when it happened', () => {
    // Otherwise a scan that ran an hour ago appears in the trace as happening
    // at the moment the exporter was told about it, which is the wrong hour on
    // every dashboard that reads it.
    const { meter } = fakeMeter();
    const { tracer, startedSpans, endedCount } = fakeTracer();
    recordAriadaScan(
      {
        ...validScan(),
        startedAt: '2026-09-07T10:00:00.000Z',
        completedAt: '2026-09-07T10:00:05.000Z',
      },
      meter,
      tracer,
    );
    const options = startedSpans[0]?.options as { startTime?: number };
    expect(options.startTime).toBe(Date.parse('2026-09-07T10:00:00.000Z'));
    expect(endedCount[0]).toBe(Date.parse('2026-09-07T10:00:05.000Z'));
  });

  it('leaves the timing to the tracer when the payload says nothing about it', () => {
    const { meter } = fakeMeter();
    const { tracer, startedSpans, endedCount } = fakeTracer();
    recordAriadaScan(validScan(), meter, tracer);
    expect(Object.hasOwn(startedSpans[0]?.options as object, 'startTime')).toBe(false);
    expect(endedCount[0]).toBeUndefined();
  });
});
