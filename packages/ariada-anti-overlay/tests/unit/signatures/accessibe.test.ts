// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/accessibe', () => {
  it('detects via acsbapp.com script-src as high confidence', async () => {
    const html = `<html><head><script src="https://acsbapp.com/apps/app/dist/js/app.js"></script></head><body></body></html>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe');
    expect(hit).toBeDefined();
    expect(hit?.confidence).toBe('high');
  });

  it('detects via #acsb-trigger dom-id alone as low confidence', async () => {
    const html = `<html><body><button id="acsb-trigger">a11y</button></body></html>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe');
    expect(hit).toBeDefined();
    expect(hit?.confidence).toBe('low');
  });

  it('detects via window.acsbJS global-js as low confidence', async () => {
    const html = `<html><body><script>window.acsbJS = {};</script></body></html>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe');
    expect(hit).toBeDefined();
    expect(hit?.confidence).toBe('low');
  });

  it('detects via class-prefix + dom-id as medium confidence', async () => {
    const html = `<html><body><button id="acsb-trigger" class="acsb-button">x</button></body></html>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe');
    expect(hit?.confidence).toBe('medium');
  });

  it('accessibe.com/access script promotes confidence to high', async () => {
    const html = `<script src="https://accessibe.com/access/main.js"></script><div class="acsb-foo"></div>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe');
    expect(hit?.confidence).toBe('high');
  });
});
