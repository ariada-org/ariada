// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// What is worth holding in a package of adapters.
//
// Nothing here computes anything. Every class is a seam: between a caller and a
// bus, a caller and an HTTP endpoint, a caller and a file. Seams are held by
// what crosses them and by what happens when the other side misbehaves — good
// data proves only our belief about the other side, never the seam.
//
// So: the address the HTTP publisher actually calls (assembled from a caller's
// string, which is where a trailing slash quietly becomes a double one), the
// headers it sends, what it does with a refusal, and what it does with a reply
// that is not the shape it promised its caller. The fan-out is held by which
// receipt it picks and by what happens when one of its publishers throws — a
// distinction invisible until it matters. The in-memory bus is held by its
// filter, including the empty filter, which reads as "no filter" to the eye and
// means "nothing" to the code.

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createProductEvent, eventSubject, type ProductEvent } from '@ariada-org/event-contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  FanoutEventPublisher,
  HttpEventPublisher,
  InMemoryEventBus,
  NoopEventPublisher,
  type EventPublisher,
  type PublishReceipt,
} from '../src/index.js';
import { JsonlEventPublisher } from '../src/node.js';

function sobytie(type: 'scan.requested' | 'scan.completed' = 'scan.requested'): ProductEvent {
  return createProductEvent(type, {
    source: 'test',
    tenantId: 't-1',
    correlationId: 'c-1',
    subject: eventSubject(type),
    data:
      type === 'scan.requested'
        ? { scanId: 's-1', targets: ['https://example.org'] }
        : { scanId: 's-1', status: 'succeeded' },
  }) as ProductEvent;
}

/** A fetch that records what it was called with and answers as told. */
function poddelnyy_fetch(otvet: { ok: boolean; status: number; body: unknown }) {
  const zvonki: { url: string; init: RequestInit }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    zvonki.push({ url: String(url), init: init ?? {} });
    return {
      ok: otvet.ok,
      status: otvet.status,
      json: async () => otvet.body,
    } as unknown as Response;
  });
  return { f: f as unknown as typeof globalThis.fetch, zvonki };
}

describe('the publisher that does nothing', () => {
  it('says it skipped, and names the event it skipped', async () => {
    const e = sobytie();
    await expect(new NoopEventPublisher().publish(e)).resolves.toEqual({
      eventId: e.id,
      status: 'skipped',
    });
  });
});

