// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/reciteme', () => {
  it('detects via cdn.reciteme.com', async () => {
    const html = `<script src="https://cdn.reciteme.com/recite.js"></script>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'reciteme');
    expect(hit?.confidence).toBe('high');
  });

  it('detects #rmCustomToolbarContainer', async () => {
    const html = `<div id="rmCustomToolbarContainer"></div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'reciteme')?.confidence).toBe('low');
  });

  it('detects class prefix recite-', async () => {
    const html = `<div class="recite-toolbar"></div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'reciteme')?.confidence).toBe('low');
  });

  it('detects window.Recite global', async () => {
    const html = `<script>window.Recite={};</script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'reciteme')).toBeDefined();
  });
});
