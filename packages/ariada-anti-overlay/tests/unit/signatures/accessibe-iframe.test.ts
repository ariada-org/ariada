// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/accessibe-iframe', () => {
  it('detects iframe-src accessibility iframe, confidence capped to medium', async () => {
    const html = `<iframe src="https://accessibe.com/accessibility/main"></iframe>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe-iframe');
    expect(hit).toBeDefined();
    // network-anchored would normally be high, but confidenceCap=medium clamps
    expect(hit?.confidence).toBe('medium');
  });

  it('detects iframe title attribute "Accessibility Toolbar"', async () => {
    const html = `<iframe title="Accessibility Toolbar" src="https://example.com"></iframe>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe-iframe');
    expect(hit?.confidence).toBe('low');
  });

  it('detects both signatures → still capped at medium', async () => {
    const html = `<iframe src="https://accessibe.com/accessibility/main" title="Accessibility Toolbar"></iframe>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'accessibe-iframe');
    expect(hit?.confidence).toBe('medium');
  });
});