describe('the HTTP publisher', () => {
  it('appends the ingress path to a bare origin', async () => {
    const { f, zvonki } = poddelnyy_fetch({ ok: true, status: 200, body: { eventId: 'x', status: 'published' } });
    await new HttpEventPublisher({ endpoint: 'https://bus.example', token: 't', fetch: f }).publish(sobytie());
    expect(zvonki[0]?.url).toBe('https://bus.example/api/events');
  });

  it('does not double the slash when the origin already ends in one', async () => {
    // The case a caller produces by joining strings, and the one a hand-written
    // fixture never has.
    const { f, zvonki } = poddelnyy_fetch({ ok: true, status: 200, body: { eventId: 'x', status: 'published' } });
    await new HttpEventPublisher({ endpoint: 'https://bus.example/', token: 't', fetch: f }).publish(sobytie());
    expect(zvonki[0]?.url).toBe('https://bus.example/api/events');
  });

  it('leaves an address that already names the ingress alone', async () => {
    const { f, zvonki } = poddelnyy_fetch({ ok: true, status: 200, body: { eventId: 'x', status: 'published' } });
    await new HttpEventPublisher({ endpoint: 'https://bus.example/api/events', token: 't', fetch: f }).publish(sobytie());
    expect(zvonki[0]?.url).toBe('https://bus.example/api/events');
  });

  it('sends the token as a bearer credential and the event as the body', async () => {
    const { f, zvonki } = poddelnyy_fetch({ ok: true, status: 200, body: { eventId: 'x', status: 'published' } });
    const e = sobytie();
    await new HttpEventPublisher({ endpoint: 'https://bus.example', token: 'sekret', fetch: f }).publish(e);
    const init = zvonki[0]?.init as RequestInit & { headers: Record<string, string> };
    expect(init.method).toBe('POST');
    expect(init.headers['authorization']).toBe('Bearer sekret');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(String(init.body)).id).toBe(e.id);
  });

  it('turns a refusal into an error naming the event and the status', async () => {
    const { f } = poddelnyy_fetch({ ok: false, status: 503, body: {} });
    const e = sobytie();
    await expect(
      new HttpEventPublisher({ endpoint: 'https://bus.example', token: 't', fetch: f }).publish(e),
    ).rejects.toThrow(new RegExp(`${e.id}.*503`));
  });

  it('refuses a reply that is not the receipt it promised its caller', async () => {
    // The seam's own side of hostile data. Without this the method hands back
    // whatever arrived, typed as a receipt, and the mismatch surfaces wherever
    // the caller first reads a field — far from here and with no clue why.
    const { f } = poddelnyy_fetch({ ok: true, status: 200, body: { nothing: 'useful' } });
    await expect(
      new HttpEventPublisher({ endpoint: 'https://bus.example', token: 't', fetch: f }).publish(sobytie()),
    ).rejects.toThrow(/receipt/i);
  });

  it('refuses to send an event that would not survive validation', async () => {
    const { f, zvonki } = poddelnyy_fetch({ ok: true, status: 200, body: { eventId: 'x', status: 'published' } });
    const isporchennoe = { ...sobytie(), id: '' } as ProductEvent;
    await expect(
      new HttpEventPublisher({ endpoint: 'https://bus.example', token: 't', fetch: f }).publish(isporchennoe),
    ).rejects.toThrow(/id/);
    expect(zvonki).toHaveLength(0);
  });
});

describe('the fan-out publisher', () => {
  const receipt = (status: PublishReceipt['status']): EventPublisher => ({
    publish: async (e) => ({ eventId: e.id, status }),
  });

  it('skips when it has nobody to publish to', async () => {
    // Held, but not held ALONE: deleting the early return for an empty list
    // leaves this green, because the fallback at the end of the method produces
    // the same receipt from an empty array of results. The branch states an
    // intention rather than a behaviour, and no test can tell it from its own
    // absence. Said here so the next reader does not take a green run as proof
    // that the branch is load-bearing.
    const e = sobytie();
    await expect(new FanoutEventPublisher([]).publish(e)).resolves.toEqual({
      eventId: e.id,
      status: 'skipped',
    });
  });

  it('prefers a published receipt over the ones that only queued', async () => {
    const d = await new FanoutEventPublisher([
      receipt('queued'),
      receipt('published'),
      receipt('skipped'),
    ]).publish(sobytie());
    expect(d.status).toBe('published');
  });

  it('falls back to the first receipt when nobody published', async () => {
    const d = await new FanoutEventPublisher([receipt('queued'), receipt('skipped')]).publish(sobytie());
    expect(d.status).toBe('queued');
  });

  it('reaches every publisher, not only until one succeeds', async () => {
    const zvali: string[] = [];
    const imenovannyy = (name: string): EventPublisher => ({
      publish: async (e) => {
        zvali.push(name);
        return { eventId: e.id, status: 'published' as const };
      },
    });
    await new FanoutEventPublisher([imenovannyy('a'), imenovannyy('b')]).publish(sobytie());
    expect(zvali.sort((odin, drugoy) => odin.localeCompare(drugoy, 'en'))).toEqual(['a', 'b']);
  });

  it('fails the whole publication when one publisher throws', async () => {
    // Named rather than assumed: there is no partial success here, and a caller
    // that retries will publish again to the ones that already accepted.
    const padayushchiy: EventPublisher = {
      publish: async () => {
        throw new Error('downstream is down');
      },
    };
    await expect(
      new FanoutEventPublisher([receipt('published'), padayushchiy]).publish(sobytie()),
    ).rejects.toThrow(/downstream is down/);
  });
});

