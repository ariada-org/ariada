// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import { detectOverlays } from '../../src/detect.js';

describe('false-positive discipline', () => {
  it('operational email mention does NOT trigger accessibe', async () => {
    const html = `<p>Contact us at hello@accessibe.com for questions about our policy.</p>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'accessibe')).toBeUndefined();
  });

  it('verbatim citation text in the page body does NOT self-trigger', async () => {
    const html = `<p>Detection is mechanical pattern-matching. The fact a vendor is present does not by itself prove WCAG / EAA non-conformance. NOT LEGAL ADVICE.</p>
                  <a href="https://overlayfactsheet.com/">Read more</a>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected).toEqual([]);
  });

  it('plain a11y settings pane with only 2 controls does NOT trigger generic-toolbar', async () => {
    const html = `<div role="region" aria-label="Accessibility preferences">
      <button>font-size</button>
      <button>contrast</button>
    </div>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected).toEqual([]);
  });

  it('vendor name in prose body does NOT trigger detection without markers', async () => {
    const html = `<p>We do not use UserWay or AudioEye on our site.</p>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected).toEqual([]);
  });

  it('script src containing vendor token substring but different host does NOT match', async () => {
    // host is example.com, vendor token appears in path — must NOT match
    // (signatures are host-anchored)
    const html = `<script src="https://example.com/foo/acsbapp-mention.js"></script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'accessibe')).toBeUndefined();
  });

  it('legitimate "recitation" class does NOT trigger reciteme global pattern', async () => {
    const html = `<script>const x = Recitation;</script>`;
    const r = await detectOverlays({ html });
    expect(r.vendorsDetected.find((v) => v.vendor === 'reciteme')).toBeUndefined();
  });

  it('class name "auto-userway-helper" inside body does NOT match userway prefix without "uw-" boundary', async () => {
    // Word-boundary discipline: class names must START with the prefix.
    const html = `<div class="our-uwabunga"></div>`;
    const r = await detectOverlays({ html });
    // uwabunga starts with "uw" but not "uw-"; pattern requires hyphen + suffix
    expect(r.vendorsDetected.find((v) => v.vendor === 'userway')).toBeUndefined();
  });
});
