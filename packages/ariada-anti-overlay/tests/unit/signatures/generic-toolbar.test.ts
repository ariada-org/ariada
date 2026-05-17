// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../../src/detect.js';

describe('signatures/generic-toolbar', () => {
  it('detects a region with 5+ canonical toolbar keywords as low confidence', async () => {
    const html = `<div role="region" aria-label="Accessibility tools">
      <button>font-size +</button>
      <button>contrast</button>
      <button>links</button>
      <button>cursor</button>
      <button>dyslexia</button>
    </div>`;
    const r = await detectOverlays({ html });
    const hit = r.vendorsDetected.find((v) => v.vendor === 'generic-toolbar');
    expect(hit).toBeDefined();
    // confidenceCap=low locks it
    expect(hit?.confidence).toBe('low');
  });

  it('does NOT detect a plain a11y settings pane with only 2 controls', async () => {
    const html = `<div role="region" aria-label="Accessibility settings">
      <button>font-size</button>
      <button>contrast</button>
    </div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'generic-toolbar')).toBeUndefined();
  });

  it('does NOT detect when aria-label lacks "accessibility"', async () => {
    const html = `<div role="region" aria-label="Settings">
      <button>font-size</button>
      <button>contrast</button>
      <button>links</button>
      <button>cursor</button>
      <button>dyslexia</button>
    </div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'generic-toolbar')).toBeUndefined();
  });
});
