// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe("signatures/faciliti", () => {
  it('detects widget.facil-iti.com script-src as high', async () => {
    const html = `<script src="https://widget.facil-iti.com/widget.js"></script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'faciliti')?.confidence).toBe('high');
  });

  it('detects assets.facil-iti.com script-src', async () => {
    const html = `<script src="https://assets.facil-iti.com/widget.js"></script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'faciliti')?.confidence).toBe('high');
  });

  it('detects class prefix faciliti-', async () => {
    const html = `<div class="faciliti-toolbar"></div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'faciliti')?.confidence).toBe('low');
  });

  it('detects window.FACILiti global', async () => {
    const html = `<script>window.FACILiti={};</script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'faciliti')).toBeDefined();
  });
});
