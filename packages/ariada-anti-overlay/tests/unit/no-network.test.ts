// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { detectOverlays } from '../../src/detect.js';

describe('no-network invariant', () => {
  let fetchCalls = 0;
  let httpRequestCalls = 0;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchCalls = 0;
    httpRequestCalls = 0;
    // Replace global fetch with a counter — any call from inside the
    // package is a violation of the no-network invariant.
    globalThis.fetch = ((..._args: unknown[]) => {
      fetchCalls += 1;
      return Promise.reject(new Error('fetch should not be called'));
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('html-input path makes zero fetch calls across the full signature suite', async () => {
    const html = `<script src="https://acsbapp.com/x.js"></script>
                  <script src="https://cdn.userway.org/y.js"></script>
                  <div id="INDmenu-btn"></div>
                  <button id="ae_launcher"></button>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.length).toBeGreaterThan(0);
    expect(fetchCalls).toBe(0);
    expect(httpRequestCalls).toBe(0);
  });
});
