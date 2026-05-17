// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/maxaccess', () => {
  it('detects maxaccess.io script-src', async () => {
    const html = `<script src="https://maxaccess.io/widget.js"></script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'maxaccess')?.confidence).toBe('high');
  });

  it('detects cdn.maxaccess.io script-src', async () => {
    const html = `<script src="https://cdn.maxaccess.io/widget.js"></script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'maxaccess')?.confidence).toBe('high');
  });

  it('detects #maxAccess dom-id', async () => {
    const html = `<div id="maxAccess"></div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'maxaccess')?.confidence).toBe('low');
  });

  it('detects class max-access-*', async () => {
    const html = `<div class="max-access-toolbar"></div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'maxaccess')?.confidence).toBe('low');
  });
});
