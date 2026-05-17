// SPDX-License-Identifier: EUPL-1.2
import { describe, it, expect } from 'vitest';

import {
  buildCitations,
  CITATION_DISCLAIMER,
  CITATIONS_LAST_VERIFIED,
  OVERLAY_FACTSHEET,
  W3C_WAI_OVERLAY_POSITION,
} from '../../src/citations.js';
import { detectOverlays } from '../../src/detect.js';

const FIXED_CLOCK = () => '2026-05-20T00:00:00.000Z';

describe('citations', () => {
  it('exposes W3C_WAI_OVERLAY_POSITION as an HTTPS URL', () => {
    expect(W3C_WAI_OVERLAY_POSITION).toMatch(/^https:\/\/www\.w3\.org\//);
  });

  it('exposes OVERLAY_FACTSHEET as an HTTPS URL', () => {
    expect(OVERLAY_FACTSHEET).toMatch(/^https:\/\//);
  });

  it('exposes CITATIONS_LAST_VERIFIED as ISO date', () => {
    expect(CITATIONS_LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('CITATION_DISCLAIMER is verbatim NOT LEGAL ADVICE wording', () => {
    expect(CITATION_DISCLAIMER).toBe(
      'Detection is mechanical pattern-matching. The fact a vendor is present does not by itself prove WCAG / EAA non-conformance. NOT LEGAL ADVICE.',
    );
  });

  it('buildCitations() returns all four fields populated', () => {
    const c = buildCitations();
    expect(c.w3cWaiOverlayPosition).toBe(W3C_WAI_OVERLAY_POSITION);
    expect(c.overlayFactsheet).toBe(OVERLAY_FACTSHEET);
    expect(c.citationsLastVerified).toBe(CITATIONS_LAST_VERIFIED);
    expect(c.disclaimer).toBe(CITATION_DISCLAIMER);
  });

  it('report includes citations even when zero vendors detected', async () => {
    const r = await detectOverlays({ html: '<html></html>' }, { now: FIXED_CLOCK });
    expect(r.vendorsDetected).toEqual([]);
    expect(r.citations.disclaimer).toBe(CITATION_DISCLAIMER);
    expect(r.citations.w3cWaiOverlayPosition).toBe(W3C_WAI_OVERLAY_POSITION);
  });
});
