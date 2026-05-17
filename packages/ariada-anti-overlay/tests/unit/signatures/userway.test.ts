// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/userway', () => {
  it('detects via cdn.userway.org script-src as high confidence', async () => {
    const html = `<script src="https://cdn.userway.org/widget.js" data-account="ABCD1234"></script>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'userway');
    expect(hit?.confidence).toBe('high');
  });

  it('detects via #userwayAccessibilityIcon dom-id alone as low', async () => {
    const html = `<div id="userwayAccessibilityIcon"></div>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'userway');
    expect(hit?.confidence).toBe('low');
  });

  it('detects via uw-* class prefix', async () => {
    const html = `<div class="uw-toolbar uw-handle"></div>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'userway');
    expect(hit?.confidence).toBe('low');
  });

  it('detects window.UserWayWidgetApp', async () => {
    const html = `<script>window.UserWayWidgetApp = {};</script>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'userway');
    expect(hit).toBeDefined();
  });
});
