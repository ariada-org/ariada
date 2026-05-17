// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/audioeye', () => {
  it('detects wsmcdn.audioeye.com script as high', async () => {
    const html = `<script src="https://wsmcdn.audioeye.com/aem.js"></script>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'audioeye');
    expect(hit?.confidence).toBe('high');
  });

  it('detects #ae_launcher alone as low', async () => {
    const html = `<button id="ae_launcher"></button>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'audioeye');
    expect(hit?.confidence).toBe('low');
  });

  it('detects class prefix audioeye-', async () => {
    const html = `<div class="audioeye-toolbar"></div>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'audioeye');
    expect(hit?.confidence).toBe('low');
  });

  it('detects iframe-src audioeye.com as high', async () => {
    const html = `<iframe src="https://audioeye.com/iframe"></iframe>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'audioeye');
    expect(hit?.confidence).toBe('high');
  });
});
