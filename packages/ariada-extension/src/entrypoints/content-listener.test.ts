// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// The content script answers the panel after at least one turn of the event
// loop — the capture waits on a fetch, and the other two reply from inside a
// try block that runs after the listener has already returned. The browser
// throws the reply away unless the listener said true when the message came in.
//
// Nothing about that is visible when it breaks. The panel simply never hears
// back, on some pages, some of the time. So the contract is asserted here:
// true for each of the three requests this script serves, false for a message
// meant for somebody else, so a channel is not held open on its behalf.
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { CAPTURE_REQUEST, HEAL_REQUEST } from '../lib/messages.js';

type Listener = (message: unknown, sender: unknown, respond: (r: unknown) => void) => unknown;

let listener: Listener;

beforeAll(async () => {
  const registered: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { onMessage: { addListener: (fn: Listener) => registered.push(fn) } },
  };
  // The capture path reaches the network for the files at the site's root.
  // Answering it here keeps the test about the return value.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));

  await import('./content.js');
  const first = registered[0];
  if (!first) throw new Error('content.js registered no message listener');
  listener = first;
});

const respond = (): ((r: unknown) => void) => vi.fn();

describe('the content script holds the channel open for the messages it answers', () => {
  it('says true for a capture request', () => {
    expect(listener(CAPTURE_REQUEST, null, respond())).toBe(true);
  });

  it('says true for a highlight request', () => {
    expect(listener({ kind: 'highlight_request', findings: [], off: true }, null, respond())).toBe(true);
  });

  it('says true for a heal request', () => {
    expect(listener(HEAL_REQUEST, null, respond())).toBe(true);
  });

  it('says false for a message it does not serve', () => {
    expect(listener({ kind: 'something_else' }, null, respond())).toBe(false);
  });
});