describe('the in-memory bus', () => {
  it('delivers to a subscriber with no filter', async () => {
    const bus = new InMemoryEventBus();
    const poluchennye: ProductEvent[] = [];
    await bus.subscribe({ durableName: 'a', handler: async (e) => void poluchennye.push(e) });
    const e = sobytie();
    await expect(bus.publish(e)).resolves.toMatchObject({ eventId: e.id, status: 'published' });
    expect(poluchennye).toHaveLength(1);
  });

  it('delivers only the types a subscriber asked for', async () => {
    const bus = new InMemoryEventBus();
    const poluchennye: string[] = [];
    await bus.subscribe({
      durableName: 'a',
      eventTypes: ['scan.completed'],
      handler: async (e) => void poluchennye.push(e.type),
    });
    await bus.publish(sobytie('scan.requested'));
    await bus.publish(sobytie('scan.completed'));
    expect(poluchennye).toEqual(['scan.completed']);
  });

  it('treats an empty list of types as nothing, not as everything', async () => {
    // It reads like "no filter" and means "no types". Both readings are
    // defensible, so the one the code holds is written down here.
    const bus = new InMemoryEventBus();
    let dostavleno = 0;
    await bus.subscribe({ durableName: 'a', eventTypes: [], handler: async () => void dostavleno++ });
    await bus.publish(sobytie());
    expect(dostavleno).toBe(0);
  });

  it('refuses a second subscription under a name already taken', async () => {
    const bus = new InMemoryEventBus();
    await bus.subscribe({ durableName: 'a', handler: async () => {} });
    await expect(bus.subscribe({ durableName: 'a', handler: async () => {} })).rejects.toThrow(
      /already exists: a/,
    );
  });

  it('stops delivering after a subscription closes, and frees its name', async () => {
    const bus = new InMemoryEventBus();
    let dostavleno = 0;
    const s = await bus.subscribe({ durableName: 'a', handler: async () => void dostavleno++ });
    await s.close();
    await bus.publish(sobytie());
    expect(dostavleno).toBe(0);
    await expect(bus.subscribe({ durableName: 'a', handler: async () => {} })).resolves.toBeTruthy();
  });

  it('refuses to deliver an event that would not survive validation', async () => {
    const bus = new InMemoryEventBus();
    let dostavleno = 0;
    await bus.subscribe({ durableName: 'a', handler: async () => void dostavleno++ });
    await expect(bus.publish({ ...sobytie(), version: 99 } as unknown as ProductEvent)).rejects.toThrow(
      /version/,
    );
    expect(dostavleno).toBe(0);
  });
});

describe('the file publisher', () => {
  it('writes one line per event and creates the directory it needs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'event-bus-'));
    const put = join(dir, 'nested', 'events.jsonl');
    const izdatel = new JsonlEventPublisher(put);
    const a = sobytie('scan.requested');
    const b = sobytie('scan.completed');
    await izdatel.publish(a);
    await izdatel.publish(b);
    const stroki = (await readFile(put, 'utf8')).trim().split('\n');
    expect(stroki).toHaveLength(2);
    expect(JSON.parse(stroki[0] ?? '{}').id).toBe(a.id);
    expect(JSON.parse(stroki[1] ?? '{}').type).toBe('scan.completed');
  });

  it('refuses an event that would not survive validation, and writes nothing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'event-bus-'));
    const put = join(dir, 'events.jsonl');
    await expect(
      new JsonlEventPublisher(put).publish({ ...sobytie(), source: '' } as ProductEvent),
    ).rejects.toThrow(/source/);
    await expect(readFile(put, 'utf8')).rejects.toThrow();
  });
});
