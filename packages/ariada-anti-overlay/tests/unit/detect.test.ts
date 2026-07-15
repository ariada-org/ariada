// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../src/detect.js';
import { OverlayDetectionError } from '../../src/types.js';

const FIXED_CLOCK = () => '2026-05-20T00:00:00.000Z';

describe('detect.orchestrator', () => {
  it('returns empty vendorsDetected for plain HTML', async () => {
    const r = await detectOverlays(
      { html: '<html><body><h1>Hello world</h1></body></html>' },
      { now: FIXED_CLOCK },
    );
    expect(r.vendorsDetected).toEqual([]);
    // Citations always attached even when zero vendors.
    expect(r.citations.w3cWaiOverlayPosition).toMatch(/^https?:\/\//);
  });

  it('aggregates multiple vendors on the same page', async () => {
    const html = `<script src="https://acsbapp.com/x.js"></script>
                  <script src="https://cdn.userway.org/y.js" data-account="A"></script>`;
    const r = await detectOverlays({ html }, { now: FIXED_CLOCK });
    const ids = r.vendorsDetected.map((v) => v.vendor).sort();
    expect(ids).toEqual(['accessibe', 'userway']);
  });

  it('rejects empty html with code 2', async () => {
    await expect(detectOverlays({ html: '' })).rejects.toMatchObject({ code: 2 });
  });

  it('rejects url input without fetcher with code 2', async () => {
    await expect(detectOverlays({ url: 'https://example.com' })).rejects.toMatchObject({
      code: 2,
    });
  });

  it('rejects malformed url with code 2', async () => {
    await expect(
      detectOverlays({ url: 'notaurl' }, { fetcher: async () => '<html></html>' }),
    ).rejects.toMatchObject({ code: 2 });
  });

  it('rejects unknown signatureSubset entry with code 2', async () => {
    await expect(
      detectOverlays({ html: '<html></html>' }, { signatureSubset: ['no-such-vendor'] }),
    ).rejects.toBeInstanceOf(OverlayDetectionError);
  });

  it('honours confidenceFloor=high (filters out low hits)', async () => {
    const html = `<div id="acsb-trigger"></div>`;
    const r = await detectOverlays({ html }, { confidenceFloor: 'high', now: FIXED_CLOCK });
    expect(r.vendorsDetected).toEqual([]);
  });

  it('honours signatureSubset to scope detection', async () => {
    const html = `<script src="https://acsbapp.com/x.js"></script>
                  <script src="https://cdn.userway.org/y.js"></script>`;
    const r = await detectOverlays(
      { html },
      { signatureSubset: ['userway'], now: FIXED_CLOCK },
    );
    expect(r.vendorsDetected.map((v) => v.vendor)).toEqual(['userway']);
  });

  it('url input delegates to fetcher and emits report', async () => {
    let called = false;
    const html = `<script src="https://acsbapp.com/x.js"></script>`;
    const r = await detectOverlays(
      { url: 'https://example.com' },
      {
        fetcher: async (u) => {
          called = true;
          expect(u).toBe('https://example.com');
          return html;
        },
        now: FIXED_CLOCK,
      },
    );
    expect(called).toBe(true);
    expect(r.vendorsDetected[0]?.vendor).toBe('accessibe');
  });

  it('fetcher rejection produces code 3', async () => {
    await expect(
      detectOverlays(
        { url: 'https://example.com' },
        {
          fetcher: async () => {
            throw new Error('network down');
          },
        },
      ),
    ).rejects.toMatchObject({ code: 3 });
  });

  it('deterministic output under fixed clock', async () => {
    const html = `<script src="https://acsbapp.com/x.js"></script>`;
    const r1 = await detectOverlays({ html }, { now: FIXED_CLOCK });
    const r2 = await detectOverlays({ html }, { now: FIXED_CLOCK });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('emits signaturesVersion in report', async () => {
    const r = await detectOverlays({ html: '<html></html>' }, { now: FIXED_CLOCK });
    expect(r.signaturesVersion).toMatch(/^\d+\.\d+$/);
  });
});
