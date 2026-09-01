import { startFixtureServer, type FixtureServer } from '@ariada-org/test-fixtures';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createEventEmitter, scanEventSchema, type ScanEvent } from '../../src/events.js';
import { scan } from '../../src/index.js';

let fx: FixtureServer;

beforeAll(async () => {
  fx = await startFixtureServer();
});

afterAll(async () => {
  await fx?.stop();
});

describe('scan() — elementIter mode emits locked ScanEvent stream', () => {
  it('emits scan_started → element_scan* → scan_complete, each zod-valid', async () => {
    const emitter = createEventEmitter();
    const received: ScanEvent[] = [];
    emitter.on((e) => received.push(e));

    const { events } = await scan(`${fx.url}/mixed-severity.html`, {
      playwright: { browser: 'chromium', headless: true },
      elementIter: true,
      emitter,
    });

    expect(events).toBeDefined();
    expect(events!.length).toBe(received.length);

    const first = received[0];
    expect(first?.kind).toBe('scan_started');

    const last = received[received.length - 1];
    expect(last?.kind).toBe('scan_complete');

    const elemEvents = received.filter((e) => e.kind === 'element_scan');
    expect(elemEvents.length).toBeGreaterThan(0);
    for (const ev of received) {
      const parsed = scanEventSchema.safeParse(ev);
      expect(parsed.success).toBe(true);
    }

    const seen = new Set<number>();
    for (const ev of elemEvents) {
      if (ev.kind !== 'element_scan') continue;
      expect(seen.has(ev.seq)).toBe(false);
      seen.add(ev.seq);
    }
  }, 90_000);
});
