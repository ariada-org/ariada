// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/equalweb', () => {
  it('detects via aacdn.equalweb.com script-src as high', async () => {
    const html = `<script src="https://aacdn.equalweb.com/aw.js"></script>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'equalweb');
    expect(hit?.confidence).toBe('high');
  });

  it('detects via #INDmenu-btn as low', async () => {
    const html = `<button id="INDmenu-btn">x</button>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'equalweb');
    expect(hit?.confidence).toBe('low');
  });

  it('detects via class equalweb-*', async () => {
    const html = `<div class="equalweb-widget"></div>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'equalweb');
    expect(hit?.confidence).toBe('low');
  });

  it('class-prefix + install_status global → high (3+ matches via mix)', async () => {
    const html = `<div class="equalweb-widget"></div><button id="INDmenu-btn"></button><script>window.equalweb_install_status=1</script>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'equalweb');
    expect(hit?.confidence).toBe('high');
  });
});
