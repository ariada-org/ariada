// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/purple-lens', () => {
  it('detects widget.purplelens.io script-src as high', async () => {
    const html = `<script src="https://widget.purplelens.io/lens.js"></script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'purple-lens')?.confidence).toBe('high');
  });

  it('detects cdn.purplehat.com script-src as high', async () => {
    const html = `<script src="https://cdn.purplehat.com/hat.js"></script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'purple-lens')?.confidence).toBe('high');
  });

  it('detects #purple-lens-widget dom-id', async () => {
    const html = `<div id="purple-lens-widget"></div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'purple-lens')?.confidence).toBe('low');
  });

  it('detects class prefix purple-cube-', async () => {
    const html = `<div class="purple-cube-toolbar"></div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'purple-lens')?.confidence).toBe('low');
  });
});
